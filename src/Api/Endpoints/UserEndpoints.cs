using PostGenerator.Api.EndpointFilters;
using PostGenerator.Api.Models;
using PostGenerator.Api.Services;

namespace PostGenerator.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/users/me").RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();

        group.MapGet("/profile", GetProfile);
        group.MapPatch("/profile", UpdateProfile);
        group.MapGet("/credentials", GetCredentials);
        group.MapPut("/credentials/{platform}", SetCredential);
    }

    private static async Task<IResult> GetProfile(ICurrentUserService currentUser, IUserService userService, CancellationToken ct)
    {
        var user = await userService.GetByIdAsync(currentUser.UserId!.Value, ct);
        if (user == null) return Results.NotFound();
        return Results.Ok(user);
    }

    private static async Task<IResult> UpdateProfile(
        ICurrentUserService currentUser,
        IUserService userService,
        UserProfileUpdateRequest request,
        CancellationToken ct)
    {
        try
        {
            var ok = await userService.UpdateProfileAsync(currentUser.UserId!.Value, request, ct);
            if (!ok) return Results.NotFound();
            return Results.NoContent();
        }
        catch (ArgumentException ex) when (ex.ParamName == "request")
        {
            return Results.BadRequest(ex.Message);
        }
    }

    private static async Task<IResult> GetCredentials(ICurrentUserService currentUser, IUserService userService, CancellationToken ct)
    {
        var list = await userService.GetCredentialsAsync(currentUser.UserId!.Value, ct);
        return Results.Ok(list);
    }

    private static async Task<IResult> SetCredential(
        ICurrentUserService currentUser,
        IUserService userService,
        string platform,
        SetSocialCredentialRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(platform)) return Results.BadRequest();
        try
        {
            var ok = await userService.SetCredentialAsync(
                currentUser.UserId!.Value,
                platform.Trim(),
                request.Credentials,
                ct);
            if (!ok) return Results.BadRequest();
            return Results.NoContent();
        }
        catch (ArgumentException ex) when (ex.ParamName == "credentials")
        {
            return Results.BadRequest(ex.Message);
        }
    }
}
