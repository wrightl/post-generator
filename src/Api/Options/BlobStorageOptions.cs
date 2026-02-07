namespace PostGenerator.Api.Options;

public class BlobStorageOptions
{
    public const string SectionName = "BlobStorage";
    public string ConnectionString { get; set; } = "";
    public string ContainerName { get; set; } = "post-images";
}
