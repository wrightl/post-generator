namespace PostGenerator.Api.Models;

public record DashboardStatsDto(
    int TotalPosts,
    int DraftCount,
    int ScheduledCount,
    int PublishedCount,
    int FailedCount,
    IReadOnlyList<PostsByPlatformDto> ByPlatform,
    IReadOnlyList<UpcomingPostDto> UpcomingPosts,
    PostDto? MostRecentPublished);

public record PostsByPlatformDto(string Platform, int Count);

public record UpcomingPostDto(int Id, string Platform, DateTime ScheduledAt, string TopicSummary);
