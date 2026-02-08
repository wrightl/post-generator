using System.Net.Http.Json;
using System.Text.Json;
using Azure.Storage.Blobs;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class ImageService : IImageService
{
    private readonly AzureOpenAIOptions _openAIOptions;
    private readonly BlobStorageOptions _blobOptions;
    private readonly IHttpClientFactory _httpClientFactory;

    public ImageService(
        IOptions<AzureOpenAIOptions> openAIOptions,
        IOptions<BlobStorageOptions> blobOptions,
        IHttpClientFactory httpClientFactory)
    {
        _openAIOptions = openAIOptions.Value;
        _blobOptions = blobOptions.Value;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<string?> GenerateAndUploadAsync(string prompt, string fileName, CancellationToken cancellationToken = default)
    {
        var endpoint = !string.IsNullOrEmpty(_openAIOptions.ImageEndpoint) ? _openAIOptions.ImageEndpoint : _openAIOptions.Endpoint;
        var apiKey = !string.IsNullOrEmpty(_openAIOptions.ImageEndpoint) && !string.IsNullOrEmpty(_openAIOptions.ImageApiKey)
            ? _openAIOptions.ImageApiKey
            : _openAIOptions.ApiKey;
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
            return null;
        if (string.IsNullOrEmpty(_blobOptions.ConnectionString))
            return null;

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Add("api-key", apiKey);

        var url = $"{endpoint.TrimEnd('/')}/openai/deployments/{Uri.EscapeDataString(_openAIOptions.ImageDeploymentName)}/images/generations?api-version=2024-02-15-preview";
        var body = new
        {
            prompt,
            n = 1,
            size = "1024x1024",
            response_format = "url",
        };

        var response = await client.PostAsJsonAsync(url, body, cancellationToken);
        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var message = $"Azure OpenAI images returned {(int)response.StatusCode} {response.ReasonPhrase}. {responseBody}";
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound && responseBody.Contains("DeploymentNotFound", StringComparison.OrdinalIgnoreCase)
                && string.IsNullOrEmpty(_openAIOptions.ImageEndpoint))
            {
                message += " When using separate Azure OpenAI accounts for chat (e.g. West Europe) and images (e.g. Sweden Central), set AzureOpenAI:ImageEndpoint and AzureOpenAI:ImageApiKey to the image account endpoint and key. See infra/deploy-local.sh output for dotnet user-secrets commands.";
            }
            else if (response.StatusCode == System.Net.HttpStatusCode.BadRequest
                && (responseBody.Contains("content_policy_violation", StringComparison.OrdinalIgnoreCase)
                    || responseBody.Contains("ResponsibleAIPolicyViolation", StringComparison.OrdinalIgnoreCase)))
            {
                message = $"Image generation was blocked by content safety. The prompt may contain text that isn't allowed. Try rephrasing or shortening the prompt: \nprompt: {prompt}";
            }
            throw new HttpRequestException(message);
        }
        var json = JsonSerializer.Deserialize<JsonElement>(responseBody)!;
        var data = json.GetProperty("data");
        if (data.GetArrayLength() == 0) return null;
        var imageUrl = data[0].GetProperty("url").GetString();
        if (string.IsNullOrEmpty(imageUrl)) return null;

        var blobClient = new BlobClient(_blobOptions.ConnectionString, _blobOptions.ContainerName, fileName);
        await using var stream = await client.GetStreamAsync(imageUrl, cancellationToken);
        await blobClient.UploadAsync(stream, overwrite: true, cancellationToken);
        return blobClient.Uri.ToString();
    }
}
