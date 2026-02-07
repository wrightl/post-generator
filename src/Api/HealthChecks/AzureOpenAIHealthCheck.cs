using System.Net.Http.Headers;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.HealthChecks;

public class AzureOpenAIHealthCheck : IHealthCheck
{
    private readonly AzureOpenAIOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;

    public AzureOpenAIHealthCheck(IOptions<AzureOpenAIOptions> options, IHttpClientFactory httpClientFactory)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_options.Endpoint) || string.IsNullOrEmpty(_options.ApiKey))
            return HealthCheckResult.Healthy("Azure OpenAI not configured (optional).");

        try
        {
            var client = _httpClientFactory.CreateClient();
            var url = _options.Endpoint.TrimEnd('/') + "/openai/deployments?api-version=2024-02-15-preview";
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
            using var response = await client.GetAsync(url, cancellationToken);
            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy("Azure OpenAI is reachable.")
                : HealthCheckResult.Degraded($"Azure OpenAI returned {response.StatusCode}.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Azure OpenAI check failed.", ex);
        }
    }
}
