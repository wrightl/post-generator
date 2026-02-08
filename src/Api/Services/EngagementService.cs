using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PostGenerator.Api.Data;
using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Services;

public class EngagementService : IEngagementService
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<EngagementService> _logger;

    public EngagementService(AppDbContext db, IHttpClientFactory httpClientFactory, ILogger<EngagementService> logger)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<PostDto?> RefreshEngagementAsync(int userId, int postId, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        if (post == null) return null;
        if (string.IsNullOrEmpty(post.ExternalPostId))
        {
            _logger.LogDebug("Post {PostId} has no ExternalPostId, cannot refresh engagement", postId);
            return null;
        }

        var cred = await _db.UserSocialCredentials
            .AsNoTracking()
            .Where(c => c.UserId == userId && c.Platform == post.Platform.ToString())
            .Select(c => c.CredentialJson)
            .FirstOrDefaultAsync(cancellationToken);
        if (string.IsNullOrEmpty(cred))
        {
            _logger.LogDebug("No credentials for user {UserId} platform {Platform}", userId, post.Platform);
            return null;
        }
        Dictionary<string, string>? credentials;
        try
        {
            credentials = JsonSerializer.Deserialize<Dictionary<string, string>>(cred);
        }
        catch
        {
            return null;
        }
        if (credentials == null || credentials.Count == 0) return null;

        int? views = null, likes = null, comments = null;
        try
        {
            switch (post.Platform)
            {
                case PostPlatform.Facebook:
                    (views, likes, comments) = await FetchFacebookEngagementAsync(post.ExternalPostId, credentials, cancellationToken);
                    break;
                case PostPlatform.Instagram:
                    (views, likes, comments) = await FetchInstagramEngagementAsync(post.ExternalPostId, credentials, cancellationToken);
                    break;
                case PostPlatform.Bluesky:
                    (views, likes, comments) = await FetchBlueskyEngagementAsync(post.ExternalPostId, credentials, cancellationToken);
                    break;
                case PostPlatform.LinkedIn:
                case PostPlatform.TikTok:
                case PostPlatform.Skool:
                    _logger.LogDebug("Engagement refresh not supported for platform {Platform}", post.Platform);
                    return null;
                default:
                    return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Engagement fetch failed for post {PostId} platform {Platform}", postId, post.Platform);
            return null;
        }

        post.ViewsCount = views ?? post.ViewsCount;
        post.LikesCount = likes ?? post.LikesCount;
        post.CommentsCount = comments ?? post.CommentsCount;
        post.LastEngagementFetchedAt = DateTime.UtcNow;
        post.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return PostMappings.ToDto(post);
    }

    private async Task<(int? Views, int? Likes, int? Comments)> FetchFacebookEngagementAsync(string postId, IReadOnlyDictionary<string, string> credentials, CancellationToken ct)
    {
        var token = credentials.TryGetValue("PageAccessToken", out var t) ? t : null;
        if (string.IsNullOrEmpty(token)) return (null, null, null);

        var client = _httpClientFactory.CreateClient();
        var url = $"https://graph.facebook.com/v21.0/{Uri.EscapeDataString(postId)}?fields=likes.summary(true),comments.summary(true)&access_token={Uri.EscapeDataString(token)}";
        using var resp = await client.GetAsync(url, ct);
        resp.EnsureSuccessStatusCode();
        var doc = await resp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        var likes = doc.TryGetProperty("likes", out var likesEl) && likesEl.TryGetProperty("summary", out var likesSum) && likesSum.TryGetProperty("total_count", out var lc) ? lc.GetInt32() : (int?)null;
        var comments = doc.TryGetProperty("comments", out var commentsEl) && commentsEl.TryGetProperty("summary", out var commentsSum) && commentsSum.TryGetProperty("total_count", out var cc) ? cc.GetInt32() : (int?)null;

        int? views = null;
        var insightsUrl = $"https://graph.facebook.com/v21.0/{Uri.EscapeDataString(postId)}/insights?metric=post_impressions&access_token={Uri.EscapeDataString(token)}";
        using var insightsResp = await client.GetAsync(insightsUrl, ct);
        if (insightsResp.IsSuccessStatusCode)
        {
            var insights = await insightsResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            if (insights.TryGetProperty("data", out var data) && data.GetArrayLength() > 0)
            {
                var first = data[0];
                if (first.TryGetProperty("values", out var values) && values.GetArrayLength() > 0 && values[0].TryGetProperty("value", out var v))
                    views = v.GetInt32();
            }
        }
        return (views, likes, comments);
    }

    private async Task<(int? Views, int? Likes, int? Comments)> FetchInstagramEngagementAsync(string mediaId, IReadOnlyDictionary<string, string> credentials, CancellationToken ct)
    {
        var token = credentials.TryGetValue("AccessToken", out var at) ? at : null;
        if (string.IsNullOrEmpty(token)) return (null, null, null);

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer " + token);
        var url = $"https://graph.facebook.com/v21.0/{Uri.EscapeDataString(mediaId)}/insights?metric=engagement,impressions,reach";
        using var resp = await client.GetAsync(url, ct);
        resp.EnsureSuccessStatusCode();
        var doc = await resp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        int? views = null, likes = null, comments = null;
        if (doc.TryGetProperty("data", out var data))
        {
            foreach (var item in data.EnumerateArray())
            {
                if (!item.TryGetProperty("name", out var nameEl) || !item.TryGetProperty("values", out var values) || values.GetArrayLength() == 0) continue;
                var value = values[0].TryGetProperty("value", out var v) ? v.GetInt32() : 0;
                switch (nameEl.GetString())
                {
                    case "impressions": views = value; break;
                    case "engagement": likes = value; break;
                    case "reach": if (!views.HasValue) views = value; break;
                }
            }
        }
        return (views, likes, comments);
    }

    private async Task<(int? Views, int? Likes, int? Comments)> FetchBlueskyEngagementAsync(string postUri, IReadOnlyDictionary<string, string> credentials, CancellationToken ct)
    {
        var handle = credentials.TryGetValue("Handle", out var h) ? h : null;
        var appPassword = credentials.TryGetValue("AppPassword", out var p) ? p : null;
        var pdsUrl = (credentials.TryGetValue("PdsUrl", out var u) ? u : null)?.TrimEnd('/') ?? "https://bsky.social";
        if (string.IsNullOrEmpty(handle) || string.IsNullOrEmpty(appPassword)) return (null, null, null);

        var client = _httpClientFactory.CreateClient();
        var sessionUrl = $"{pdsUrl}/xrpc/com.atproto.server.createSession";
        var sessionBody = new { identifier = handle, password = appPassword };
        using var sessionResp = await client.PostAsJsonAsync(sessionUrl, sessionBody, ct);
        sessionResp.EnsureSuccessStatusCode();
        var sessionJson = await sessionResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        var accessJwt = sessionJson.GetProperty("accessJwt").GetString();
        if (string.IsNullOrEmpty(accessJwt)) return (null, null, null);

        const int maxPages = 10;
        int likeCount = 0;
        string? cursor = null;
        var pageCount = 0;
        do
        {
            if (++pageCount > maxPages) break;
            var likesUrl = $"{pdsUrl}/xrpc/app.bsky.feed.getLikes?uri={Uri.EscapeDataString(postUri)}&limit=100";
            if (!string.IsNullOrEmpty(cursor)) likesUrl += "&cursor=" + Uri.EscapeDataString(cursor);
            using var request = new HttpRequestMessage(HttpMethod.Get, likesUrl);
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessJwt);
            using var likesResp = await client.SendAsync(request, ct);
            likesResp.EnsureSuccessStatusCode();
            var likesJson = await likesResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            if (likesJson.TryGetProperty("likes", out var likes))
                likeCount += likes.GetArrayLength();
            cursor = likesJson.TryGetProperty("cursor", out var c) ? c.GetString() : null;
        } while (!string.IsNullOrEmpty(cursor));

        return (null, likeCount, null);
    }
}
