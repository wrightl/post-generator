using Microsoft.Extensions.Logging;
using PostGenerator.Api.Data;
using PostGenerator.Core;

namespace PostGenerator.Api.Services;

public class StubPostPublisher : IPostPublisher
{
    private readonly ILogger _logger;
    private readonly PostPlatform _platform;

    public StubPostPublisher(ILoggerFactory loggerFactory, PostPlatform platform)
    {
        _logger = loggerFactory.CreateLogger($"StubPostPublisher.{platform}");
        _platform = platform;
    }

    public PostPlatform Platform => _platform;

    public Task<PublishResult> PublishAsync(Post post, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Stub publish for {Platform}: post {PostId}", _platform, post.Id);
        return Task.FromResult(new PublishResult(true, null));
    }
}
