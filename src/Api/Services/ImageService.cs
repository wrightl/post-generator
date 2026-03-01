using Azure;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class ImageService : IImageService
{
    private readonly BlobStorageOptions _blobOptions;
    private readonly BlobServiceClient _blobServiceClient;

    public ImageService(
        BlobServiceClient blobServiceClient,
        IOptions<BlobStorageOptions> blobOptions)
    {
        _blobOptions = blobOptions.Value;
        _blobServiceClient = blobServiceClient;
    }

    public async Task<string> UploadAsync(Stream stream, string hint, string contentType, CancellationToken cancellationToken = default)
    {
        var ext = contentType switch
        {
            "image/jpeg" or "image/jpg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            _ => ".bin",
        };
        var blobName = $"post-{hint}-{Guid.NewGuid():N}{ext}";
        var containerClient = _blobServiceClient.GetBlobContainerClient(_blobOptions.ContainerName);
        var blobClient = containerClient.GetBlobClient(blobName);

        await blobClient.UploadAsync(stream, overwrite: true, cancellationToken);
        return blobClient.Uri.ToString();
    }

    public async Task<(Stream Stream, string ContentType)?> GetImageAsync(string imageUrl, CancellationToken cancellationToken = default)
    {
        // Parse blob URL: https://account.blob.core.windows.net/container/blobname or Azurite
        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) || uri.Segments.Length < 2)
            return null;

        var containerClient = _blobServiceClient.GetBlobContainerClient(_blobOptions.ContainerName);

        var containerIndex = -1;
        for (var i = 1; i < uri.Segments.Length; i++)
        {
            var segment = uri.Segments[i].TrimEnd('/');
            if (string.Equals(segment, _blobOptions.ContainerName, StringComparison.OrdinalIgnoreCase))
            {
                containerIndex = i;
                break;
            }
        }

        if (containerIndex < 0 || containerIndex >= uri.Segments.Length - 1)
            return null;

        // Only serve blobs from our configured container (URL must reference it)
        var containerName = uri.Segments[containerIndex].TrimEnd('/');
        if (!string.Equals(containerName, _blobOptions.ContainerName, StringComparison.OrdinalIgnoreCase))
            return null;

        var blobName = string.Concat(uri.Segments.Skip(containerIndex + 1)).Trim('/');
        if (string.IsNullOrEmpty(blobName))
            return null;
        // Reject path traversal or unsafe blob names
        if (blobName.Contains("..", StringComparison.Ordinal))
            return null;

        try
        {
            var blobClient = containerClient.GetBlobClient(blobName);
            var response = await blobClient.DownloadStreamingAsync(cancellationToken: cancellationToken);
            var contentType = response.Value.Details.ContentType ?? "application/octet-stream";
            return (response.Value.Content, contentType);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            return null;
        }
    }
}
