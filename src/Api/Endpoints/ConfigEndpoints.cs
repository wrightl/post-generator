using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Endpoints;

public static class ConfigEndpoints
{
    public static void MapConfigEndpoints(this WebApplication app)
    {
        app.MapGet("/api/config", GetConfig);
    }

    private static IResult GetConfig(IOptions<AiOptions> aiOptions)
    {
        var provider = aiOptions.Value.Provider ?? "AzureOpenAI";
        var imageGenerationAvailable = provider.Equals("AzureOpenAI", StringComparison.OrdinalIgnoreCase);
        return Results.Ok(new { aiProvider = provider, imageGenerationAvailable });
    }
}
