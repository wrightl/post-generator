namespace PostGenerator.Api.Models;

public record GenerateSeriesRequest(
    string TopicDetail,
    int NumPosts,
    string Platform,
    bool Linked = false,
    string? Tone = null,
    string? Length = null,
    bool GenerateImages = false,
    int? TikTokScriptDurationSeconds = null,
    DateTime? StartDate = null,
    string? Recurrence = null,
    string? ScheduledTimeOfDay = null);
