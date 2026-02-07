namespace PostGenerator.Api.Options;

public class FirebaseOptions
{
    public const string SectionName = "Firebase";
    public string ProjectId { get; set; } = "";
    /// <summary>Path to service account JSON file, or base64-encoded JSON.</summary>
    public string? CredentialPath { get; set; }
    public string? CredentialJsonBase64 { get; set; }
}
