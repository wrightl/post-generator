using PostGenerator.Api.Data;
using PostGenerator.Api.Models;
using PostGenerator.Core;

namespace PostGenerator.Api.Services;

public interface IPostService
{
    Task<IReadOnlyList<PostDto>> ListAsync(int userId, PostPlatform? platform, PostStatus? status, DateTime? from, DateTime? to, CancellationToken cancellationToken = default);
    Task<PostDto?> GetByIdAsync(int userId, int postId, CancellationToken cancellationToken = default);
    Task<PostDto> CreateAsync(int userId, CreatePostRequest request, CancellationToken cancellationToken = default);
    Task<PostDto?> UpdateAsync(int userId, int postId, UpdatePostRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int userId, int postId, CancellationToken cancellationToken = default);
    Task<PostDto?> GenerateImageAsync(int userId, int postId, string? prompt, CancellationToken cancellationToken = default);
}
