using Microsoft.EntityFrameworkCore;
using PostGenerator.Api.Data;
using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Services;

public class PostService : IPostService
{
    private const int UpcomingTake = 10;

    private readonly AppDbContext _db;
    private readonly IImageService _imageService;

    public PostService(AppDbContext db, IImageService imageService)
    {
        _db = db;
        _imageService = imageService;
    }

    public async Task<(IReadOnlyList<PostDto> Items, int TotalCount)> ListAsync(int userId, IReadOnlyList<string>? platforms, IReadOnlyList<string>? statuses, DateTime? from, DateTime? to, int? skip = null, int? take = null, CancellationToken cancellationToken = default)
    {
        var q = _db.Posts.AsNoTracking().Where(p => p.UserId == userId);
        if (platforms is { Count: > 0 })
        {
            var platformSet = platforms
                .Select(s => Enum.TryParse<PostPlatform>(s, true, out var pl) ? pl : (PostPlatform?)null)
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .ToHashSet();
            if (platformSet.Count > 0)
                q = q.Where(p => platformSet.Contains(p.Platform));
        }
        if (statuses is { Count: > 0 })
        {
            var statusSet = statuses
                .Select(s => Enum.TryParse<PostStatus>(s, true, out var st) ? st : (PostStatus?)null)
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .ToHashSet();
            if (statusSet.Count > 0)
                q = q.Where(p => statusSet.Contains(p.Status));
        }
        if (from.HasValue) q = q.Where(p => p.ScheduledAt >= from || (p.ScheduledAt == null && p.CreatedAt >= from));
        if (to.HasValue) q = q.Where(p => p.ScheduledAt <= to);

        var ordered = q.OrderBy(p => p.ScheduledAt ?? DateTime.MaxValue).ThenBy(p => p.CreatedAt);
        var projected = ordered.Select(p => new PostDto(p.Id, p.UserId, p.TopicSummary, p.Platform.ToString(), p.Status.ToString(), p.ScheduledAt, p.PublishedAt, p.ExternalPostId, p.ViewsCount, p.LikesCount, p.CommentsCount, p.LastEngagementFetchedAt, p.Content, p.Script, p.ImageUrl, p.MetadataJson, p.Tone, p.Length, p.CreatedAt, p.UpdatedAt));

        int totalCount;
        List<PostDto> items;
        if (skip.HasValue || take.HasValue)
        {
            totalCount = await ordered.CountAsync(cancellationToken);
            var paged = projected;
            if (skip.HasValue) paged = paged.Skip(skip.Value);
            if (take.HasValue) paged = paged.Take(take.Value);
            items = await paged.ToListAsync(cancellationToken);
        }
        else
        {
            items = await projected.ToListAsync(cancellationToken);
            totalCount = items.Count;
        }
        return (items, totalCount);
    }

    public async Task<PostDto?> GetByIdAsync(int userId, int postId, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        return post == null ? null : PostMappings.ToDto(post);
    }

    public async Task<PostDto> CreateAsync(int userId, CreatePostRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<PostPlatform>(request.Platform, true, out var platform))
            throw new ArgumentException("Invalid platform", nameof(request));

        var post = new Post
        {
            UserId = userId,
            TopicSummary = request.TopicSummary ?? "",
            Platform = platform,
            Status = PostStatus.Draft,
            ScheduledAt = request.ScheduledAt,
            Content = request.Content ?? "",
            Script = request.Script,
            ImageUrl = request.ImageUrl,
            MetadataJson = request.MetadataJson,
            Tone = request.Tone,
            Length = request.Length,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.Posts.Add(post);
        await _db.SaveChangesAsync(cancellationToken);
        return PostMappings.ToDto(post);
    }

    public async Task<PostDto?> UpdateAsync(int userId, int postId, UpdatePostRequest request, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        if (post == null) return null;

        if (request.TopicSummary != null) post.TopicSummary = request.TopicSummary;
        if (request.Content != null) post.Content = request.Content;
        if (request.Script != null) post.Script = request.Script;
        if (request.ImageUrl != null) post.ImageUrl = request.ImageUrl;
        if (request.MetadataJson != null) post.MetadataJson = request.MetadataJson;
        if (request.Tone != null) post.Tone = request.Tone;
        if (request.Length != null) post.Length = request.Length;
        if (request.ScheduledAt.HasValue) post.ScheduledAt = request.ScheduledAt;
        if (request.Status != null && Enum.TryParse<PostStatus>(request.Status, true, out var st)) post.Status = st;
        post.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return PostMappings.ToDto(post);
    }

