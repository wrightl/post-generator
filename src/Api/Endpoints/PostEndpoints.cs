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
    }

    private static async Task<IResult> List(
        ICurrentUserService currentUser,
        IPostService postService,
        PostPlatform? platform,
        PostStatus? status,
        DateTime? from,
        DateTime? to,
        CancellationToken ct)
    {
        var list = await postService.ListAsync(currentUser.UserId!.Value, platform, status, from, to, ct);
        return Results.Ok(list);
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
        var post = await postService.GenerateImageAsync(currentUser.UserId!.Value, id, request?.Prompt, ct);
        if (post == null) return Results.BadRequest("Post not found or image generation failed.");
        return Results.Ok(post);
    }
}
