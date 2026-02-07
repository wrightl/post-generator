using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class PostGenerationService : IPostGenerationService
{
    private readonly AzureOpenAIOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;

    public PostGenerationService(IOptions<AzureOpenAIOptions> options, IHttpClientFactory httpClientFactory)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<IReadOnlyList<GeneratedPostItem>> GeneratePostsAsync(GeneratePostOptions options, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_options.Endpoint) || string.IsNullOrEmpty(_options.ApiKey))
            return Array.Empty<GeneratedPostItem>();

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("api-key", _options.ApiKey);

        var platformNote = options.Platform.Equals("TikTok", StringComparison.OrdinalIgnoreCase) && options.TikTokScriptDurationSeconds.HasValue
            ? $" Each post must include a script suitable for a {options.TikTokScriptDurationSeconds} second video (approx {options.TikTokScriptDurationSeconds * 2} words)."
            : "";

        var systemPrompt = "You are a social media content writer. Generate posts as JSON. For each post return exactly: \"content\" (the post text), \"script\" (only for TikTok, the video script), \"hashtags\" (JSON array of hashtag strings). Be concise and match the requested tone and length.";
        var userPrompt = $"Generate {options.NumPosts} {(options.Linked ? "linked" : "standalone")} posts for platform: {options.Platform}. Topic: {options.TopicDetail}. Tone: {options.Tone ?? "professional"}. Length: {options.Length ?? "medium"}.{platformNote} Return a JSON array of objects, each with \"content\", \"script\" (optional), \"hashtags\" (array of strings). No markdown, only the raw JSON array.";

        var url = $"{_options.Endpoint.TrimEnd('/')}/openai/deployments/{Uri.EscapeDataString(_options.ChatDeploymentName)}/chat/completions?api-version=2024-08-01-preview";
        var body = new
        {
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt },
            },
            max_tokens = 4000,
            temperature = 0.7,
        };

        var response = await client.PostAsJsonAsync(url, body, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Azure OpenAI returned {(int)response.StatusCode} {response.ReasonPhrase}. {responseBody}");
        var json = JsonSerializer.Deserialize<JsonElement>(responseBody);
        var choice = json.GetProperty("choices")[0];
        var content = choice.GetProperty("message").GetProperty("content").GetString()?.Trim() ?? "";

        if (content.StartsWith("```")) content = content.Replace("```json", "").Replace("```", "").Trim();

        var list = new List<GeneratedPostItem>();
        try
        {
            var items = JsonSerializer.Deserialize<JsonElement[]>(content);
            if (items == null) return list;
            foreach (var item in items)
            {
                var postContent = item.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "";
                var script = item.TryGetProperty("script", out var s) ? s.GetString() : null;
                string? hashtagsJson = null;
                if (item.TryGetProperty("hashtags", out var h) && h.ValueKind == JsonValueKind.Array)
                    hashtagsJson = h.GetRawText();
                list.Add(new GeneratedPostItem(postContent, script, hashtagsJson));
            }
        }
        catch
        {
            list.Add(new GeneratedPostItem(content, null, null));
        }
        return list;
    }

    public async Task<GeneratedPostItem?> GenerateSinglePostAsync(GeneratePostOptions options, int index, IReadOnlyList<string>? previousContents, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_options.Endpoint) || string.IsNullOrEmpty(_options.ApiKey))
            return null;

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("api-key", _options.ApiKey);

        var platformNote = options.Platform.Equals("TikTok", StringComparison.OrdinalIgnoreCase) && options.TikTokScriptDurationSeconds.HasValue
            ? $" The post must include a script suitable for a {options.TikTokScriptDurationSeconds} second video (approx {options.TikTokScriptDurationSeconds * 2} words)."
            : "";

        var linkedContext = options.Linked && previousContents is { Count: > 0 }
            ? $" Previous posts in this series (for continuity): {string.Join(" | ", previousContents)}. Write the next post that follows naturally."
            : "";

        var systemPrompt = "You are a social media content writer. Generate a single post as JSON. Return exactly one object with: \"content\" (the post text), \"script\" (only for TikTok, the video script), \"hashtags\" (JSON array of hashtag strings). Be concise and match the requested tone and length. No markdown, only the raw JSON object.";
        var userPrompt = $"Generate post {index} of {options.NumPosts} for platform: {options.Platform}. Topic: {options.TopicDetail}. Tone: {options.Tone ?? "professional"}. Length: {options.Length ?? "medium"}.{platformNote}{linkedContext} Return a single JSON object with \"content\", \"script\" (optional), \"hashtags\" (array of strings).";

        var url = $"{_options.Endpoint.TrimEnd('/')}/openai/deployments/{Uri.EscapeDataString(_options.ChatDeploymentName)}/chat/completions?api-version=2024-08-01-preview";
        var body = new
        {
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt },
            },
            max_tokens = 2000,
            temperature = 0.7,
        };

        var response = await client.PostAsJsonAsync(url, body, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Azure OpenAI returned {(int)response.StatusCode} {response.ReasonPhrase}. {responseBody}");
        var json = JsonSerializer.Deserialize<JsonElement>(responseBody);
        var choice = json.GetProperty("choices")[0];
        var content = choice.GetProperty("message").GetProperty("content").GetString()?.Trim() ?? "";

        if (content.StartsWith("```")) content = content.Replace("```json", "").Replace("```", "").Trim();

        try
        {
            var item = JsonSerializer.Deserialize<JsonElement>(content);
            var postContent = item.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "";
            var script = item.TryGetProperty("script", out var s) ? s.GetString() : null;
            string? hashtagsJson = null;
            if (item.TryGetProperty("hashtags", out var h) && h.ValueKind == JsonValueKind.Array)
                hashtagsJson = h.GetRawText();
            return new GeneratedPostItem(postContent, script, hashtagsJson);
        }
        catch
        {
            return new GeneratedPostItem(content, null, null);
        }
    }
}
