using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;

namespace PostGenerator.Function.Services;

/// <summary>
/// Skool publisher. The Skool public API currently only documents GET /v1/posts (list).
/// When a create-post endpoint is available (e.g. POST /v1/posts), implement it using
/// Skool:ApiKey (x-api-secret), Skool:SessionId, and Skool:GroupId.
/// </summary>
public class SkoolPublisher : IPostPublisher
{
    public PostPlatform Platform => PostPlatform.Skool;
    private readonly IConfiguration _config;
    private readonly ILogger<SkoolPublisher> _logger;

    public SkoolPublisher(IConfiguration config, ILogger<SkoolPublisher> logger)
    {
        _config = config;
        _logger = logger;
    }

    public Task<bool> PublishAsync(PostToPublish post, CancellationToken ct = default)
    {
        _logger.LogWarning("Skool create post not in API. Post {PostId} skipped. Config keys for future use: Skool:ApiKey (x-api-secret), Skool:SessionId, Skool:GroupId", post.Id);
        return Task.FromResult(false);
    }
}
