using PostGenerator.Api.Extensions;
using Xunit;

namespace PostGenerator.Api.Tests.Extensions;

public class AuthorizationHeaderExtensionsTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Basic abc")]
    [InlineData("Bearer")]
    [InlineData("Bearer   ")]
    public void GetBearerToken_ReturnsNull_When_InvalidOrEmpty(string? authorization)
    {
        var result = AuthorizationHeaderExtensions.GetBearerToken(authorization);
        Assert.Null(result);
    }

    [Fact]
    public void GetBearerToken_ReturnsToken_When_Valid()
    {
        var result = AuthorizationHeaderExtensions.GetBearerToken("Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.xxx");
        Assert.Equal("eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.xxx", result);
    }

    [Fact]
    public void GetBearerToken_Trims_Whitespace()
    {
        var result = AuthorizationHeaderExtensions.GetBearerToken("  Bearer   token123  ");
        Assert.Equal("token123", result);
    }
}
