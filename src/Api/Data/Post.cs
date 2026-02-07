using System.ComponentModel.DataAnnotations.Schema;
using PostGenerator.Core;

namespace PostGenerator.Api.Data;

public class Post
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TopicSummary { get; set; } = null!;
    public PostPlatform Platform { get; set; }
    public PostStatus Status { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string Content { get; set; } = null!;
    public string? Script { get; set; }
    public string? ImageUrl { get; set; }
    [Column(TypeName = "nvarchar(max)")]
    public string? MetadataJson { get; set; }
    public string? Tone { get; set; }
    public string? Length { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
