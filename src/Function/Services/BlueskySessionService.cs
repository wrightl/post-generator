using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PostGenerator.Function.Services;

/// <summary>
/// Caches Bluesky session (access JWT + DID) and refreshes before expiry to avoid creating a session per post.
/// </summary>
public class BlueskySessionService : IBlueskySessionService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<BlueskySessionService> _logger;

    private readonly object _lock = new();
    private string? _cachedAccessJwt;
    private string? _cachedDid;
    private DateTime _expiresAt;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(55);

    public BlueskySessionService(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<BlueskySessionService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<(string AccessJwt, string Did)?> GetSessionAsync(CancellationToken ct = default)
    {
        var handle = _config["Bluesky:Handle"];
        var appPassword = _config["Bluesky:AppPassword"];
        var pdsUrl = _config["Bluesky:PdsUrl"]?.TrimEnd('/') ?? "https://bsky.social";

        if (string.IsNullOrEmpty(handle) || string.IsNullOrEmpty(appPassword))
            return null;

        lock (_lock)
        {
            if (_cachedAccessJwt != null && _cachedDid != null && DateTime.UtcNow < _expiresAt)
                return (_cachedAccessJwt, _cachedDid);
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            var sessionUrl = $"{pdsUrl}/xrpc/com.atproto.server.createSession";
            var sessionBody = new { identifier = handle, password = appPassword };
            using var sessionResp = await client.PostAsJsonAsync(sessionUrl, sessionBody, ct);
            sessionResp.EnsureSuccessStatusCode();
            var sessionJson = await sessionResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var accessJwt = sessionJson.GetProperty("accessJwt").GetString();
            var did = sessionJson.GetProperty("did").GetString();
            if (string.IsNullOrEmpty(accessJwt) || string.IsNullOrEmpty(did))
            {
                _logger.LogError("Bluesky createSession response missing accessJwt or did");
                return null;
            }

            lock (_lock)
            {
                _cachedAccessJwt = accessJwt;
                _cachedDid = did;
                _expiresAt = DateTime.UtcNow.Add(CacheDuration);
            }

            return (accessJwt, did);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bluesky createSession failed");
            return null;
        }
    }
}
