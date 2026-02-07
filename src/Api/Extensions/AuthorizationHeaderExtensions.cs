using Microsoft.AspNetCore.Http;

namespace PostGenerator.Api.Extensions;

public static class AuthorizationHeaderExtensions
{
    private const string BearerPrefix = "Bearer ";

    /// <summary>
    /// Extracts the Bearer token from an Authorization header value (e.g. "Bearer eyJ...").
    /// Returns null if the header is missing, not a Bearer scheme, or empty after trimming.
    /// </summary>
    public static string? GetBearerToken(string? authorization)
    {
        authorization = authorization?.Trim();
        if (string.IsNullOrEmpty(authorization) || !authorization.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
            return null;
        var token = authorization[BearerPrefix.Length..].Trim();
        return string.IsNullOrEmpty(token) ? null : token;
    }

    /// <summary>
    /// Extracts the Bearer token from the current request's Authorization header.
    /// </summary>
    public static string? GetBearerToken(this HttpRequest request)
    {
        var auth = request.Headers.Authorization.FirstOrDefault();
        return GetBearerToken(auth);
    }
}
