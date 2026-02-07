using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Moq;
using PostGenerator.Api.Services;
using Xunit;

namespace PostGenerator.Api.Tests.Services;

public class CurrentUserServiceTests
{
    [Fact]
    public void UserId_ReturnsNull_When_HttpContext_Null()
    {
        var accessor = new Mock<IHttpContextAccessor>();
        accessor.Setup(x => x.HttpContext).Returns((HttpContext?)null);
        var service = new CurrentUserService(accessor.Object);
        Assert.Null(service.UserId);
    }

    [Fact]
    public void UserId_ReturnsNull_When_User_HasNo_NameIdentifier()
    {
        var accessor = new Mock<IHttpContextAccessor>();
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity());
        accessor.Setup(x => x.HttpContext).Returns(context);
        var service = new CurrentUserService(accessor.Object);
        Assert.Null(service.UserId);
    }

    [Fact]
    public void UserId_ReturnsValue_When_User_Has_NameIdentifier()
    {
        var accessor = new Mock<IHttpContextAccessor>();
        var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "42") }, "Test");
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(identity);
        accessor.Setup(x => x.HttpContext).Returns(context);
        var service = new CurrentUserService(accessor.Object);
        Assert.Equal(42, service.UserId);
    }

    [Fact]
    public void ExternalId_ReturnsSub_When_Present()
    {
        var accessor = new Mock<IHttpContextAccessor>();
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim("sub", "firebase-uid-123")
        }, "Test");
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(identity);
        accessor.Setup(x => x.HttpContext).Returns(context);
        var service = new CurrentUserService(accessor.Object);
        Assert.Equal("firebase-uid-123", service.ExternalId);
    }
}
