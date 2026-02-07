namespace PostGenerator.Core;

/// <summary>
/// Minimal DTO for a post due to be published (used by the publish Function).
/// </summary>
public class PostToPublish
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Content { get; set; } = "";
    public PostPlatform Platform { get; set; }
    public string UserEmail { get; set; } = "";
    public string? ImageUrl { get; set; }
    public string? Script { get; set; }
    public string? MetadataJson { get; set; }
}
