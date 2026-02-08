namespace PostGenerator.Api.Models;

/// <summary>Request to persist a previously generated series and its posts (from the stream).</summary>
public record PublishGeneratedSeriesRequest(
    string TopicDetail,
    int NumPosts,
    string Platform,
    IReadOnlyList<GeneratedPostItemDto> GeneratedPosts,
    bool Linked = false,
    string? Tone = null,
    string? Length = null,
    bool GenerateImages = false,
    int? TikTokScriptDurationSeconds = null,
    DateTime? StartDate = null,
    string? Recurrence = null,
    string? ScheduledTimeOfDay = null);

/// <summary>One generated post (content only); schedule is computed server-side from series options and index.</summary>
public record GeneratedPostItemDto(
    string Content,
    string? Script = null,
    string? MetadataJson = null,
    string? ImageUrl = null);
