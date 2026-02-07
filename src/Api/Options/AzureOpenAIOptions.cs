namespace PostGenerator.Api.Options;

public class AzureOpenAIOptions
{
    public const string SectionName = "AzureOpenAI";
    public string Endpoint { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public string ChatDeploymentName { get; set; } = "gpt-4o";
    public string ImageDeploymentName { get; set; } = "dall-e-3";
}
