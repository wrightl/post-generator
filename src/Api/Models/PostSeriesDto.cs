namespace PostGenerator.Api.Models;

public record PostSeriesDto(int Id, int UserId, string TopicDetail, int NumPosts, string? OptionsJson, DateTime CreatedAt);
