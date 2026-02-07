using PostGenerator.Core;

namespace PostGenerator.Function.Services;

public interface IPostPublisher
{
    PostPlatform Platform { get; }
    Task<bool> PublishAsync(PostToPublish post, CancellationToken ct = default);
}
