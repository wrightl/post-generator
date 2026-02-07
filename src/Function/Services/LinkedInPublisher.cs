using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;

namespace PostGenerator.Function.Services;

public class LinkedInPublisher : IPostPublisher
{
    public PostPlatform Platform => PostPlatform.LinkedIn;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<LinkedInPublisher> _logger;

    public LinkedInPublisher(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<LinkedInPublisher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;
    }

    public async Task<bool> PublishAsync(PostToPublish post, CancellationToken ct = default)
    {
        var accessToken = _config["LinkedIn:AccessToken"];
        var personUrn = _config["LinkedIn:PersonUrn"];

        if (string.IsNullOrEmpty(accessToken))
        {
            _logger.LogWarning("LinkedIn publisher skipped: LinkedIn:AccessToken not configured");
            return false;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            client.DefaultRequestHeaders.Add("X-Restli-Protocol-Version", "2.0.0");

            if (string.IsNullOrEmpty(personUrn))
            {
                var meResp = await client.GetAsync("https://api.linkedin.com/v2/me", ct);
                meResp.EnsureSuccessStatusCode();
                var meJson = await meResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
                personUrn = meJson.GetProperty("id").GetString();
                if (string.IsNullOrEmpty(personUrn))
                {
                    _logger.LogError("LinkedIn /me response missing id");
                    return false;
                }
            }

            string? mediaUrn = null;
            if (!string.IsNullOrEmpty(post.ImageUrl))
            {
                mediaUrn = await UploadImageAsync(client, personUrn!, post.ImageUrl, ct);
                if (mediaUrn == null)
                    _logger.LogWarning("LinkedIn image upload failed, posting text only");
            }

            object mediaArray = mediaUrn != null
                ? new[] { new Dictionary<string, object> { ["media"] = mediaUrn, ["status"] = "READY", ["title"] = new Dictionary<string, object> { ["attributes"] = Array.Empty<object>(), ["text"] = "Image" } } }
                : Array.Empty<object>();

            var shareContent = new Dictionary<string, object>
            {
                ["shareCommentary"] = new Dictionary<string, object> { ["attributes"] = Array.Empty<object>(), ["text"] = post.Content ?? "" },
                ["shareMediaCategory"] = mediaUrn != null ? "IMAGE" : "NONE",
                ["media"] = mediaArray
            };

            var body = new Dictionary<string, object>
            {
                ["author"] = personUrn!,
                ["lifecycleState"] = "PUBLISHED",
                ["visibility"] = new Dictionary<string, object> { ["com.linkedin.ugc.MemberNetworkVisibility"] = "PUBLIC" },
                ["specificContent"] = new Dictionary<string, object> { ["com.linkedin.ugc.ShareContent"] = shareContent }
            };

            var json = JsonSerializer.Serialize(body);
            using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.linkedin.com/v2/ugcPosts");
            req.Content = new StringContent(json, Encoding.UTF8, "application/json");
            using var resp = await client.SendAsync(req, ct);
            resp.EnsureSuccessStatusCode();
            _logger.LogInformation("LinkedIn post published for post {PostId}", post.Id);
            return true;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "LinkedIn HTTP error publishing post {PostId}", post.Id);
            return false;
        }
        catch (TaskCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "LinkedIn error publishing post {PostId}", post.Id);
            return false;
        }
    }

    private async Task<string?> UploadImageAsync(HttpClient client, string ownerUrn, string imageUrl, CancellationToken ct)
    {
        try
        {
            var registerBody = new Dictionary<string, object>
            {
                ["registerUploadRequest"] = new Dictionary<string, object>
                {
                    ["recipes"] = new[] { "urn:li:digitalmediaRecipe:feedshare-image" },
                    ["owner"] = ownerUrn,
                    ["serviceRelationships"] = new[] { new Dictionary<string, string> { ["relationshipType"] = "OWNER", ["identifier"] = "urn:li:userGeneratedContent" } }
                }
            };
            using var registerResp = await client.PostAsJsonAsync("https://api.linkedin.com/v2/assets?action=registerUpload", registerBody, ct);
            registerResp.EnsureSuccessStatusCode();
            var registerJson = await registerResp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var uploadMechanism = registerJson.GetProperty("value").GetProperty("uploadMechanism");
            var uploadUrl = uploadMechanism.GetProperty("com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest").GetProperty("uploadUrl").GetString();
            var asset = registerJson.GetProperty("value").GetProperty("asset").GetString();
            if (string.IsNullOrEmpty(uploadUrl) || string.IsNullOrEmpty(asset))
                return null;

            var imageBytes = await client.GetByteArrayAsync(imageUrl, ct);
            using var uploadReq = new HttpRequestMessage(HttpMethod.Put, uploadUrl) { Content = new ByteArrayContent(imageBytes) };
            uploadReq.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            using var uploadResp = await client.SendAsync(uploadReq, ct);
            uploadResp.EnsureSuccessStatusCode();
            return asset;
        }
        catch
        {
            return null;
        }
    }
}
