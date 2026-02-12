using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Services;

public interface IPostService
{
    Task<(IReadOnlyList<PostDto> Items, int TotalCount)> ListAsync(int userId, IReadOnlyList<string>? platforms, IReadOnlyList<string>? statuses, DateTime? from, DateTime? to, int? skip = null, int? take = null, CancellationToken cancellationToken = default);
    Task<PostDto?> GetByIdAsync(int userId, int postId, CancellationToken cancellationToken = default);
    Task<PostDto> CreateAsync(int userId, CreatePostRequest request, CancellationToken cancellationToken = default);
    Task<PostDto?> UpdateAsync(int userId, int postId, UpdatePostRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int userId, int postId, CancellationToken cancellationToken = default);
    // Task<PostDto?> GenerateImageAsync(int userId, int postId, string? prompt, CancellationToken cancellationToken = default);
    Task<PostDto?> SetPostImageUrlAsync(int userId, int postId, string? imageUrl, CancellationToken cancellationToken = default);
    Task<PostDto?> PublishNowAsync(int userId, int postId, CancellationToken cancellationToken = default);
    Task<DashboardStatsDto> GetDashboardStatsAsync(int userId, CancellationToken cancellationToken = default);
}
