namespace PostGenerator.Api.Services;

public interface IImageService
{
    // Task<string?> GenerateAndUploadAsync(string prompt, string fileName, CancellationToken cancellationToken = default);

    /// <summary>Uploads a stream to blob storage and returns the blob URL. Throws if blob storage is not configured.</summary>
    Task<string> UploadAsync(Stream stream, string hint, string contentType, CancellationToken cancellationToken = default);

    /// <summary>Downloads an image from our blob storage by URL. Returns (stream, contentType) or null if URL is not our blob or blob not found. Caller must dispose the stream.</summary>
    Task<(Stream Stream, string ContentType)?> GetImageAsync(string imageUrl, CancellationToken cancellationToken = default);
}
