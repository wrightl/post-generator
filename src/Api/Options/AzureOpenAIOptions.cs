namespace PostGenerator.Api.Options;

public class AzureOpenAIOptions
{
    public const string SectionName = "AzureOpenAI";
    public string Endpoint { get; set; } = "";
    public string ApiKey { get; set; } = "";
    /// <summary>When set, image generation uses this endpoint (and ImageApiKey if set). Used when chat and image are in different regions.</summary>
    public string? ImageEndpoint { get; set; }
    /// <summary>When set with ImageEndpoint, image generation uses this key. Otherwise image uses ApiKey.</summary>
    public string? ImageApiKey { get; set; }
    public string ChatDeploymentName { get; set; } = "gpt-4o";
    public string ImageDeploymentName { get; set; } = "dall-e-3";
}
