using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;

namespace PostGenerator.Function.Services;

public class BlueskyPublisher : IPostPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IBlueskySessionService _sessionService;
    private readonly IConfiguration _config;
    private readonly ILogger<BlueskyPublisher> _logger;

    public PostPlatform Platform => PostPlatform.Bluesky;

    public BlueskyPublisher(
        IHttpClientFactory httpClientFactory,
        IBlueskySessionService sessionService,
        IConfiguration config,
        ILogger<BlueskyPublisher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _sessionService = sessionService;
        _config = config;
        _logger = logger;
    }

    public async Task<bool> PublishAsync(PostToPublish post, CancellationToken ct = default)
    {
        var session = await _sessionService.GetSessionAsync(ct);
        if (session == null)
        {
            _logger.LogWarning("Bluesky publisher skipped: no session (check Bluesky:Handle and Bluesky:AppPassword)");
            return false;
        }

        var (accessJwt, did) = session.Value;
        var pdsUrl = _config["Bluesky:PdsUrl"]?.TrimEnd('/') ?? "https://bsky.social";

        try
        {
            var client = _httpClientFactory.CreateClient();
            var recordUrl = $"{pdsUrl}/xrpc/com.atproto.repo.createRecord";
            var createdAt = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            var recordBody = new
            {
                repo = did,
                collection = "app.bsky.feed.post",
                record = new { text = post.Content, createdAt }
            };
            using var req = new HttpRequestMessage(HttpMethod.Post, recordUrl);
            req.Headers.Add("Authorization", "Bearer " + accessJwt);
            req.Content = JsonContent.Create(recordBody);
            using var recordResp = await client.SendAsync(req, ct);
            recordResp.EnsureSuccessStatusCode();
            _logger.LogInformation("Bluesky post published for post {PostId}", post.Id);
            return true;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Bluesky HTTP error publishing post {PostId}", post.Id);
            return false;
        }
        catch (TaskCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bluesky error publishing post {PostId}", post.Id);
            return false;
        }
    }
}
