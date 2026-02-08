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

    public async Task<PublishResult> PublishAsync(PostToPublish post, IReadOnlyDictionary<string, string>? credentials, CancellationToken ct = default)
    {
        var pdsUrl = (credentials != null && credentials.TryGetValue("PdsUrl", out var pds) ? pds : null) ?? _config["Bluesky:PdsUrl"]?.TrimEnd('/') ?? "https://bsky.social";
        (string AccessJwt, string Did)? session = null;
        if (credentials != null && credentials.TryGetValue("Handle", out var handle) && credentials.TryGetValue("AppPassword", out var appPassword) && !string.IsNullOrEmpty(handle) && !string.IsNullOrEmpty(appPassword))
            session = await CreateSessionAsync(pdsUrl, handle, appPassword, ct);
        if (session == null)
            session = await _sessionService.GetSessionAsync(ct);
        if (session == null)
        {
            _logger.LogWarning("Bluesky publisher skipped: no session (check Bluesky:Handle and Bluesky:AppPassword or per-user credentials)");
            return PublishResult.Failed;
        }

        var (accessJwt, did) = session.Value;

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
            string? externalId = null;
            var respBody = await recordResp.Content.ReadAsStringAsync(ct);
            if (!string.IsNullOrEmpty(respBody))
            {
                try
                {
                    var doc = JsonDocument.Parse(respBody);
                    if (doc.RootElement.TryGetProperty("uri", out var uriEl))
                        externalId = uriEl.GetString();
                }
                catch { /* ignore */ }
            }
            _logger.LogInformation("Bluesky post published for post {PostId}", post.Id);
            return PublishResult.Ok(externalId);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Bluesky HTTP error publishing post {PostId}", post.Id);
            return PublishResult.Failed;
        }
        catch (TaskCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bluesky error publishing post {PostId}", post.Id);
            return PublishResult.Failed;
        }
    }

    private async Task<(string AccessJwt, string Did)?> CreateSessionAsync(string pdsUrl, string handle, string appPassword, CancellationToken ct)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var sessionUrl = $"{pdsUrl.TrimEnd('/')}/xrpc/com.atproto.server.createSession";
            var sessionBody = new { identifier = handle, password = appPassword };
            using var sessionResp = await client.PostAsJsonAsync(sessionUrl, sessionBody, ct);
            sessionResp.EnsureSuccessStatusCode();
            var sessionJson = await sessionResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var accessJwt = sessionJson.GetProperty("accessJwt").GetString();
            var did = sessionJson.GetProperty("did").GetString();
            if (string.IsNullOrEmpty(accessJwt) || string.IsNullOrEmpty(did))
                return null;
            return (accessJwt, did);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bluesky createSession failed for per-user credentials");
            return null;
        }
    }
}
