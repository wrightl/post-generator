using System.Text.Json;
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class FirebaseAuthService : IFirebaseAuthService
{
    private readonly FirebaseApp? _app;
    private readonly ILogger<FirebaseAuthService> _logger;

    public FirebaseAuthService(IOptions<FirebaseOptions> options, ILogger<FirebaseAuthService> logger)
    {
        _logger = logger;
        var opts = options.Value;
        if (string.IsNullOrEmpty(opts.ProjectId))
        {
            _app = null;
            return;
        }
        var appOptions = new AppOptions { ProjectId = opts.ProjectId };
        var credentialPath = ResolveCredentialPath(opts.CredentialPath);
        if (!string.IsNullOrEmpty(opts.CredentialJsonBase64))
        {
            var json = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(opts.CredentialJsonBase64));
            EnsureServiceAccountJson(json, nameof(FirebaseOptions.CredentialJsonBase64));
            appOptions.Credential = GoogleCredential.FromJson(json);
        }
        else if (!string.IsNullOrEmpty(credentialPath) && File.Exists(credentialPath))
        {
            var json = File.ReadAllText(credentialPath);
            EnsureServiceAccountJson(json, $"file at {credentialPath}");
            appOptions.Credential = GoogleCredential.FromFile(credentialPath);
        }
        else if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")))
        {
            appOptions.Credential = GoogleCredential.GetApplicationDefault();
        }
        else
        {
            _logger.LogWarning(
                "Firebase ProjectId is set but no credentials were found. " +
                "Set Firebase:CredentialPath to a service account JSON file, Firebase:CredentialJsonBase64 to base64-encoded JSON, " +
                "or GOOGLE_APPLICATION_CREDENTIALS. Firebase Auth will be disabled.");
            _app = null;
            return;
        }
        try
        {
            _app = FirebaseApp.Create(appOptions);
        }
        catch (InvalidOperationException)
        {
            _app = FirebaseApp.GetInstance(opts.ProjectId);
        }
    }

    /// <summary>Ensures the JSON is a Google service account key, not the Firebase web app config.</summary>
    private static void EnsureServiceAccountJson(string json, string source)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("type", out var typeEl))
            {
                var type = typeEl.GetString();
                if (string.Equals(type, "service_account", StringComparison.OrdinalIgnoreCase))
                    return;
                throw new InvalidOperationException(
                    $"Firebase credentials from {source} have type \"{type}\". " +
                    "The API requires a service account key (type \"service_account\"). " +
                    "In Firebase Console go to Project Settings → Service Accounts → Generate new private key, and use that JSON file or its base64.");
            }
            if (doc.RootElement.TryGetProperty("apiKey", out _))
                throw new InvalidOperationException(
                    $"Firebase credentials from {source} look like the web app config (apiKey, authDomain). " +
                    "The API needs a service account key. In Firebase Console: Project Settings → Service Accounts → Generate new private key, and use that JSON.");
        }
        catch (InvalidOperationException)
        {
            throw;
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Firebase credentials from {source} are not valid JSON: {ex.Message}. Use a service account key JSON from Firebase Console → Service Accounts → Generate new private key.", ex);
        }
    }

    private static string? ResolveCredentialPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        if (Path.IsPathRooted(path)) return path;
        try
        {
            return Path.GetFullPath(path, Directory.GetCurrentDirectory());
        }
        catch
        {
            return path;
        }
    }

    public async Task<FirebaseTokenResult?> VerifyIdTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        if (_app is null) return null;
        try
        {
            var decoded = await FirebaseAuth.GetAuth(_app).VerifyIdTokenAsync(idToken, cancellationToken);
            var email = decoded.Claims.GetValueOrDefault("email")?.ToString() ?? "";
            var name = decoded.Claims.GetValueOrDefault("name")?.ToString();
            return new FirebaseTokenResult(decoded.Uid, email, name);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Firebase ID token verification failed: {ExceptionType} - {Message}", ex.GetType().Name, ex.Message);
            return null;
        }
    }
}
