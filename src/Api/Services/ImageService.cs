using System.Net.Http;
using Azure;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Options;
using OpenAI.Images;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class ImageService : IImageService
{
    private readonly IAzureOpenAIClientProvider _clientProvider;
    private readonly AzureOpenAIOptions _openAIOptions;
    private readonly BlobStorageOptions _blobOptions;
    private readonly IHttpClientFactory _httpClientFactory;

    public ImageService(
        IAzureOpenAIClientProvider clientProvider,
        IOptions<AzureOpenAIOptions> openAIOptions,
        IOptions<BlobStorageOptions> blobOptions,
        IHttpClientFactory httpClientFactory)
    {
        _clientProvider = clientProvider;
        _openAIOptions = openAIOptions.Value;
        _blobOptions = blobOptions.Value;
        _httpClientFactory = httpClientFactory;
    }

    // public async Task<string?> GenerateAndUploadAsync(string prompt, string fileName, CancellationToken cancellationToken = default)
    // {
    //     var azureClient = _clientProvider.GetImageClient();
    //     if (azureClient == null)
    //         return null;
    //     if (string.IsNullOrEmpty(_blobOptions.ConnectionString))
    //         return null;

    //     var imageClient = azureClient.GetImageClient(_openAIOptions.ImageDeploymentName);
    //     var options = new ImageGenerationOptions
    //     {
    //         Size = GeneratedImageSize.W1024xH1024,
    //         ResponseFormat = GeneratedImageFormat.Uri,
    //     };

    //     try
    //     {
    //         var result = await imageClient.GenerateImageAsync(prompt, options, cancellationToken);
    //         var image = result.Value;
    //         var imageUrl = image.ImageUri?.ToString();
    //         if (string.IsNullOrEmpty(imageUrl))
    //             return null;

    //         var httpClient = _httpClientFactory.CreateClient();
    //         var blobClient = new BlobClient(_blobOptions.ConnectionString, _blobOptions.ContainerName, fileName);
    //         await using var stream = await httpClient.GetStreamAsync(imageUrl, cancellationToken);
    //         await blobClient.UploadAsync(stream, overwrite: true, cancellationToken);
    //         return blobClient.Uri.ToString();
    //     }
    //     catch (RequestFailedException ex)
    //     {
    //         var message = $"Azure OpenAI images returned {ex.Status} {ex.Message}. {ex.ErrorCode}";
    //         if (ex.Status == 404 && (ex.Message?.Contains("DeploymentNotFound", StringComparison.OrdinalIgnoreCase) == true)
    //             && string.IsNullOrEmpty(_openAIOptions.ImageEndpoint))
    //         {
    //             message += " When using separate Azure OpenAI accounts for chat (e.g. West Europe) and images (e.g. Sweden Central), set AzureOpenAI:ImageEndpoint and AzureOpenAI:ImageApiKey to the image account endpoint and key. See infra/deploy-local.sh output for dotnet user-secrets commands.";
    //         }
    //         else if (ex.Status == 400
    //             && (ex.Message?.Contains("content_policy_violation", StringComparison.OrdinalIgnoreCase) == true
    //                 || ex.Message?.Contains("ResponsibleAIPolicyViolation", StringComparison.OrdinalIgnoreCase) == true))
    //         {
    //             message = $"Image generation was blocked by content safety. The prompt may contain text that isn't allowed. Try rephrasing or shortening the prompt: \nprompt: {prompt}";
    //         }
    //         throw new HttpRequestException(message, ex);
    //     }
    // }

    public async Task<string> UploadAsync(Stream stream, string hint, string contentType, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_blobOptions.ConnectionString))
            throw new InvalidOperationException("Blob storage is not configured.");

        var ext = contentType switch
        {
            "image/jpeg" or "image/jpg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            _ => ".bin",
        };
        var blobName = $"post-{hint}-{Guid.NewGuid():N}{ext}";
        var blobClient = new BlobClient(_blobOptions.ConnectionString, _blobOptions.ContainerName, blobName);
        await blobClient.UploadAsync(stream, overwrite: true, cancellationToken);
        return blobClient.Uri.ToString();
    }

    public async Task<(Stream Stream, string ContentType)?> GetImageAsync(string imageUrl, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_blobOptions.ConnectionString) || string.IsNullOrEmpty(imageUrl))
            return null;

        // Parse blob URL: https://account.blob.core.windows.net/container/blobname
        // Or Azurite: http://127.0.0.1:10000/devstoreaccount1/container/blobname
        if (!Uri.TryCreate(imageUrl, UriKind.Absolute, out var uri) || uri.Segments.Length < 2)
            return null;

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

        var containerName = uri.Segments[containerIndex].TrimEnd('/');
        var blobName = string.Concat(uri.Segments.Skip(containerIndex + 1)).Trim('/');
        if (string.IsNullOrEmpty(blobName))
            return null;

        try
        {
            var blobClient = new BlobClient(_blobOptions.ConnectionString, containerName, blobName);
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
