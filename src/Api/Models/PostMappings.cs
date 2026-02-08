using PostGenerator.Api.Data;

namespace PostGenerator.Api.Models;

public static class PostMappings
{
    public static PostDto ToDto(Post p) => new(
        p.Id,
        p.UserId,
        p.TopicSummary,
        p.Platform.ToString(),
        p.Status.ToString(),
        p.ScheduledAt,
        p.PublishedAt,
        p.ExternalPostId,
        p.ViewsCount,
        p.LikesCount,
        p.CommentsCount,
        p.LastEngagementFetchedAt,
        p.Content,
        p.Script,
        p.ImageUrl,
        p.MetadataJson,
        p.Tone,
        p.Length,
        p.CreatedAt,
        p.UpdatedAt);
}
