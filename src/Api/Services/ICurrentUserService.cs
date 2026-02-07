namespace PostGenerator.Api.Services;

public interface ICurrentUserService
{
    int? UserId { get; }
    string? ExternalId { get; }
}
