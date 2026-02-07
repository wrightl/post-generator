namespace PostGenerator.Api.Services;

public interface IFirebaseAuthService
{
    Task<FirebaseTokenResult?> VerifyIdTokenAsync(string idToken, CancellationToken cancellationToken = default);
}

public record FirebaseTokenResult(string Uid, string Email, string? Name);
