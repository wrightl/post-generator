using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;

namespace PostGenerator.Function.Services;

/// <summary>
/// Runs the scheduled publish job: loads due posts from SQL, publishes via platform clients, updates Posts and PublishLogs.
/// Uses raw ADO.NET (SqlConnection) rather than EF Core to avoid request-scoped DbContext in the Function worker and to keep the Function deployable without the Api's EF migrations runtime.
/// </summary>
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

    /// <summary>Loads CredentialJson from UserSocialCredentials for the given user and platform. Returns null if not found or invalid.</summary>
    private async Task<IReadOnlyDictionary<string, string>?> LoadCredentialsAsync(int userId, PostPlatform platform, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_connectionString)) return null;
        var platformName = platform.ToString();
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT CredentialJson FROM UserSocialCredentials WHERE UserId = @userId AND Platform = @platform";
        cmd.Parameters.Add(new SqlParameter("@userId", SqlDbType.Int) { Value = userId });
        cmd.Parameters.Add(new SqlParameter("@platform", SqlDbType.NVarChar, 32) { Value = platformName });
        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        var json = r.IsDBNull(0) ? null : r.GetString(0);
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
            return dict?.Count > 0 ? dict : null;
        }
        catch
        {
            return null;
        }
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
            cmd.Parameters.Add(new SqlParameter("@scheduled", SqlDbType.Int) { Value = (int)PostStatus.Scheduled });
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
            var credentials = await LoadCredentialsAsync(post.UserId, post.Platform, ct);
            if (credentials == null && publisher != null)
                _logger.LogDebug("No per-user credentials for user {UserId} platform {Platform}, publisher may use app config", post.UserId, post.Platform);
            var result = publisher != null ? await publisher.PublishAsync(post, credentials, ct) : PublishResult.Failed;
            var ok = result.Success;
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
            var externalPostId = result.ExternalPostId;
            await using (var conn = new SqlConnection(_connectionString))
            {
                await conn.OpenAsync(ct);
                await using var tran = conn.BeginTransaction();
                try
                {
                    var updateCmd = conn.CreateCommand();
                    updateCmd.Transaction = tran;
                    updateCmd.CommandText = "UPDATE Posts SET Status = @status, PublishedAt = GETUTCDATE(), ExternalPostId = @externalPostId WHERE Id = @id";
                    updateCmd.Parameters.Add(new SqlParameter("@status", SqlDbType.Int) { Value = (int)status });
                    updateCmd.Parameters.Add(new SqlParameter("@externalPostId", SqlDbType.NVarChar, 512) { Value = string.IsNullOrEmpty(externalPostId) ? (object)DBNull.Value : externalPostId });
                    updateCmd.Parameters.Add(new SqlParameter("@id", SqlDbType.Int) { Value = post.Id });
                    await updateCmd.ExecuteNonQueryAsync(ct);

                    var logCmd = conn.CreateCommand();
                    logCmd.Transaction = tran;
                    logCmd.CommandText = @"
                        INSERT INTO PublishLogs (PostId, Platform, Succeeded, ErrorMessage, MailgunSentAt, CreatedAt)
                        VALUES (@postId, @platform, @succeeded, @errorMessage, @mailgunSentAt, GETUTCDATE())";
                    logCmd.Parameters.Add(new SqlParameter("@postId", SqlDbType.Int) { Value = post.Id });
                    logCmd.Parameters.Add(new SqlParameter("@platform", SqlDbType.Int) { Value = (int)post.Platform });
                    logCmd.Parameters.Add(new SqlParameter("@succeeded", SqlDbType.Bit) { Value = ok });
                    logCmd.Parameters.Add(new SqlParameter("@errorMessage", SqlDbType.NVarChar, 2000) { Value = DBNull.Value });
                    logCmd.Parameters.Add(new SqlParameter("@mailgunSentAt", SqlDbType.DateTime2) { Value = (object?)mailgunSentAt ?? DBNull.Value });
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
