using PostGenerator.Api.Models;

namespace PostGenerator.Api.Services;

/// <summary>
/// Fetches engagement (views, likes, comments) from platform APIs and updates the post.
/// </summary>
public interface IEngagementService
{
    /// <summary>
    /// Fetches engagement from the post's platform using the user's stored credentials,
    /// updates the post entity, and returns the updated DTO. Returns null if post not found,
    /// not owned by user, ExternalPostId is missing, credentials missing, or platform unsupported.
    /// </summary>
    Task<PostDto?> RefreshEngagementAsync(int userId, int postId, CancellationToken cancellationToken = default);
}
