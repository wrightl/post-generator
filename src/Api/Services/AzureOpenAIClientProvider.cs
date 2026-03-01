using Microsoft.Extensions.Options;
using OpenAI;
using PostGenerator.Api.Options;
using System.ClientModel;

namespace PostGenerator.Api.Services;

// public class AzureOpenAIClientProvider : IAzureOpenAIClientProvider
// {

//     private readonly OpenAIClient _openAIClient;
//     // private readonly Lazy<AzureOpenAIClient?> _imageClient;

//     public AzureOpenAIClientProvider(OpenAIClient openAIClient)
//     {
//         _openAIClient = openAIClient;
//         // _imageClient = new Lazy<AzureOpenAIClient?>(CreateImageClient);
//     }

//     // public AzureOpenAIClient? GetChatClient() => _chatClient.Value;

//     // public AzureOpenAIClient? GetImageClient() => _imageClient.Value;

//     // private AzureOpenAIClient? CreateChatClient()
//     // {
//     //     if (string.IsNullOrEmpty(_options.Endpoint) || string.IsNullOrEmpty(_options.ApiKey))
//     //         return null;
//     //     if (!Uri.TryCreate(_options.Endpoint.TrimEnd('/'), UriKind.Absolute, out var uri) || !uri.Scheme.StartsWith("http", StringComparison.OrdinalIgnoreCase))
//     //         return null;
//     //     return new AzureOpenAIClient(uri, new ApiKeyCredential(_options.ApiKey!));
//     // }

//     // private AzureOpenAIClient? CreateImageClient()
//     // {
//     //     var endpoint = !string.IsNullOrEmpty(_options.ImageEndpoint) ? _options.ImageEndpoint : _options.Endpoint;
//     //     var apiKey = !string.IsNullOrEmpty(_options.ImageEndpoint) && !string.IsNullOrEmpty(_options.ImageApiKey)
//     //         ? _options.ImageApiKey
//     //         : _options.ApiKey;
//     //     if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(apiKey))
//     //         return null;
//     //     if (!Uri.TryCreate(endpoint.TrimEnd('/'), UriKind.Absolute, out var uri) || !uri.Scheme.StartsWith("http", StringComparison.OrdinalIgnoreCase))
//     //         return null;
//     //     return new AzureOpenAIClient(uri, new ApiKeyCredential(apiKey!));
//     // }
// }
