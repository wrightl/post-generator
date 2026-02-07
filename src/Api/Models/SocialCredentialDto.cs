namespace PostGenerator.Api.Models;

/// <summary>Per-platform credentials. Values are masked ("***") when set, null when not set.</summary>
public record SocialCredentialDto(string Platform, IReadOnlyDictionary<string, string?> Credentials);
