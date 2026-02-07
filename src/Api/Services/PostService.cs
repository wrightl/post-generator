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

    public async Task<IReadOnlyList<PostDto>> ListAsync(int userId, PostPlatform? platform, PostStatus? status, DateTime? from, DateTime? to, CancellationToken cancellationToken = default)
    {
        var q = _db.Posts.AsNoTracking().Where(p => p.UserId == userId);
        if (platform.HasValue) q = q.Where(p => p.Platform == platform.Value);
        if (status.HasValue) q = q.Where(p => p.Status == status.Value);
        if (from.HasValue) q = q.Where(p => p.ScheduledAt >= from || (p.ScheduledAt == null && p.CreatedAt >= from));
        if (to.HasValue) q = q.Where(p => p.ScheduledAt <= to);
        return await q
            .OrderBy(p => p.ScheduledAt ?? DateTime.MaxValue)
            .ThenBy(p => p.CreatedAt)
            .Select(p => new PostDto(p.Id, p.UserId, p.TopicSummary, p.Platform.ToString(), p.Status.ToString(), p.ScheduledAt, p.PublishedAt, p.Content, p.Script, p.ImageUrl, p.MetadataJson, p.Tone, p.Length, p.CreatedAt, p.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<PostDto?> GetByIdAsync(int userId, int postId, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        return post == null ? null : ToDto(post);
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
        return ToDto(post);
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
        return ToDto(post);
    }

    public async Task<bool> DeleteAsync(int userId, int postId, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        if (post == null) return false;
        _db.Posts.Remove(post);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PostDto?> GenerateImageAsync(int userId, int postId, string? prompt, CancellationToken cancellationToken = default)
    {
        var post = await _db.Posts.FirstOrDefaultAsync(p => p.Id == postId && p.UserId == userId, cancellationToken);
        if (post == null) return null;

        var effectivePrompt = !string.IsNullOrWhiteSpace(prompt)
            ? prompt
            : $"Social media image for post: {post.Content[..Math.Min(500, post.Content.Length)]}";
        var imageUrl = await _imageService.GenerateAndUploadAsync(effectivePrompt, $"post-{post.Id}-{Guid.NewGuid():N}.png", cancellationToken);
        if (imageUrl == null) return null;

        post.ImageUrl = imageUrl;
        post.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(post);
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync(int userId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var posts = await _db.Posts.AsNoTracking().Where(p => p.UserId == userId).ToListAsync(cancellationToken);

        var total = posts.Count;
        var draftCount = posts.Count(p => p.Status == PostStatus.Draft);
        var scheduledCount = posts.Count(p => p.Status == PostStatus.Scheduled);
        var publishedCount = posts.Count(p => p.Status == PostStatus.Published);
        var failedCount = posts.Count(p => p.Status == PostStatus.Failed);

        var byPlatform = posts
            .GroupBy(p => p.Platform.ToString())
            .Select(g => new PostsByPlatformDto(g.Key, g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();

        var upcomingPosts = posts
            .Where(p => p.Status == PostStatus.Scheduled && p.ScheduledAt.HasValue && p.ScheduledAt.Value >= now)
            .OrderBy(p => p.ScheduledAt)
            .Take(UpcomingTake)
            .Select(p => new UpcomingPostDto(p.Id, p.Platform.ToString(), p.ScheduledAt!.Value, p.TopicSummary))
            .ToList();

        var mostRecentPublished = posts
            .Where(p => p.Status == PostStatus.Published && p.PublishedAt.HasValue)
            .OrderByDescending(p => p.PublishedAt)
            .FirstOrDefault();

        return new DashboardStatsDto(
            total,
            draftCount,
            scheduledCount,
            publishedCount,
            failedCount,
            byPlatform,
            upcomingPosts,
            mostRecentPublished == null ? null : ToDto(mostRecentPublished));
    }

    private static PostDto ToDto(Post p) => new(p.Id, p.UserId, p.TopicSummary, p.Platform.ToString(), p.Status.ToString(), p.ScheduledAt, p.PublishedAt, p.Content, p.Script, p.ImageUrl, p.MetadataJson, p.Tone, p.Length, p.CreatedAt, p.UpdatedAt);
}
