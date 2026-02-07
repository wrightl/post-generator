using PostGenerator.Api.Models;

namespace PostGenerator.Api.Services;

public interface ISeriesService
{
    /// <summary>Generate a series and its posts. Returns (seriesId, postIds) or null if generation failed.</summary>
    Task<(int SeriesId, IReadOnlyList<int> PostIds)?> GenerateAsync(int userId, GenerateSeriesRequest request, CancellationToken cancellationToken = default);
}
