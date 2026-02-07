using PostGenerator.Api.Models;
using PostGenerator.Api.Validators;
using Xunit;

namespace PostGenerator.Api.Tests.Validators;

public class CreatePostRequestValidatorTests
{
    private readonly CreatePostRequestValidator _validator = new();

    [Fact]
    public void Should_HaveError_When_TopicSummary_Empty()
    {
        var req = new CreatePostRequest("", "LinkedIn", null, null, null, null, null, null, null);
        var result = _validator.Validate(req);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreatePostRequest.TopicSummary));
    }

    [Fact]
    public void Should_NotHaveError_When_TopicSummary_Provided()
    {
        var req = new CreatePostRequest("A topic", "LinkedIn", null, null, null, null, null, null, null);
        var result = _validator.Validate(req);
        Assert.True(result.IsValid);
    }

    [Fact]
    public void Should_HaveError_When_Platform_Invalid()
    {
        var req = new CreatePostRequest("Topic", "InvalidPlatform", null, null, null, null, null, null, null);
        var result = _validator.Validate(req);
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreatePostRequest.Platform));
    }

    [Theory]
    [InlineData("LinkedIn")]
    [InlineData("Bluesky")]
    [InlineData("instagram")]
    public void Should_NotHaveError_When_Platform_Valid(string platform)
    {
        var req = new CreatePostRequest("Topic", platform, null, null, null, null, null, null, null);
        var result = _validator.Validate(req);
        Assert.True(result.IsValid);
    }
}
