using Azure.Storage.Blobs;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.HealthChecks;

public class BlobStorageHealthCheck : IHealthCheck
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly BlobStorageOptions _options;
    private readonly ILogger<BlobStorageHealthCheck> _logger;

    public BlobStorageHealthCheck(BlobServiceClient blobServiceClient, IOptions<BlobStorageOptions> options, ILogger<BlobStorageHealthCheck> logger)
    {
        _blobServiceClient = blobServiceClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_options.ContainerName))
            return HealthCheckResult.Healthy("Blob storage not configured (optional).");

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_options.ContainerName);
            var exists = await containerClient.ExistsAsync(cancellationToken);
            return exists.Value
                ? HealthCheckResult.Healthy("Blob container is accessible.")
                : HealthCheckResult.Degraded("Blob container not found.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Blob storage check failed: {Message}", ex.Message);
            return HealthCheckResult.Degraded("Blob storage temporarily unavailable.", ex);
        }
    }
}
