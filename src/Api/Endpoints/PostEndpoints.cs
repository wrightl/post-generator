using System.Net.Http;
using PostGenerator.Api.EndpointFilters;
using PostGenerator.Api.Models;
using PostGenerator.Api.Services;
using PostGenerator.Api.Validators;
using PostGenerator.Core;

namespace PostGenerator.Api.Endpoints;

public static class PostEndpoints
{
    public static void MapPostEndpoints(this WebApplication app)
    {
        app.MapGet("/api/posts", List).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapGet("/api/posts/{id:int}", GetById).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapPost("/api/posts", Create).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>().AddEndpointFilter<ValidationFilter<CreatePostRequest>>();
        app.MapPatch("/api/posts/{id:int}", Update).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>().AddEndpointFilter<ValidationFilter<UpdatePostRequest>>();
        app.MapDelete("/api/posts/{id:int}", Delete).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapPost("/api/posts/{id:int}/generate-image", GenerateImage).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapPost("/api/posts/{id:int}/publish-now", PublishNow).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapPost("/api/posts/{id:int}/refresh-engagement", RefreshEngagement).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
    }

    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    private static async Task<IResult> List(
        ICurrentUserService currentUser,
        IPostService postService,
        string[]? platform,
        string[]? status,
        DateTime? from,
        DateTime? to,
        int? page,
        int? pageSize,
        CancellationToken ct)
    {
        var effectivePage = Math.Max(1, page ?? 1);
        var effectivePageSize = Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize);
        var skip = (effectivePage - 1) * effectivePageSize;
        var take = effectivePageSize;
        var platforms = platform?.Length > 0 ? platform : null;
        var statuses = status?.Length > 0 ? status : null;
        var (items, totalCount) = await postService.ListAsync(currentUser.UserId!.Value, platforms, statuses, from, to, skip, take, ct);
        return Results.Ok(new { items, totalCount });
    }

    private static async Task<IResult> GetById(
        int id,
        ICurrentUserService currentUser,
        IPostService postService,
        CancellationToken ct)
    {
        var post = await postService.GetByIdAsync(currentUser.UserId!.Value, id, ct);
        if (post == null) return Results.NotFound();
        return Results.Ok(post);
    }

    private static async Task<IResult> Create(
        CreatePostRequest req,
        ICurrentUserService currentUser,
        IPostService postService,
        CancellationToken ct)
    {
        try
        {
            var post = await postService.CreateAsync(currentUser.UserId!.Value, req, ct);
            return Results.Created($"/api/posts/{post.Id}", post);
        }
        catch (ArgumentException ex) when (ex.ParamName == "request")
        {
            return Results.BadRequest(ex.Message);
        }
    }

    private static async Task<IResult> Update(
        int id,
        UpdatePostRequest req,
        ICurrentUserService currentUser,
        IPostService postService,
        CancellationToken ct)
    {
        var post = await postService.UpdateAsync(currentUser.UserId!.Value, id, req, ct);
        if (post == null) return Results.NotFound();
        return Results.Ok(post);
    }

    private static async Task<IResult> Delete(
        int id,
        ICurrentUserService currentUser,
        IPostService postService,
        CancellationToken ct)
    {
        var deleted = await postService.DeleteAsync(currentUser.UserId!.Value, id, ct);
        if (!deleted) return Results.NotFound();
        return Results.NoContent();
    }

    private static async Task<IResult> GenerateImage(
        int id,
        GenerateImageRequest? request,
        ICurrentUserService currentUser,
        IPostService postService,
        CancellationToken ct)
    {
        try
        {
            var post = await postService.GenerateImageAsync(currentUser.UserId!.Value, id, request?.Prompt, ct);
            if (post == null) return Results.BadRequest(new { message = "Post not found or image generation failed." });
            return Results.Ok(post);
        }
        catch (HttpRequestException ex)
        {
            return Results.BadRequest(new { message = ex.Message });
        }
    }

    private static async Task<IResult> PublishNow(
        int id,
        ICurrentUserService currentUser,
        IPostService postService,
        CancellationToken ct)
    {
        var post = await postService.PublishNowAsync(currentUser.UserId!.Value, id, ct);
        if (post == null) return Results.BadRequest("Post not found or is not a draft.");
        return Results.Ok(post);
    }

    private static async Task<IResult> RefreshEngagement(
        int id,
        ICurrentUserService currentUser,
        IEngagementService engagementService,
        CancellationToken ct)
    {
        var post = await engagementService.RefreshEngagementAsync(currentUser.UserId!.Value, id, ct);
        if (post == null) return Results.NotFound();
        return Results.Ok(post);
    }
}
