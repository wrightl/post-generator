using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PostGenerator.Api.Data;
using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Services;

public class SeriesService : ISeriesService
{
    private readonly AppDbContext _db;
    private readonly IPostGenerationService _postGeneration;

    public SeriesService(AppDbContext db, IPostGenerationService postGeneration)
    {
        _db = db;
        _postGeneration = postGeneration;
    }

    public async Task<(int SeriesId, IReadOnlyList<int> PostIds)?> GenerateAsync(int userId, GenerateSeriesRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<PostPlatform>(request.Platform, true, out var platform))
            return null;

        var options = new GeneratePostOptions(request.TopicDetail, request.NumPosts, request.Platform, request.Linked, request.Tone, request.Length, request.TikTokScriptDurationSeconds);
        var generated = await _postGeneration.GeneratePostsAsync(options, cancellationToken);
        if (generated.Count == 0) return null;

        var series = new PostSeries
        {
            UserId = userId,
            TopicDetail = request.TopicDetail,
            NumPosts = generated.Count,
            OptionsJson = JsonSerializer.Serialize(new { request.Linked, request.Tone, request.Length, request.GenerateImages, request.StartDate, request.Recurrence, request.ScheduledTimeOfDay }),
            CreatedAt = DateTime.UtcNow,
        };
        _db.PostSeriesSet.Add(series);
        await _db.SaveChangesAsync(cancellationToken);

        var startDate = request.StartDate ?? DateTime.UtcNow.Date;
        var timeOfDay = string.IsNullOrEmpty(request.ScheduledTimeOfDay) ? (TimeSpan?)null : (TimeOnly.TryParse(request.ScheduledTimeOfDay, out var t) ? t.ToTimeSpan() : null);
        var posts = new List<Post>();
        for (var i = 0; i < generated.Count; i++)
        {
            var g = generated[i];
            DateTime? scheduledAt = null;
            if (request.StartDate.HasValue && timeOfDay.HasValue)
                scheduledAt = startDate.Add(timeOfDay.Value).AddDays(i * (request.Recurrence == "daily" ? 1 : 7));
            posts.Add(new Post
            {
                UserId = userId,
                TopicSummary = request.TopicDetail.Length > 500 ? request.TopicDetail[..500] : request.TopicDetail,
                Platform = platform,
                Status = scheduledAt.HasValue ? PostStatus.Scheduled : PostStatus.Draft,
                ScheduledAt = scheduledAt,
                Content = g.Content,
                Script = g.Script,
                MetadataJson = g.HashtagsJson != null ? JsonSerializer.Serialize(new { hashtags = JsonSerializer.Deserialize<object>(g.HashtagsJson) }) : null,
                Tone = request.Tone,
                Length = request.Length,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }
        _db.Posts.AddRange(posts);
        await _db.SaveChangesAsync(cancellationToken);
        return (series.Id, posts.Select(p => p.Id).ToList());
    }

    public async Task GenerateStreamAsync(int userId, GenerateSeriesRequest request, Func<int, PostDto, CancellationToken, Task> onPost, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<PostPlatform>(request.Platform, true, out var platform))
            throw new ArgumentException("Invalid platform", nameof(request));

        var series = new PostSeries
        {
            UserId = userId,
            TopicDetail = request.TopicDetail,
            NumPosts = request.NumPosts,
            OptionsJson = JsonSerializer.Serialize(new { request.Linked, request.Tone, request.Length, request.GenerateImages, request.StartDate, request.Recurrence, request.ScheduledTimeOfDay }),
            CreatedAt = DateTime.UtcNow,
        };
        _db.PostSeriesSet.Add(series);
        await _db.SaveChangesAsync(cancellationToken);
        var seriesId = series.Id;

        var options = new GeneratePostOptions(request.TopicDetail, request.NumPosts, request.Platform, request.Linked, request.Tone, request.Length, request.TikTokScriptDurationSeconds);

        var startDate = request.StartDate ?? DateTime.UtcNow.Date;
        var timeOfDay = string.IsNullOrEmpty(request.ScheduledTimeOfDay) ? (TimeSpan?)null : (TimeOnly.TryParse(request.ScheduledTimeOfDay, out var t) ? t.ToTimeSpan() : null);
        var topicSummary = request.TopicDetail.Length > 500 ? request.TopicDetail[..500] : request.TopicDetail;
        var previousContents = new List<string>();

        for (var i = 0; i < request.NumPosts; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var generated = await _postGeneration.GenerateSinglePostAsync(options, i + 1, previousContents, cancellationToken);
            if (generated == null) throw new InvalidOperationException("Post generation returned null.");

            DateTime? scheduledAt = null;
            if (request.StartDate.HasValue && timeOfDay.HasValue)
                scheduledAt = startDate.Add(timeOfDay.Value).AddDays(i * (request.Recurrence == "daily" ? 1 : 7));

            var status = scheduledAt.HasValue ? PostStatus.Scheduled : PostStatus.Draft;
            var now = DateTime.UtcNow;
            var metadataJson = generated.HashtagsJson != null ? JsonSerializer.Serialize(new { hashtags = JsonSerializer.Deserialize<object>(generated.HashtagsJson) }) : null;

            var dto = new PostDto(
                Id: 0,
                UserId: userId,
                TopicSummary: topicSummary,
                Platform: platform.ToString(),
                Status: status.ToString(),
                ScheduledAt: scheduledAt,
                PublishedAt: null,
                ExternalPostId: null,
                ViewsCount: null,
                LikesCount: null,
                CommentsCount: null,
                LastEngagementFetchedAt: null,
                Content: generated.Content,
                Script: generated.Script,
                ImageUrl: null,
                MetadataJson: metadataJson,
                Tone: request.Tone,
                Length: request.Length,
                CreatedAt: now,
                UpdatedAt: now);

            await onPost(seriesId, dto, cancellationToken);

            previousContents.Add(generated.Content);
        }
    }

