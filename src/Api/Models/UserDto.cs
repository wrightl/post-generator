namespace PostGenerator.Api.Models;

public record UserDto(int Id, string Email, string? Name, string? PreferredTheme, string? AvatarUrl, DateTime CreatedAt);
