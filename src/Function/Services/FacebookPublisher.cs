using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;

namespace PostGenerator.Function.Services;

public class FacebookPublisher : IPostPublisher
{
    public PostPlatform Platform => PostPlatform.Facebook;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<FacebookPublisher> _logger;

    public FacebookPublisher(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<FacebookPublisher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<PublishResult> PublishAsync(PostToPublish post, IReadOnlyDictionary<string, string>? credentials, CancellationToken ct = default)
    {
        var pageId = (credentials != null && credentials.TryGetValue("PageId", out var pid) ? pid : null) ?? _config["Facebook:PageId"];
        var pageAccessToken = (credentials != null && credentials.TryGetValue("PageAccessToken", out var pat) ? pat : null) ?? _config["Facebook:PageAccessToken"];

        if (string.IsNullOrEmpty(pageId) || string.IsNullOrEmpty(pageAccessToken))
        {
            _logger.LogWarning("Facebook publisher skipped: Facebook:PageId or Facebook:PageAccessToken not configured");
            return PublishResult.Failed;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            var baseUrl = $"https://graph.facebook.com/v21.0/{pageId}";
            string? externalId = null;

            if (!string.IsNullOrEmpty(post.ImageUrl))
            {
                var photosUrl = $"{baseUrl}/photos?url={Uri.EscapeDataString(post.ImageUrl)}&message={Uri.EscapeDataString(post.Content)}&access_token={Uri.EscapeDataString(pageAccessToken)}";
                using var resp = await client.PostAsync(photosUrl, null, ct);
                resp.EnsureSuccessStatusCode();
                externalId = await ParseIdFromResponseAsync(resp, ct);
            }
            else
            {
                var feedUrl = $"{baseUrl}/feed?message={Uri.EscapeDataString(post.Content)}&access_token={Uri.EscapeDataString(pageAccessToken)}";
                using var resp = await client.PostAsync(feedUrl, null, ct);
                resp.EnsureSuccessStatusCode();
                externalId = await ParseIdFromResponseAsync(resp, ct);
            }

            _logger.LogInformation("Facebook post published for post {PostId}", post.Id);
            return PublishResult.Ok(externalId);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Facebook HTTP error publishing post {PostId}", post.Id);
            return PublishResult.Failed;
        }
        catch (TaskCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Facebook error publishing post {PostId}", post.Id);
            return PublishResult.Failed;
        }
    }

    private static async Task<string?> ParseIdFromResponseAsync(HttpResponseMessage resp, CancellationToken ct)
    {
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (string.IsNullOrEmpty(body)) return null;
        try
        {
            var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("id", out var idEl))
                return idEl.GetString();
        }
        catch { /* ignore */ }
        return null;
    }
}
