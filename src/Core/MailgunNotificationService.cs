using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Options;

namespace PostGenerator.Core;

public class MailgunNotificationService : IMailgunNotificationService
{
    private readonly MailgunOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;

    public MailgunNotificationService(IOptions<MailgunOptions> options, IHttpClientFactory httpClientFactory)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<bool> SendPostPublishedAsync(string toEmail, string platform, string postPreview, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(_options.ApiKey) || string.IsNullOrEmpty(_options.Domain))
            return false;

        var client = _httpClientFactory.CreateClient();
        var auth = Convert.ToBase64String(Encoding.ASCII.GetBytes($"api:{_options.ApiKey}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", auth);

        var form = new Dictionary<string, string>
        {
            ["from"] = $"{_options.FromName} <{_options.FromAddress}>",
            ["to"] = toEmail,
            ["subject"] = $"Your post was published on {platform}",
            ["text"] = $"Your scheduled post was published on {platform}.\n\nPreview:\n{postPreview}",
        };

        var content = new FormUrlEncodedContent(form);
        var url = $"https://api.mailgun.net/v3/{_options.Domain}/messages";
        var response = await client.PostAsync(url, content, cancellationToken);
        return response.IsSuccessStatusCode;
    }
}
