namespace PostGenerator.Api.Services;

public interface IImageService
{
    Task<string?> GenerateAndUploadAsync(string prompt, string fileName, CancellationToken cancellationToken = default);
}
