using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using PostGenerator.Function.Services;

namespace PostGenerator.Function;

public class TriggerPublishFunction
{
    private readonly PublishRunner _runner;
    private readonly ILogger _logger;

    public TriggerPublishFunction(PublishRunner runner, ILoggerFactory loggerFactory)
    {
        _runner = runner;
        _logger = loggerFactory.CreateLogger<TriggerPublishFunction>();
    }

    [Function("TriggerPublish")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "TriggerPublish")] HttpRequestData req)
    {
        _logger.LogInformation("TriggerPublish invoked at {Time}", DateTime.UtcNow);
        try
        {
            await _runner.RunAsync();
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            var body = JsonSerializer.Serialize(new { message = "Publish run completed" });
            await response.WriteStringAsync(body);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Publish run failed");
            var response = req.CreateResponse(HttpStatusCode.InternalServerError);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            var body = JsonSerializer.Serialize(new { message = ex.Message });
            await response.WriteStringAsync(body);
            return response;
        }
    }
}
