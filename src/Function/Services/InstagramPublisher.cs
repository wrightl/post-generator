using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;

namespace PostGenerator.Function.Services;

public class InstagramPublisher : IPostPublisher
{
    public PostPlatform Platform => PostPlatform.Instagram;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<InstagramPublisher> _logger;

    public InstagramPublisher(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<InstagramPublisher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<PublishResult> PublishAsync(PostToPublish post, IReadOnlyDictionary<string, string>? credentials, CancellationToken ct = default)
    {
        var userId = (credentials != null && credentials.TryGetValue("UserId", out var uid) ? uid : null) ?? _config["Instagram:UserId"];
        var accessToken = (credentials != null && credentials.TryGetValue("AccessToken", out var iat) ? iat : null) ?? _config["Instagram:AccessToken"];

        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(accessToken))
        {
            _logger.LogWarning("Instagram publisher skipped: Instagram:UserId or Instagram:AccessToken not configured");
            return PublishResult.Failed;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            var baseUrl = "https://graph.facebook.com/v21.0";
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            string? creationId;
            if (!string.IsNullOrEmpty(post.ImageUrl))
            {
                var containerUrl = $"{baseUrl}/{userId}/media?image_url={Uri.EscapeDataString(post.ImageUrl)}&caption={Uri.EscapeDataString(post.Content)}";
                using var containerResp = await client.PostAsync(containerUrl, null, ct);
                containerResp.EnsureSuccessStatusCode();
                var containerJson = await containerResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
                creationId = containerJson.GetProperty("id").GetString();
            }
            else
            {
                var containerUrl = $"{baseUrl}/{userId}/media?caption={Uri.EscapeDataString(post.Content)}";
                using var containerResp = await client.PostAsync(containerUrl, null, ct);
                containerResp.EnsureSuccessStatusCode();
                var containerJson = await containerResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
                creationId = containerJson.GetProperty("id").GetString();
            }

            if (string.IsNullOrEmpty(creationId))
            {
                _logger.LogError("Instagram container response missing id");
                return PublishResult.Failed;
            }

            var publishUrl = $"{baseUrl}/{userId}/media_publish?creation_id={Uri.EscapeDataString(creationId!)}";
            using var publishResp = await client.PostAsync(publishUrl, null, ct);
            publishResp.EnsureSuccessStatusCode();
            string? externalId = null;
            var publishJson = await publishResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            if (publishJson.TryGetProperty("id", out var idEl))
                externalId = idEl.GetString();

            _logger.LogInformation("Instagram post published for post {PostId}", post.Id);
            return PublishResult.Ok(externalId);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Instagram HTTP error publishing post {PostId}", post.Id);
            return PublishResult.Failed;
        }
        catch (TaskCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Instagram error publishing post {PostId}", post.Id);
            return PublishResult.Failed;
        }
    }
}
