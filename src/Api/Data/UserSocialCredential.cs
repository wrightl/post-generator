namespace PostGenerator.Api.Data;

/// <summary>
/// Per-user, per-platform social media credentials stored as JSON.
/// Keys are platform-specific (e.g. LinkedIn: AccessToken, PersonUrn; Bluesky: Handle, AppPassword).
/// </summary>
public class UserSocialCredential
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>Platform name: LinkedIn, Bluesky, Instagram, Facebook, TikTok, Skool.</summary>
    public string Platform { get; set; } = null!;
    /// <summary>JSON object of credential keys/values. Stored as-is; never log or return raw in list.</summary>
    public string CredentialJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; }
}
