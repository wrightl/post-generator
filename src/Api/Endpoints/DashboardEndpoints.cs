using PostGenerator.Api.EndpointFilters;
using PostGenerator.Api.Services;

namespace PostGenerator.Api.Endpoints;

public static class DashboardEndpoints
{
    public static void MapDashboardEndpoints(this WebApplication app)
    {
        app.MapGet("/api/dashboard/stats", GetStats)
            .RequireAuthorization()
            .AddEndpointFilter<RequireCurrentUserFilter>();
    }

    private static async Task<IResult> GetStats(ICurrentUserService currentUser, IPostService postService, CancellationToken ct)
    {
        var stats = await postService.GetDashboardStatsAsync(currentUser.UserId!.Value, ct);
        return Results.Ok(stats);
    }
}
