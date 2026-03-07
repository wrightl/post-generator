namespace PostGenerator.Api.Options;

public class AiOptions
{
    public const string SectionName = "Ai";

    /// <summary>AI provider for post generation: AzureOpenAI or Claude.</summary>
    public string Provider { get; set; } = "AzureOpenAI";
}
