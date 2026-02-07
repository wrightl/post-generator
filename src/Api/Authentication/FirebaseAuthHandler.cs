using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PostGenerator.Api.Data;
using PostGenerator.Api.Extensions;
using PostGenerator.Api.Services;

namespace PostGenerator.Api.Authentication;

public class FirebaseAuthHandler : AuthenticationHandler<FirebaseAuthOptions>
{
    public FirebaseAuthHandler(
        IOptionsMonitor<FirebaseAuthOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var token = Request.GetBearerToken();
        if (string.IsNullOrEmpty(token))
            return AuthenticateResult.NoResult();

        var firebaseAuth = Context.RequestServices.GetRequiredService<IFirebaseAuthService>();
        var result = await firebaseAuth.VerifyIdTokenAsync(token, Context.RequestAborted);
        if (result == null)
            return AuthenticateResult.Fail("Invalid or expired token");

        var db = Context.RequestServices.GetRequiredService<AppDbContext>();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.ExternalId == result.Uid, Context.RequestAborted);
        if (user == null)
            return AuthenticateResult.Fail("User not found");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("sub", result.Uid),
            new(ClaimTypes.Email, result.Email ?? "")
        };
        if (!string.IsNullOrEmpty(result.Name))
            claims.Add(new Claim(ClaimTypes.Name, result.Name));

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return AuthenticateResult.Success(ticket);
    }
}
