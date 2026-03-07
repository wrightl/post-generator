namespace PostGenerator.Api.Services;

public interface IChatCompletionService
{
    Task<string?> CompleteAsync(string systemPrompt, string userPrompt, int maxTokens, CancellationToken cancellationToken = default);
}
