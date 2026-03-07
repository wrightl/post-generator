using System.Text.Json;
using Anthropic;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class ClaudeChatCompletionService : IChatCompletionService
{
    private readonly AnthropicClient _client;
    private readonly AnthropicOptions _options;
    private readonly ILogger<ClaudeChatCompletionService> _logger;

    public ClaudeChatCompletionService(IOptions<AnthropicOptions> options, ILogger<ClaudeChatCompletionService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _client = new AnthropicClient(new Anthropic.Core.ClientOptions { ApiKey = _options.ApiKey });
    }

    public async Task<string?> CompleteAsync(string systemPrompt, string userPrompt, int maxTokens, CancellationToken cancellationToken = default)
    {
        var parameters = new Anthropic.Models.Messages.MessageCreateParams
        {
            Model = _options.Model,
            MaxTokens = maxTokens,
            System = systemPrompt,
            Messages =
            [
                new Anthropic.Models.Messages.MessageParam
                {
                    Role = Anthropic.Models.Messages.Role.User,
                    Content = userPrompt,
                },
            ],
        };

        try
        {
            var message = await _client.Messages.Create(parameters, cancellationToken);
            var text = message.Content.First().Json.GetProperty("text").GetString();
            return text?.Trim();
        }
        catch (Exception ex)
        {
            throw new HttpRequestException($"Claude API error: {ex.Message}", ex);
        }
    }
}
