using System.Net.Http;
using System.Text.Json;
using Azure;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class PostGenerationService : IPostGenerationService
{
    private readonly IAzureOpenAIClientProvider _clientProvider;
    private readonly AzureOpenAIOptions _options;
    private readonly ILogger<PostGenerationService> _logger;

    public PostGenerationService(
        IAzureOpenAIClientProvider clientProvider,
        IOptions<AzureOpenAIOptions> options,
        ILogger<PostGenerationService> logger)
    {
        _clientProvider = clientProvider;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<GeneratedPostItem>> GeneratePostsAsync(GeneratePostOptions options, CancellationToken cancellationToken = default)
    {
        var platformNote = options.Platform.Equals("TikTok", StringComparison.OrdinalIgnoreCase) && options.TikTokScriptDurationSeconds.HasValue
            ? $" Each post must include a script suitable for a {options.TikTokScriptDurationSeconds} second video (approx {options.TikTokScriptDurationSeconds * 2} words)."
            : "";

        var systemPrompt = "You are a social media content writer. Generate posts as JSON. For each post return exactly: \"content\" (the post text), \"script\" (only for TikTok, the video script), \"hashtags\" (JSON array of hashtag strings). Be concise and match the requested tone and length.";
        var userPrompt = $"Generate {options.NumPosts} {(options.Linked ? "linked" : "standalone")} posts for platform: {options.Platform}. Topic: {options.TopicDetail}. Tone: {options.Tone ?? "professional"}. Length: {options.Length ?? "medium"}.{platformNote} Return a JSON array of objects, each with \"content\", \"script\" (optional), \"hashtags\" (array of strings). No markdown, only the raw JSON array.";

        var content = await CallChatCompletionAsync(systemPrompt, userPrompt, 4000, cancellationToken);
        if (content == null) return Array.Empty<GeneratedPostItem>();

        return ParseContentAsPostItems(content);
    }

    public async Task<GeneratedPostItem?> GenerateSinglePostAsync(GeneratePostOptions options, int index, IReadOnlyList<string>? previousContents, CancellationToken cancellationToken = default)
    {
        var platformNote = options.Platform.Equals("TikTok", StringComparison.OrdinalIgnoreCase) && options.TikTokScriptDurationSeconds.HasValue
            ? $" The post must include a script suitable for a {options.TikTokScriptDurationSeconds} second video (approx {options.TikTokScriptDurationSeconds * 2} words)."
            : "";

        var linkedContext = options.Linked && previousContents is { Count: > 0 }
            ? $" Previous posts in this series (for continuity): {string.Join(" | ", previousContents)}. Write the next post that follows naturally."
            : "";

        var systemPrompt = "You are a social media content writer. Generate a single post as JSON. Return exactly one object with: \"content\" (the post text), \"script\" (only for TikTok, the video script), \"hashtags\" (JSON array of hashtag strings). Be concise and match the requested tone and length. No markdown, only the raw JSON object.";
        var userPrompt = $"Generate post {index} of {options.NumPosts} for platform: {options.Platform}. Topic: {options.TopicDetail}. Tone: {options.Tone ?? "professional"}. Length: {options.Length ?? "medium"}.{platformNote}{linkedContext} Return a single JSON object with \"content\", \"script\" (optional), \"hashtags\" (array of strings).";

        var content = await CallChatCompletionAsync(systemPrompt, userPrompt, 2000, cancellationToken);
        if (content == null) return null;

        return ParseContentAsSinglePostItem(content);
    }

    private async Task<string?> CallChatCompletionAsync(string systemPrompt, string userPrompt, int maxTokens, CancellationToken cancellationToken)
    {
        var azureClient = _clientProvider.GetChatClient();
        if (azureClient == null)
            return null;

        var chatClient = azureClient.GetChatClient(_options.ChatDeploymentName);
        var messages = new ChatMessage[]
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(userPrompt),
        };
        var completionOptions = new ChatCompletionOptions
        {
            MaxOutputTokenCount = maxTokens,
            Temperature = 0.7f,
        };

        try
        {
            var completion = await chatClient.CompleteChatAsync(messages, completionOptions, cancellationToken);
            var content = completion.Value.Content;
            if (content == null || content.Count == 0)
                return null;
            var result = string.Concat(content
                .Where(p => p.Kind == ChatMessageContentPartKind.Text && p.Text != null)
                .Select(p => p.Text));
            return StripMarkdown(result.Trim());
        }
        catch (RequestFailedException ex)
        {
            throw new HttpRequestException($"Azure OpenAI returned {ex.Status} {ex.Message}. {ex.ErrorCode}", ex);
        }
    }

    private static string StripMarkdown(string content)
    {
        if (content.StartsWith("```"))
            content = content.Replace("```json", "").Replace("```", "").Trim();
        return content;
    }

    private List<GeneratedPostItem> ParseContentAsPostItems(string content)
    {
        try
        {
            var items = JsonSerializer.Deserialize<JsonElement[]>(content);
            if (items == null) return new List<GeneratedPostItem>();
            var list = new List<GeneratedPostItem>();
            foreach (var item in items)
                list.Add(ParsePostItem(item));
            return list;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Azure OpenAI response as JSON array, using raw content as single post");
            return new List<GeneratedPostItem> { new GeneratedPostItem(content, null, null) };
        }
    }

    private GeneratedPostItem ParseContentAsSinglePostItem(string content)
    {
        try
        {
            var item = JsonSerializer.Deserialize<JsonElement>(content);
            return ParsePostItem(item);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse Azure OpenAI response as JSON object, using raw content");
            return new GeneratedPostItem(content, null, null);
        }
    }

    private static GeneratedPostItem ParsePostItem(JsonElement item)
    {
        var postContent = item.TryGetProperty("content", out var c) ? c.GetString() ?? "" : "";
        var script = item.TryGetProperty("script", out var s) ? s.GetString() : null;
        string? hashtagsJson = null;
        if (item.TryGetProperty("hashtags", out var h) && h.ValueKind == JsonValueKind.Array)
            hashtagsJson = h.GetRawText();
        return new GeneratedPostItem(postContent, script, hashtagsJson);
    }
}
