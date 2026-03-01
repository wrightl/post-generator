using Microsoft.Extensions.Options;

namespace PostGenerator.Api.Options;

public class BlobStorageOptionsValidator : IValidateOptions<BlobStorageOptions>
{
    public ValidateOptionsResult Validate(string? name, BlobStorageOptions options)
    {
        if (options.ContainerName == null)
            return ValidateOptionsResult.Fail("BlobStorage:ContainerName must not be null.");
        return ValidateOptionsResult.Success;
    }
}
