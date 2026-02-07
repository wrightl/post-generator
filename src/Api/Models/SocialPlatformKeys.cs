namespace PostGenerator.Api.Models;

/// <summary>Known credential key names per platform for UI and masking.</summary>
public static class SocialPlatformKeys
{
    public static readonly IReadOnlyList<string> AllPlatforms = new[] { "LinkedIn", "Bluesky", "Instagram", "Facebook", "TikTok", "Skool" };

    public static readonly IReadOnlyDictionary<string, string[]> KeysByPlatform = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        ["LinkedIn"] = new[] { "AccessToken", "PersonUrn" },
        ["Bluesky"] = new[] { "Handle", "AppPassword", "PdsUrl" },
        ["Instagram"] = new[] { "UserId", "AccessToken" },
        ["Facebook"] = new[] { "PageId", "PageAccessToken" },
        ["TikTok"] = new[] { "AccessToken" },
        ["Skool"] = new[] { "ApiKey", "SessionId", "GroupId" },
    };
}
