using System.Text.Json;
using System.Threading.RateLimiting;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using FluentValidation;
using PostGenerator.Api.Authentication;
using PostGenerator.Api.Data;
using PostGenerator.Api.Endpoints;
using PostGenerator.Api.Middleware;
using PostGenerator.Api.Models;
using PostGenerator.Api.Options;
using PostGenerator.Api.Services;
using PostGenerator.Api.Validators;
using PostGenerator.Core;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<FirebaseOptions>(builder.Configuration.GetSection(FirebaseOptions.SectionName));
builder.Services.Configure<AzureOpenAIOptions>(builder.Configuration.GetSection(AzureOpenAIOptions.SectionName));
builder.Services.Configure<BlobStorageOptions>(builder.Configuration.GetSection(BlobStorageOptions.SectionName));
builder.Services.Configure<MailgunOptions>(builder.Configuration.GetSection(MailgunOptions.SectionName));
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddHttpClient();
builder.Services.AddSingleton<IAzureOpenAIClientProvider, AzureOpenAIClientProvider>();
builder.Services.AddScoped<IMailgunNotificationService, MailgunNotificationService>();
builder.Services.AddScoped<IPostGenerationService, PostGenerationService>();
builder.Services.AddScoped<IImageService, ImageService>();
builder.Services.AddSingleton<IFirebaseAuthService, FirebaseAuthService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IPostService, PostService>();
builder.Services.AddScoped<IEngagementService, EngagementService>();
builder.Services.AddScoped<ISeriesService, SeriesService>();

builder.Services.AddValidatorsFromAssemblyContaining<CreatePostRequestValidator>();
builder.Services.AddScoped<ValidationFilter<CreatePostRequest>>();
builder.Services.AddScoped<ValidationFilter<UpdatePostRequest>>();
builder.Services.AddScoped<ValidationFilter<GenerateSeriesRequest>>();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    var conn = builder.Configuration.GetConnectionString("DefaultConnection");
    var isDev = builder.Environment.IsDevelopment();
    if (string.IsNullOrEmpty(conn))
    {
        if (!isDev)
            throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required in non-Development environments.");
        options.UseSqlServer("Server=localhost,1433;Database=PostGenerator;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=True;");
    }
    else
        options.UseSqlServer(conn);
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("database")
    .AddCheck<PostGenerator.Api.HealthChecks.BlobStorageHealthCheck>("blob_storage")
    .AddCheck<PostGenerator.Api.HealthChecks.AzureOpenAIHealthCheck>("azure_openai");

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var originsSection = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();
        string[] origins;
        if (originsSection?.Length > 0)
        {
            origins = originsSection.Where(o => !string.IsNullOrWhiteSpace(o)).Select(o => o.Trim()).ToArray();
        }
        else
        {
            // Env vars use __ which ASP.NET maps to :, so Cors__Origins in Azure becomes key "Cors:Origins"
            var originsStr = builder.Configuration["Cors:Origins"] ?? builder.Configuration["Cors__Origins"];
            origins = string.IsNullOrWhiteSpace(originsStr)
                ? new[] { "http://localhost:3000" }
                : originsStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Where(o => !string.IsNullOrWhiteSpace(o))
                    .Select(o => o.Trim())
                    .ToArray();
        }
        if (origins.Length == 0)
            origins = new[] { "http://localhost:3000" };
        policy.WithOrigins(origins).AllowAnyMethod().AllowAnyHeader();
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        var userId = ctx.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var partitionKey = !string.IsNullOrEmpty(userId) ? "user:" + userId : (ctx.Connection.RemoteIpAddress?.ToString() ?? "anon");
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 100, Window = TimeSpan.FromMinutes(1) });
    });
});

builder.Services.AddAuthentication(FirebaseAuthOptions.DefaultScheme)
    .AddScheme<FirebaseAuthOptions, FirebaseAuthHandler>(FirebaseAuthOptions.DefaultScheme, _ => { });
builder.Services.AddAuthorization();

var app = builder.Build();

// Log CORS origins at startup (Warning so it appears even when default log level is Warning in prod)
var corsSection = app.Configuration.GetSection("Cors:Origins").Get<string[]>();
var corsStr = app.Configuration["Cors:Origins"] ?? app.Configuration["Cors__Origins"];
var loggedOrigins = corsSection?.Length > 0
    ? string.Join(", ", corsSection.Where(o => !string.IsNullOrWhiteSpace(o)).Select(o => o.Trim()))
    : string.IsNullOrWhiteSpace(corsStr)
        ? "http://localhost:3000 (default)"
        : string.Join(", ", corsStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(o => !string.IsNullOrWhiteSpace(o)).Select(o => o.Trim()));
app.Logger.LogWarning("CORS allowed origins: {Origins}", loggedOrigins);

// Run migrations at startup (required for app to function)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// Ensure blob container exists in background so slow/unavailable storage does not block startup
_ = Task.Run(async () =>
{
    try
    {
        await using var scope = app.Services.CreateAsyncScope();
        var blobOptions = scope.ServiceProvider.GetRequiredService<IOptions<BlobStorageOptions>>().Value;
        if (!string.IsNullOrEmpty(blobOptions.ConnectionString))
        {
            var containerClient = new BlobContainerClient(blobOptions.ConnectionString, blobOptions.ContainerName);
            await containerClient.CreateIfNotExistsAsync();
        }
    }
    catch
    {
        // Best-effort; health check will report blob status
    }
});

app.Use(async (context, next) =>
{
    context.Request.EnableBuffering();
    await next();
});
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapHealthChecks("/health");
app.MapGet("/ready", () => Results.Ok(new { status = "ready: " + app.Configuration["Cors:Origins"] ?? app.Configuration["Cors__Origins"] }));

app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapDashboardEndpoints();
app.MapPostEndpoints();
app.MapSeriesEndpoints();

app.Run();
