using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Options;

namespace PostGenerator.Api.Services;

public class FirebaseAuthService : IFirebaseAuthService
{
    private readonly FirebaseApp? _app;

    public FirebaseAuthService(IOptions<FirebaseOptions> options)
    {
        var opts = options.Value;
        if (string.IsNullOrEmpty(opts.ProjectId))
        {
            _app = null;
            return;
        }
        var appOptions = new AppOptions { ProjectId = opts.ProjectId };
        if (!string.IsNullOrEmpty(opts.CredentialJsonBase64))
        {
            var json = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(opts.CredentialJsonBase64));
            appOptions.Credential = GoogleCredential.FromJson(json);
        }
        else if (!string.IsNullOrEmpty(opts.CredentialPath) && File.Exists(opts.CredentialPath))
        {
            appOptions.Credential = GoogleCredential.FromFile(opts.CredentialPath);
        }
        else
        {
            appOptions.Credential = GoogleCredential.GetApplicationDefault();
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
        catch
        {
            return null;
        }
    }
}
