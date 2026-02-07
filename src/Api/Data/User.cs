namespace PostGenerator.Api.Data;

public class User
{
    public int Id { get; set; }
    public string ExternalId { get; set; } = null!; // Firebase UID
    public string Email { get; set; } = null!;
    public string? Name { get; set; }
    /// <summary>Preferred theme: "light" or "dark".</summary>
    public string? PreferredTheme { get; set; }
    public DateTime CreatedAt { get; set; }
}
