using PostGenerator.Core;

namespace PostGenerator.Function.Services;

public interface IPostPublisher
{
    PostPlatform Platform { get; }
    /// <param name="credentials">Per-user credentials (e.g. from UserSocialCredentials). Keys are platform-specific (e.g. AccessToken, PageId). If null, implementations may fall back to IConfiguration.</param>
    Task<PublishResult> PublishAsync(PostToPublish post, IReadOnlyDictionary<string, string>? credentials, CancellationToken ct = default);
}
