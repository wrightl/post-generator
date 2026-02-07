namespace PostGenerator.Api.Models;

public record PostDto(
    int Id,
    int UserId,
    string TopicSummary,
    string Platform,
    string Status,
    DateTime? ScheduledAt,
    DateTime? PublishedAt,
    string Content,
    string? Script,
    string? ImageUrl,
    string? MetadataJson,
    string? Tone,
    string? Length,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreatePostRequest(
    string TopicSummary,
    string Platform,
    string? Content,
    string? Script,
    string? ImageUrl,
    string? MetadataJson,
    string? Tone,
    string? Length,
    DateTime? ScheduledAt);

public record GenerateImageRequest(string? Prompt);

public record UpdatePostRequest(
    string? TopicSummary,
    string? Content,
    string? Script,
    string? ImageUrl,
    string? MetadataJson,
    string? Tone,
    string? Length,
    DateTime? ScheduledAt,
    string? Status);
