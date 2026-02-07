namespace PostGenerator.Api.Models;

/// <summary>Key-value credentials for one platform. Send only keys to update; omit or empty string keeps existing.</summary>
public record SetSocialCredentialRequest(IReadOnlyDictionary<string, string?>? Credentials);