    public async Task<(int SeriesId, IReadOnlyList<int> PostIds)> PublishGeneratedSeriesAsync(int userId, PublishGeneratedSeriesRequest request, CancellationToken cancellationToken = default)
    {
        if (!Enum.TryParse<PostPlatform>(request.Platform, true, out var platform))
            throw new ArgumentException("Invalid platform", nameof(request));

        var series = new PostSeries
        {
            UserId = userId,
            TopicDetail = request.TopicDetail,
            NumPosts = request.GeneratedPosts.Count,
            OptionsJson = JsonSerializer.Serialize(new { request.Linked, request.Tone, request.Length, request.GenerateImages, request.StartDate, request.Recurrence, request.ScheduledTimeOfDay }),
            CreatedAt = DateTime.UtcNow,
        };
        _db.PostSeriesSet.Add(series);
        await _db.SaveChangesAsync(cancellationToken);

        var startDate = request.StartDate ?? DateTime.UtcNow.Date;
        var timeOfDay = string.IsNullOrEmpty(request.ScheduledTimeOfDay) ? (TimeSpan?)null : (TimeOnly.TryParse(request.ScheduledTimeOfDay, out var t) ? t.ToTimeSpan() : null);
        var topicSummary = request.TopicDetail.Length > 500 ? request.TopicDetail[..500] : request.TopicDetail;
        var posts = new List<Post>();

        for (var i = 0; i < request.GeneratedPosts.Count; i++)
        {
            var item = request.GeneratedPosts[i];
            DateTime? scheduledAt = null;
            if (request.StartDate.HasValue && timeOfDay.HasValue)
                scheduledAt = startDate.Add(timeOfDay.Value).AddDays(i * (request.Recurrence == "daily" ? 1 : 7));

            posts.Add(new Post
            {
                UserId = userId,
                TopicSummary = topicSummary,
                Platform = platform,
                Status = scheduledAt.HasValue ? PostStatus.Scheduled : PostStatus.Draft,
                ScheduledAt = scheduledAt,
                Content = item.Content,
                Script = item.Script,
                ImageUrl = item.ImageUrl,
                MetadataJson = item.MetadataJson,
                Tone = request.Tone,
                Length = request.Length,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        _db.Posts.AddRange(posts);
        await _db.SaveChangesAsync(cancellationToken);
        return (series.Id, posts.Select(p => p.Id).ToList());
    }
}
