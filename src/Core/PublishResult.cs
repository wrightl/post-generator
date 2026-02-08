namespace PostGenerator.Core;

/// <summary>
/// Result of publishing a post to a platform. ExternalPostId is the platform's identifier for the created post (e.g. URN, URI, video id).
/// </summary>
public class PublishResult
{
    public bool Success { get; set; }
    public string? ExternalPostId { get; set; }

    public static PublishResult Failed => new() { Success = false };
    public static PublishResult Ok(string? externalPostId) => new() { Success = true, ExternalPostId = externalPostId };
}
