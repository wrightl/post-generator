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

    public async Task<bool> PublishAsync(PostToPublish post, CancellationToken ct = default)
    {
        var pageId = _config["Facebook:PageId"];
        var pageAccessToken = _config["Facebook:PageAccessToken"];

        if (string.IsNullOrEmpty(pageId) || string.IsNullOrEmpty(pageAccessToken))
        {
            _logger.LogWarning("Facebook publisher skipped: Facebook:PageId or Facebook:PageAccessToken not configured");
            return false;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            var baseUrl = $"https://graph.facebook.com/v21.0/{pageId}";

            if (!string.IsNullOrEmpty(post.ImageUrl))
            {
                var photosUrl = $"{baseUrl}/photos?url={Uri.EscapeDataString(post.ImageUrl)}&message={Uri.EscapeDataString(post.Content)}&access_token={Uri.EscapeDataString(pageAccessToken)}";
                using var resp = await client.PostAsync(photosUrl, null, ct);
                resp.EnsureSuccessStatusCode();
            }
            else
            {
                var feedUrl = $"{baseUrl}/feed?message={Uri.EscapeDataString(post.Content)}&access_token={Uri.EscapeDataString(pageAccessToken)}";
                using var resp = await client.PostAsync(feedUrl, null, ct);
                resp.EnsureSuccessStatusCode();
            }

            _logger.LogInformation("Facebook post published for post {PostId}", post.Id);
            return true;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Facebook HTTP error publishing post {PostId}", post.Id);
            return false;
        }
        catch (TaskCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Facebook error publishing post {PostId}", post.Id);
            return false;
        }
    }
}
