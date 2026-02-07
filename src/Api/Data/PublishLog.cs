using PostGenerator.Core;

namespace PostGenerator.Api.Data;

public class PublishLog
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public PostPlatform Platform { get; set; }
    public bool Succeeded { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? MailgunSentAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public Post Post { get; set; } = null!;
}
