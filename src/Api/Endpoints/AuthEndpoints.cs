using PostGenerator.Api.EndpointFilters;
using PostGenerator.Api.Extensions;
using PostGenerator.Api.Models;
using PostGenerator.Api.Services;

namespace PostGenerator.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/api/auth/sync", Sync); // Anonymous: creates user on first sign-in
        app.MapGet("/api/auth/me", Me).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
    }

    private static async Task<IResult> Sync(HttpContext ctx, IUserService userService, CancellationToken ct)
    {
        var token = ctx.Request.GetBearerToken();
        if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
        var user = await userService.SyncFromTokenAsync(token, ct);
        if (user == null) return Results.Unauthorized();
        return Results.Ok(user);
    }

    private static async Task<IResult> Me(ICurrentUserService currentUser, IUserService userService, CancellationToken ct)
    {
        var user = await userService.GetByIdAsync(currentUser.UserId!.Value, ct);
        if (user == null) return Results.NotFound();
        return Results.Ok(user);
    }
}