    public async Task<bool> DeleteAsync(int userId, int postId, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        if (post == null) return false;
        _db.Posts.Remove(post);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    // public async Task<PostDto?> GenerateImageAsync(int userId, int postId, string? prompt, CancellationToken cancellationToken = default)
    // {
    //     var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
    //     if (post == null) return null;

    //     var effectivePrompt = !string.IsNullOrWhiteSpace(prompt)
    //         ? prompt
    //         : $"Social media image for post: {post.Content[..Math.Min(500, post.Content.Length)]}";
    //     var imageUrl = await _imageService.GenerateAndUploadAsync(effectivePrompt, $"post-{post.Id}-{Guid.NewGuid():N}.png", cancellationToken);
    //     if (imageUrl == null) return null;

    //     post.ImageUrl = imageUrl;
    //     post.UpdatedAt = DateTime.UtcNow;
    //     await _db.SaveChangesAsync(cancellationToken);
    //     return PostMappings.ToDto(post);
    // }

    public async Task<PostDto?> SetPostImageUrlAsync(int userId, int postId, string? imageUrl, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        if (post == null) return null;

        post.ImageUrl = imageUrl;
        post.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return PostMappings.ToDto(post);
    }

    public async Task<PostDto?> PublishNowAsync(int userId, int postId, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        if (post == null || post.Status != PostStatus.Draft) return null;

        post.Status = PostStatus.Published;
        post.PublishedAt = DateTime.UtcNow;
        post.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return PostMappings.ToDto(post);
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync(int userId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var baseQ = _db.Posts.AsNoTracking().Where(p => p.UserId == userId);

        var total = await baseQ.CountAsync(cancellationToken);
        var draftCount = await baseQ.CountAsync(p => p.Status == PostStatus.Draft, cancellationToken);
        var scheduledCount = await baseQ.CountAsync(p => p.Status == PostStatus.Scheduled, cancellationToken);
        var publishedCount = await baseQ.CountAsync(p => p.Status == PostStatus.Published, cancellationToken);
        var failedCount = await baseQ.CountAsync(p => p.Status == PostStatus.Failed, cancellationToken);

        var byPlatformRows = await baseQ
            .GroupBy(p => p.Platform)
            .Select(g => new { Platform = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToListAsync(cancellationToken);
        var byPlatform = byPlatformRows.Select(x => new PostsByPlatformDto(x.Platform.ToString(), x.Count)).ToList();

        var upcomingPosts = await baseQ
            .Where(p => p.Status == PostStatus.Scheduled && p.ScheduledAt != null && p.ScheduledAt >= now)
            .OrderBy(p => p.ScheduledAt)
            .Take(UpcomingTake)
            .Select(p => new UpcomingPostDto(p.Id, p.Platform.ToString(), p.ScheduledAt!.Value, p.TopicSummary))
            .ToListAsync(cancellationToken);

        var mostRecentPublished = await baseQ
            .Where(p => p.Status == PostStatus.Published && p.PublishedAt != null)
            .OrderByDescending(p => p.PublishedAt)
            .Select(p => new PostDto(p.Id, p.UserId, p.TopicSummary, p.Platform.ToString(), p.Status.ToString(), p.ScheduledAt, p.PublishedAt, p.ExternalPostId, p.ViewsCount, p.LikesCount, p.CommentsCount, p.LastEngagementFetchedAt, p.Content, p.Script, p.ImageUrl, p.MetadataJson, p.Tone, p.Length, p.CreatedAt, p.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);

        return new DashboardStatsDto(
            total,
            draftCount,
            scheduledCount,
            publishedCount,
            failedCount,
            byPlatform,
            upcomingPosts,
            mostRecentPublished);
    }
}
