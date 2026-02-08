using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;

namespace PostGenerator.Function.Services;

public class TikTokPublisher : IPostPublisher
{
    public PostPlatform Platform => PostPlatform.TikTok;
    private const string InitUrl = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
    private const string StatusUrl = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<TikTokPublisher> _logger;

    public TikTokPublisher(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<TikTokPublisher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<PublishResult> PublishAsync(PostToPublish post, IReadOnlyDictionary<string, string>? credentials, CancellationToken ct = default)
    {
        var accessToken = (credentials != null && credentials.TryGetValue("AccessToken", out var tat) ? tat : null) ?? _config["TikTok:AccessToken"];
        if (string.IsNullOrEmpty(accessToken))
        {
            _logger.LogWarning("TikTok publisher skipped: TikTok:AccessToken not configured");
            return PublishResult.Failed;
        }

        var videoUrl = GetVideoUrl(post);
        if (string.IsNullOrEmpty(videoUrl))
        {
            _logger.LogWarning("TikTok requires a video URL (set MetadataJson.video_url or ImageUrl for video). Post {PostId} skipped.", post.Id);
            return PublishResult.Failed;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("Authorization", "Bearer " + accessToken);
            client.DefaultRequestHeaders.Add("Content-Type", "application/json; charset=UTF-8");

            var initBody = new { source_info = new { source = "PULL_FROM_URL", video_url = videoUrl } };
            using var initResp = await client.PostAsJsonAsync(InitUrl, initBody, ct);
            initResp.EnsureSuccessStatusCode();
            var initJson = await initResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var errorCode = initJson.TryGetProperty("error", out var err) ? err.GetProperty("code").GetString() : null;
            if (errorCode != null && errorCode != "ok")
            {
                var msg = err.TryGetProperty("message", out var m) ? m.GetString() : errorCode;
                _logger.LogError("TikTok init failed for post {PostId}: {Message}", post.Id, msg);
                return PublishResult.Failed;
            }
            var publishId = initJson.GetProperty("data").GetProperty("publish_id").GetString();
            if (string.IsNullOrEmpty(publishId))
            {
                _logger.LogError("TikTok init response missing publish_id for post {PostId}", post.Id);
                return PublishResult.Failed;
            }

            string? externalId = null;
            for (var i = 0; i < 60; i++)
            {
                await Task.Delay(2000, ct);
                var statusBody = new Dictionary<string, string> { ["publish_id"] = publishId };
                using var statusResp = await client.PostAsJsonAsync(StatusUrl, statusBody, ct);
                statusResp.EnsureSuccessStatusCode();
                var statusJson = await statusResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
                var status = statusJson.TryGetProperty("data", out var data) ? data.GetProperty("status").GetString() : null;
                if (statusJson.TryGetProperty("data", out var dataNode) && dataNode.TryGetProperty("video_id", out var videoIdEl))
                    externalId = videoIdEl.GetString() ?? publishId;
                else
                    externalId = publishId;
                switch (status)
                {
                    case "SEND_TO_USER_INBOX":
                    case "PUBLISH_COMPLETE":
                        _logger.LogInformation("TikTok post published for post {PostId}", post.Id);
                        return PublishResult.Ok(externalId);
                    case "FAILED":
                        var reason = data.TryGetProperty("fail_reason", out var fr) ? fr.GetString() : "Unknown";
                        _logger.LogError("TikTok publish failed for post {PostId}: {Reason}", post.Id, reason);
                        return PublishResult.Failed;
                    case "PROCESSING_DOWNLOAD":
                    case "PROCESSING_UPLOAD":
                        continue;
                    default:
                        _logger.LogWarning("TikTok unknown status for post {PostId}: {Status}", post.Id, status);
                        break;
                }
            }

            _logger.LogError("TikTok publish timed out for post {PostId}", post.Id);
            return PublishResult.Failed;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "TikTok HTTP error publishing post {PostId}", post.Id);
            return PublishResult.Failed;
        }
        catch (TaskCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TikTok error publishing post {PostId}", post.Id);
            return PublishResult.Failed;
        }
    }

    private static string? GetVideoUrl(PostToPublish post)
    {
        if (!string.IsNullOrEmpty(post.MetadataJson))
        {
            try
            {
                var doc = JsonDocument.Parse(post.MetadataJson);
                if (doc.RootElement.TryGetProperty("video_url", out var v))
                    return v.GetString();
            }
            catch { /* ignore */ }
        }
        return post.ImageUrl;
    }
}
