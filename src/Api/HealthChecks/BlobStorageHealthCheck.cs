using Azure.Storage.Blobs;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.HealthChecks;

public class BlobStorageHealthCheck : IHealthCheck
{
    private readonly BlobStorageOptions _options;

    public BlobStorageHealthCheck(IOptions<BlobStorageOptions> options)
    {
        _options = options.Value;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_options.ConnectionString))
            return HealthCheckResult.Healthy("Blob storage not configured (optional).");

        try
        {
            var client = new BlobContainerClient(_options.ConnectionString, _options.ContainerName);
            var exists = await client.ExistsAsync(cancellationToken);
            return exists.Value
                ? HealthCheckResult.Healthy("Blob container is accessible.")
                : HealthCheckResult.Degraded("Blob container not found.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Blob storage check failed.", ex);
        }
    }
}
