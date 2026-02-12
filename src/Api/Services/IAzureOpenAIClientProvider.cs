using Azure.AI.OpenAI;

namespace PostGenerator.Api.Services;

/// <summary>
/// Provides Azure OpenAI clients for chat and image generation, with support for separate endpoints (e.g. chat in West Europe, images in Sweden Central).
/// </summary>
public interface IAzureOpenAIClientProvider
{
    /// <summary>Gets the client for chat completions (Endpoint + ApiKey). Returns null if not configured.</summary>
    AzureOpenAIClient? GetChatClient();

    /// <summary>Gets the client for image generation (ImageEndpoint ?? Endpoint, ImageApiKey ?? ApiKey). Returns null if not configured.</summary>
    // AzureOpenAIClient? GetImageClient();
}
