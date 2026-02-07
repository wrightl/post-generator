using PostGenerator.Api.EndpointFilters;
using PostGenerator.Api.Models;
using PostGenerator.Api.Services;
using PostGenerator.Api.Validators;

namespace PostGenerator.Api.Endpoints;

public static class SeriesEndpoints
{
    public static void MapSeriesEndpoints(this WebApplication app)
    {
        app.MapPost("/api/series/generate", Generate).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>().AddEndpointFilter<ValidationFilter<GenerateSeriesRequest>>();
    }

    private static async Task<IResult> Generate(
        GenerateSeriesRequest req,
        ICurrentUserService currentUser,
        ISeriesService seriesService,
        CancellationToken ct)
    {
        var result = await seriesService.GenerateAsync(currentUser.UserId!.Value, req, ct);
        if (result == null) return Results.BadRequest("No posts generated.");
        return Results.Ok(new { seriesId = result.Value.SeriesId, postIds = result.Value.PostIds });
    }
}
