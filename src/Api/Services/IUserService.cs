using PostGenerator.Api.Models;

namespace PostGenerator.Api.Services;

public interface IUserService
{
    /// <summary>Sync or create user from Firebase token; returns null if token invalid.</summary>
    Task<UserDto?> SyncFromTokenAsync(string idToken, CancellationToken cancellationToken = default);

    /// <summary>Get user by id; returns null if not found.</summary>
    Task<UserDto?> GetByIdAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>Update user profile (e.g. preferred theme).</summary>
    Task<bool> UpdateProfileAsync(int userId, UserProfileUpdateRequest request, CancellationToken cancellationToken = default);

    /// <summary>Get all social credentials for the user (values masked).</summary>
    Task<IReadOnlyList<SocialCredentialDto>> GetCredentialsAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>Set or merge credentials for one platform.</summary>
    Task<bool> SetCredentialAsync(int userId, string platform, IReadOnlyDictionary<string, string?>? credentials, CancellationToken cancellationToken = default);
}
