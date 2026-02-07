namespace PostGenerator.Api.Services;

public record GeneratePostOptions(
    string TopicDetail,
    int NumPosts,
    string Platform,
    bool Linked,
    string? Tone,
    string? Length,
    int? TikTokScriptDurationSeconds);

public record GeneratedPostItem(string Content, string? Script, string? HashtagsJson);

public interface IPostGenerationService
{
    Task<IReadOnlyList<GeneratedPostItem>> GeneratePostsAsync(GeneratePostOptions options, CancellationToken cancellationToken = default);
}
