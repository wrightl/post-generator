using Azure;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class AzureOpenAIChatCompletionService : IChatCompletionService
{
    private const string DeploymentName = "openai-chat-deployment";
    private readonly OpenAIClient _openAIClient;

    public AzureOpenAIChatCompletionService(OpenAIClient openAIClient)
    {
        _openAIClient = openAIClient;
    }

    public async Task<string?> CompleteAsync(string systemPrompt, string userPrompt, int maxTokens, CancellationToken cancellationToken = default)
    {
        var chatClient = _openAIClient.GetChatClient(DeploymentName);
        var messages = new ChatMessage[]
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(userPrompt),
        };

        try
        {
            var completion = await chatClient.CompleteChatAsync(messages, cancellationToken: cancellationToken);
            var content = completion.Value.Content;
            if (content == null || content.Count == 0)
                return null;
            var result = string.Concat(content
                .Where(p => p.Kind == ChatMessageContentPartKind.Text && p.Text != null)
                .Select(p => p.Text));
            return StripMarkdown(result.Trim());
        }
        catch (RequestFailedException ex)
        {
            throw new HttpRequestException($"Azure OpenAI returned {ex.Status} {ex.Message}. {ex.ErrorCode}", ex);
        }
    }

    private static string StripMarkdown(string content)
    {
        if (content.StartsWith("```"))
            content = content.Replace("```json", "").Replace("```", "").Trim();
        return content;
    }
}
