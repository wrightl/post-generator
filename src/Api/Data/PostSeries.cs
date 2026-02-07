using System.ComponentModel.DataAnnotations.Schema;

namespace PostGenerator.Api.Data;

public class PostSeries
{
    public int Id { get; set; }
    public int UserId { get; set; }
    [Column(TypeName = "nvarchar(max)")]
    public string TopicDetail { get; set; } = null!;
    public int NumPosts { get; set; }
    [Column(TypeName = "nvarchar(max)")]
    public string? OptionsJson { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}
