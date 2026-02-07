namespace PostGenerator.Function.Services;

public interface IBlueskySessionService
{
    /// <summary>
    /// Returns a valid session (access JWT and DID). Creates and caches a session if needed.
    /// Returns null if configuration is missing or createSession fails.
    /// </summary>
    Task<(string AccessJwt, string Did)?> GetSessionAsync(CancellationToken ct = default);
}
