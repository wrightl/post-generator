using System.IO.Pipelines;
using System.Text.Json;
using PostGenerator.Api.EndpointFilters;
using PostGenerator.Api.Models;
using PostGenerator.Api.Services;
using PostGenerator.Api.Validators;

namespace PostGenerator.Api.Endpoints;

public static class SeriesEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static void MapSeriesEndpoints(this WebApplication app)
    {
        app.MapPost("/api/series/generate", Generate).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>().AddEndpointFilter<ValidationFilter<GenerateSeriesRequest>>();
        app.MapPost("/api/series/generate-stream", GenerateStream).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>().AddEndpointFilter<ValidationFilter<GenerateSeriesRequest>>();
        app.MapPost("/api/series/publish-generated", PublishGenerated).RequireAuthorization().AddEndpointFilter<RequireCurrentUserFilter>().AddEndpointFilter<ValidationFilter<PublishGeneratedSeriesRequest>>();
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

    private static async Task<IResult> PublishGenerated(
        PublishGeneratedSeriesRequest req,
        ICurrentUserService currentUser,
        ISeriesService seriesService,
        CancellationToken ct)
    {
        var (seriesId, postIds) = await seriesService.PublishGeneratedSeriesAsync(currentUser.UserId!.Value, req, ct);
        return Results.Ok(new { seriesId, postIds });
    }

    private static IResult GenerateStream(
        GenerateSeriesRequest req,
        ICurrentUserService currentUser,
        ISeriesService seriesService,
        ILoggerFactory loggerFactory,
        CancellationToken ct)
    {
        var pipe = new Pipe();
        var userId = currentUser.UserId!.Value;
        var logger = loggerFactory.CreateLogger("PostGenerator.Api.Endpoints.SeriesEndpoints");

        var writeTask = WriteStreamAsync(pipe.Writer, seriesService, userId, req, ct);
        writeTask.ContinueWith(t =>
        {
            if (t.IsFaulted && t.Exception != null)
                logger.LogError(t.Exception, "Series generate stream writer failed");
        }, TaskContinuationOptions.OnlyOnFaulted);

        return Results.Stream(pipe.Reader.AsStream(), "application/x-ndjson");
    }

    private static async Task WriteStreamAsync(PipeWriter writer, ISeriesService seriesService, int userId, GenerateSeriesRequest req, CancellationToken ct)
    {
        try
        {
            var first = true;
            await seriesService.GenerateStreamAsync(userId, req, async (seriesId, post, _) =>
            {
                if (first)
                {
                    var seriesLine = JsonSerializer.Serialize(new { seriesId }, JsonOptions) + "\n";
                    var bytes = System.Text.Encoding.UTF8.GetBytes(seriesLine);
                    await writer.WriteAsync(bytes.AsMemory(), ct);
                    await writer.FlushAsync(ct);
                    first = false;
                }
                var postLine = JsonSerializer.Serialize(new { post }, JsonOptions) + "\n";
                var postBytes = System.Text.Encoding.UTF8.GetBytes(postLine);
                await writer.WriteAsync(postBytes.AsMemory(), ct);
                await writer.FlushAsync(ct);
            }, ct);
        }
        catch (Exception ex)
        {
            var errorLine = JsonSerializer.Serialize(new { error = ex.Message }, JsonOptions) + "\n";
            var errorBytes = System.Text.Encoding.UTF8.GetBytes(errorLine);
            await writer.WriteAsync(errorBytes.AsMemory(), ct);
            await writer.FlushAsync(ct);
        }
        finally
        {
            await writer.CompleteAsync();
        }
    }
}
