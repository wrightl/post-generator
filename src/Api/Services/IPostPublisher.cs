using PostGenerator.Api.Data;
using PostGenerator.Core;

namespace PostGenerator.Api.Services;

public interface IPostPublisher
{
    PostPlatform Platform { get; }
    Task<PublishResult> PublishAsync(Post post, CancellationToken cancellationToken = default);
}

public record PublishResult(bool Success, string? ErrorMessage);
