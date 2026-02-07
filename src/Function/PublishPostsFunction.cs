using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using PostGenerator.Function.Services;

namespace PostGenerator.Function;

public class PublishPostsFunction
{
    private readonly PublishRunner _runner;
    private readonly ILogger _logger;

    public PublishPostsFunction(PublishRunner runner, ILoggerFactory loggerFactory)
    {
        _runner = runner;
        _logger = loggerFactory.CreateLogger<PublishPostsFunction>();
    }

    [Function("PublishScheduledPosts")]
    public async Task Run([TimerTrigger("0 */5 * * * *")] TimerInfo timerInfo)
    {
        _logger.LogInformation("PublishScheduledPosts triggered at {Time}", DateTime.UtcNow);
        try
        {
            await _runner.RunAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Publish run failed");
        }
    }
}
