using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;

namespace PostGenerator.Function.Services;

public class PublishRunner
{
    private readonly string _connectionString;
    private readonly IReadOnlyList<IPostPublisher> _publishers;
    private readonly IMailgunNotificationService _mailgun;
    private readonly ILogger<PublishRunner> _logger;

    public PublishRunner(
        IConfiguration config,
        IEnumerable<IPostPublisher> publishers,
        IMailgunNotificationService mailgun,
        ILogger<PublishRunner> logger)
    {
        _connectionString = config.GetConnectionString("DefaultConnection") ?? "";
        _publishers = publishers.ToList();
        _mailgun = mailgun;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_connectionString))
        {
            _logger.LogWarning("No connection string configured");
            return;
        }

        // Single query: due posts with user email (JOIN) to avoid N+1 connections
        var due = new List<PostToPublish>();
        await using (var conn = new SqlConnection(_connectionString))
        {
            await conn.OpenAsync(ct);
            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT p.Id, p.UserId, p.Content, p.Platform, p.ImageUrl, p.Script, p.MetadataJson, u.Email
                FROM Posts p
                INNER JOIN Users u ON u.Id = p.UserId
                WHERE p.ScheduledAt <= GETUTCDATE() AND p.Status = @scheduled";
            cmd.Parameters.AddWithValue("@scheduled", (int)PostStatus.Scheduled);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                due.Add(new PostToPublish
                {
                    Id = r.GetInt32(0),
                    UserId = r.GetInt32(1),
                    Content = r.GetString(2),
                    Platform = (PostPlatform)r.GetInt32(3),
                    ImageUrl = r.IsDBNull(4) ? null : r.GetString(4),
                    Script = r.IsDBNull(5) ? null : r.GetString(5),
                    MetadataJson = r.IsDBNull(6) ? null : r.GetString(6),
                    UserEmail = r.IsDBNull(7) ? "" : r.GetString(7),
                });
            }
        }

        foreach (var post in due)
        {
            var publisher = _publishers.FirstOrDefault(x => x.Platform == post.Platform);
            var ok = publisher != null && await publisher.PublishAsync(post, ct);
            if (publisher == null)
                _logger.LogWarning("No publisher for platform {Platform}, post {PostId} marked failed", post.Platform, post.Id);

            DateTime? mailgunSentAt = null;
            if (ok && !string.IsNullOrEmpty(post.UserEmail))
            {
                var sent = await _mailgun.SendPostPublishedAsync(
                    post.UserEmail,
                    post.Platform.ToString(),
                    post.Content.Length > 200 ? post.Content[..200] + "…" : post.Content,
                    ct);
                if (sent) mailgunSentAt = DateTime.UtcNow;
            }

            var status = ok ? PostStatus.Published : PostStatus.Failed;
            await using (var conn = new SqlConnection(_connectionString))
            {
                await conn.OpenAsync(ct);
                await using var tran = conn.BeginTransaction();
                try
                {
                    var updateCmd = conn.CreateCommand();
                    updateCmd.Transaction = tran;
                    updateCmd.CommandText = "UPDATE Posts SET Status = @status, PublishedAt = GETUTCDATE() WHERE Id = @id";
                    updateCmd.Parameters.AddWithValue("@status", (int)status);
                    updateCmd.Parameters.AddWithValue("@id", post.Id);
                    await updateCmd.ExecuteNonQueryAsync(ct);

                    var logCmd = conn.CreateCommand();
                    logCmd.Transaction = tran;
                    logCmd.CommandText = @"
                        INSERT INTO PublishLogs (PostId, Platform, Succeeded, ErrorMessage, MailgunSentAt, CreatedAt)
                        VALUES (@postId, @platform, @succeeded, @errorMessage, @mailgunSentAt, GETUTCDATE())";
                    logCmd.Parameters.AddWithValue("@postId", post.Id);
                    logCmd.Parameters.AddWithValue("@platform", (int)post.Platform);
                    logCmd.Parameters.AddWithValue("@succeeded", ok);
                    logCmd.Parameters.AddWithValue("@errorMessage", (object?)null);
                    logCmd.Parameters.AddWithValue("@mailgunSentAt", (object?)mailgunSentAt ?? DBNull.Value);
                    await logCmd.ExecuteNonQueryAsync(ct);

                    tran.Commit();
                }
                catch
                {
                    tran.Rollback();
                    throw;
                }
            }
        }
    }
}
