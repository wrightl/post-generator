using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using PostGenerator.Api.Options;
using PostGenerator.Api.Services;

namespace PostGenerator.Api.HealthChecks;

// public class AzureOpenAIHealthCheck : IHealthCheck
// {
//     private readonly IAzureOpenAIClientProvider _clientProvider;
//     private readonly AzureOpenAIOptions _options;

//     public AzureOpenAIHealthCheck(IAzureOpenAIClientProvider clientProvider, IOptions<AzureOpenAIOptions> options)
//     {
//         _clientProvider = clientProvider;
//         _options = options.Value;
//     }

//     public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
//     {
//         if (string.IsNullOrEmpty(_options.Endpoint) || string.IsNullOrEmpty(_options.ApiKey))
//             return HealthCheckResult.Healthy("Azure OpenAI not configured (optional).");

//         var azureClient = _clientProvider.GetChatClient();
//         if (azureClient == null)
//             return HealthCheckResult.Healthy("Azure OpenAI not configured (optional).");

//         try
//         {
//             var chatClient = azureClient.GetChatClient(_options.ChatDeploymentName);
//             var messages = new ChatMessage[] { new SystemChatMessage("ping") };
//             var options = new ChatCompletionOptions { MaxOutputTokenCount = 1 };
//             _ = await chatClient.CompleteChatAsync(messages, options, cancellationToken);
//             return HealthCheckResult.Healthy("Azure OpenAI is reachable.");
//         }
//         catch (Exception ex)
//         {
//             return HealthCheckResult.Unhealthy("Azure OpenAI check failed.", ex);
//         }
//     }
// }
