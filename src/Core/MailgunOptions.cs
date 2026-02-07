namespace PostGenerator.Core;

public class MailgunOptions
{
    public const string SectionName = "Mailgun";
    public string ApiKey { get; set; } = "";
    public string Domain { get; set; } = "";
    public string FromAddress { get; set; } = "noreply@example.com";
    public string FromName { get; set; } = "Post Generator";
}
