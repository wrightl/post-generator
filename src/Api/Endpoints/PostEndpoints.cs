using PostGenerator.Api.EndpointFilters;
using PostGenerator.Api.Models;
using PostGenerator.Api.Services;
using PostGenerator.Api.Validators;

namespace PostGenerator.Api.Endpoints;

public static class PostEndpoints
{
    public static void MapPostEndpoints(this WebApplication app)
    {
        app.MapGet("/api/posts", List).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapGet("/api/posts/{id:int}", GetById).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapGet("/api/posts/{id:int}/image", GetImage).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapPost("/api/posts", Create).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>().AddEndpointFilter<ValidationFilter<CreatePostRequest>>();
        app.MapPatch("/api/posts/{id:int}", Update).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>().AddEndpointFilter<ValidationFilter<UpdatePostRequest>>();
        app.MapDelete("/api/posts/{id:int}", Delete).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        // app.MapPost("/api/posts/{id:int}/generate-image", GenerateImage).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapPost("/api/posts/{id:int}/upload-image", UploadImage)
            .DisableAntiforgery()
            .RequireAuthorization()
            .AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapDelete("/api/posts/{id:int}/image", RemoveImage).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapPost("/api/posts/{id:int}/publish-now", PublishNow).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
        app.MapPost("/api/posts/{id:int}/refresh-engagement", RefreshEngagement).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>();
    }

    private const long MaxUploadImageBytes = 5 * 1024 * 1024; // 5MB
    private static readonly HashSet<string> AllowedImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
    };

    private static readonly byte[] JpegMagic = { 0xFF, 0xD8, 0xFF };
    private static readonly byte[] PngMagic = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
    private static readonly byte[] GifMagic87 = { 0x47, 0x49, 0x46, 0x38, 0x37, 0x61 }; // GIF87a
    private static readonly byte[] GifMagic89 = { 0x47, 0x49, 0x46, 0x38, 0x39, 0x61 }; // GIF89a
    private static readonly byte[] WebpMagicRiff = { 0x52, 0x49, 0x46, 0x46 }; // RIFF
    private static readonly byte[] WebpMagicWebp = { 0x57, 0x45, 0x42, 0x50 }; // WEBP at offset 8

    private static bool MatchesImageMagicBytes(byte[] header, string contentType)
    {
        if (header.Length < 12) return false;
        if (contentType.StartsWith("image/jpeg", StringComparison.OrdinalIgnoreCase) || contentType.StartsWith("image/jpg", StringComparison.OrdinalIgnoreCase))
            return header.AsSpan(0, 3).SequenceEqual(JpegMagic);
        if (contentType.StartsWith("image/png", StringComparison.OrdinalIgnoreCase))
            return header.AsSpan(0, 8).SequenceEqual(PngMagic);
        if (contentType.StartsWith("image/gif", StringComparison.OrdinalIgnoreCase))
            return header.AsSpan(0, 6).SequenceEqual(GifMagic87) || header.AsSpan(0, 6).SequenceEqual(GifMagic89);
        if (contentType.StartsWith("image/webp", StringComparison.OrdinalIgnoreCase))
            return header.AsSpan(0, 4).SequenceEqual(WebpMagicRiff) && header.AsSpan(8, 4).SequenceEqual(WebpMagicWebp);
        return false;
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

    private static async Task<IResult> GetImage(
        int id,
        ICurrentUserService currentUser,
        IPostService postService,
        IImageService imageService,
        CancellationToken ct)
    {
        var post = await postService.GetByIdAsync(currentUser.UserId!.Value, id, ct);
        if (post == null || string.IsNullOrEmpty(post.ImageUrl))
            return Results.NotFound();

        var result = await imageService.GetImageAsync(post.ImageUrl, ct);
        if (result == null)
            return Results.NotFound();

        return Results.File(result.Value.Stream, result.Value.ContentType);
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

    // private static async Task<IResult> GenerateImage(
    //     int id,
    //     GenerateImageRequest? request,
    //     ICurrentUserService currentUser,
    //     IPostService postService,
    //     CancellationToken ct)
    // {
    //     try
    //     {
    //         var post = await postService.GenerateImageAsync(currentUser.UserId!.Value, id, request?.Prompt, ct);
    //         if (post == null) return Results.BadRequest(new { message = "Post not found or image generation failed." });
    //         return Results.Ok(post);
    //     }
    //     catch (HttpRequestException ex)
    //     {
    //         return Results.BadRequest(new { message = ex.Message });
    //     }
    //     catch (RequestFailedException ex)
    //     {
    //         return Results.BadRequest(new { message = ex.Message });
    //     }
    // }

    private static async Task<IResult> UploadImage(
        int id,
        IFormFile? file,
        ICurrentUserService currentUser,
        IPostService postService,
        IImageService imageService,
        CancellationToken ct)
    {
        var post = await postService.GetByIdAsync(currentUser.UserId!.Value, id, ct);
        if (post == null) return Results.NotFound();
        if (post.Status != "Draft" && post.Status != "Scheduled")
            return Results.BadRequest(new { message = "Only draft or scheduled posts can have an image uploaded." });

        if (file == null || file.Length == 0)
            return Results.BadRequest(new { message = "No file or empty file." });
        if (file.Length > MaxUploadImageBytes)
            return Results.BadRequest(new { message = "File size must be 5MB or less." });
        if (!AllowedImageContentTypes.Contains(file.ContentType))
            return Results.BadRequest(new { message = "Allowed types: image/jpeg, image/png, image/webp, image/gif." });

        var header = new byte[12];
        await using (var probe = file.OpenReadStream())
        {
            var read = await probe.ReadAtLeastAsync(header.AsMemory(0, 12), 12, throwOnEndOfStream: false, ct);
            if (read < 12 || !MatchesImageMagicBytes(header, file.ContentType))
                return Results.BadRequest(new { message = "File content does not match the declared image type." });
        }

        try
        {
            await using var stream = file.OpenReadStream();
            var url = await imageService.UploadAsync(stream, id.ToString(), file.ContentType, ct);
            var updated = await postService.SetPostImageUrlAsync(currentUser.UserId!.Value, id, url, ct);
            return Results.Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { message = ex.Message });
        }
    }

    private static async Task<IResult> RemoveImage(
        int id,
        ICurrentUserService currentUser,
        IPostService postService,
        CancellationToken ct)
    {
        var updated = await postService.SetPostImageUrlAsync(currentUser.UserId!.Value, id, null, ct);
        if (updated == null) return Results.NotFound();
        return Results.Ok(updated);
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
