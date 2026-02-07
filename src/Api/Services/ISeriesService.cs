using PostGenerator.Api.Models;

namespace PostGenerator.Api.Services;

public interface ISeriesService
{
    /// <summary>Generate a series and its posts. Returns (seriesId, postIds) or null if generation failed.</summary>
    Task<(int SeriesId, IReadOnlyList<int> PostIds)?> GenerateAsync(int userId, GenerateSeriesRequest request, CancellationToken cancellationToken = default);

    /// <summary>Generate a series and its posts one at a time, invoking onPost for each saved post. Throws on failure.</summary>
    Task GenerateStreamAsync(int userId, GenerateSeriesRequest request, Func<int, PostDto, CancellationToken, Task> onPost, CancellationToken cancellationToken = default);
}
