namespace PostGenerator.Core;

public interface IMailgunNotificationService
{
    Task<bool> SendPostPublishedAsync(string toEmail, string platform, string postPreview, CancellationToken cancellationToken = default);
}
