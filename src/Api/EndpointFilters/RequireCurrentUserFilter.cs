using PostGenerator.Api.Services;

namespace PostGenerator.Api.EndpointFilters;

/// <summary>
/// Returns 401 Unauthorized when the current user id cannot be resolved (e.g. principal has no NameIdentifier).
/// Use on routes that require a valid user id so handlers can assume ICurrentUserService.UserId is set.
/// </summary>
public sealed class RequireCurrentUserFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var currentUser = context.HttpContext.RequestServices.GetService<ICurrentUserService>();
        if (currentUser == null || !currentUser.UserId.HasValue)
            return Results.Unauthorized();
        return await next(context);
    }
}
