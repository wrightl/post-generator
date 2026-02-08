using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PostGenerator.Api.Data;
using PostGenerator.Api.Models;

namespace PostGenerator.Api.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _db;
    private readonly IFirebaseAuthService _firebaseAuth;

    public UserService(AppDbContext db, IFirebaseAuthService firebaseAuth)
    {
        _db = db;
        _firebaseAuth = firebaseAuth;
    }

    public async Task<UserDto?> SyncFromTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        var result = await _firebaseAuth.VerifyIdTokenAsync(idToken, cancellationToken);
        if (result == null) return null;

        var user = await _db.Users.FirstOrDefaultAsync(u => u.ExternalId == result.Uid, cancellationToken);
        if (user == null)
        {
            user = new User
            {
                ExternalId = result.Uid,
                Email = result.Email,
                Name = result.Name,
                CreatedAt = DateTime.UtcNow
            };
            _db.Users.Add(user);
        }
        else
        {
            user.Email = result.Email;
            user.Name = result.Name;
        }
        await _db.SaveChangesAsync(cancellationToken);
        return new UserDto(user.Id, user.Email, user.Name, user.PreferredTheme, user.AvatarUrl, user.CreatedAt);
    }

    public async Task<UserDto?> GetByIdAsync(int userId, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        return user == null ? null : new UserDto(user.Id, user.Email, user.Name, user.PreferredTheme, user.AvatarUrl, user.CreatedAt);
    }

    public async Task<bool> UpdateProfileAsync(int userId, UserProfileUpdateRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        if (user == null) return false;
        if (request.PreferredTheme is "light" or "dark")
            user.PreferredTheme = request.PreferredTheme;
        else if (request.PreferredTheme != null)
            user.PreferredTheme = null;
        if (request.AvatarUrl != null && request.AvatarUrl.Length > 2_000_000)
            throw new ArgumentException("Avatar URL must be 2,000,000 characters or less.", nameof(request));
        user.AvatarUrl = request.AvatarUrl;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<SocialCredentialDto>> GetCredentialsAsync(int userId, CancellationToken cancellationToken = default)
    {
        var stored = await _db.UserSocialCredentials
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .ToDictionaryAsync(c => c.Platform, c => c.CredentialJson, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var result = new List<SocialCredentialDto>();
        foreach (var platform in SocialPlatformKeys.AllPlatforms)
        {
            var keys = SocialPlatformKeys.KeysByPlatform.TryGetValue(platform, out var k) ? k : Array.Empty<string>();
            var masked = new Dictionary<string, string?>();
            if (stored.TryGetValue(platform, out var json))
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, string?>>(json) ?? new Dictionary<string, string?>();
                foreach (var key in keys)
                    masked[key] = dict.TryGetValue(key, out var v) && !string.IsNullOrEmpty(v) ? "***" : null;
            }
            else
            {
                foreach (var key in keys)
                    masked[key] = null;
            }
            result.Add(new SocialCredentialDto(platform, masked));
        }
        return result;
    }

    public async Task<bool> SetCredentialAsync(int userId, string platform, IReadOnlyDictionary<string, string?>? credentials, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(platform) || platform.Length > 32) return false;
        platform = platform.Trim();
        var existing = await _db.UserSocialCredentials.FirstOrDefaultAsync(c => c.UserId == userId && c.Platform == platform, cancellationToken);
        var dict = new Dictionary<string, string?>();
        if (existing != null)
        {
            dict = JsonSerializer.Deserialize<Dictionary<string, string?>>(existing.CredentialJson) ?? new Dictionary<string, string?>();
        }
        if (credentials != null)
        {
            foreach (var kv in credentials)
            {
                if (string.IsNullOrEmpty(kv.Value))
                    dict.Remove(kv.Key);
                else
                    dict[kv.Key] = kv.Value;
            }
        }
        var json = JsonSerializer.Serialize(dict);
        if (existing != null)
        {
            existing.CredentialJson = json;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _db.UserSocialCredentials.Add(new UserSocialCredential
            {
                UserId = userId,
                Platform = platform,
                CredentialJson = json,
                UpdatedAt = DateTime.UtcNow
            });
        }
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
