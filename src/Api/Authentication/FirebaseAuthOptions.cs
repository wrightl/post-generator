using Microsoft.AspNetCore.Authentication;

namespace PostGenerator.Api.Authentication;

public class FirebaseAuthOptions : AuthenticationSchemeOptions
{
    public const string DefaultScheme = "Firebase";
    public string Scheme { get; set; } = DefaultScheme;
}
