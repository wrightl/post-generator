using System.Text.Json;
using System.Threading.RateLimiting;
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
using Azure.Storage.Blobs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<FirebaseOptions>(builder.Configuration.GetSection(FirebaseOptions.SectionName));
builder.Services.Configure<AzureOpenAIOptions>(builder.Configuration.GetSection(AzureOpenAIOptions.SectionName));
builder.Services.AddOptions<BlobStorageOptions>()
    .Bind(builder.Configuration.GetSection(BlobStorageOptions.SectionName))
    .ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<BlobStorageOptions>, BlobStorageOptionsValidator>();
builder.Services.Configure<MailgunOptions>(builder.Configuration.GetSection(MailgunOptions.SectionName));
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();
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

builder.AddServiceDefaults();

builder.AddSqlServerDbContext<AppDbContext>(connectionName: "postgeneratordb");

// builder.Services.AddDbContext<AppDbContext>(options =>
// {
//     var conn = builder.Configuration.GetConnectionString("DefaultConnection");
//     if (string.IsNullOrEmpty(conn))
//         throw new InvalidOperationException(
//             "ConnectionStrings:DefaultConnection is required. In Development use user-secrets or set the environment variable.");
//     options.UseSqlServer(conn);
// });

builder.Services.AddHealthChecks();

// builder.Services.AddHealthChecks()
//     .AddDbContextCheck<AppDbContext>("database")
//     .AddCheck<PostGenerator.Api.HealthChecks.BlobStorageHealthCheck>("blob_storage");

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var originsSection = builder.Configuration.GetSection("Cors:Origins").Get<string[]>();
        List<string> origins = new();
        if (originsSection?.Length > 0)
        {
            origins = originsSection.Where(o => !string.IsNullOrWhiteSpace(o)).Select(o => o.Trim()).ToList();
        }
        else
        {
            // Env vars use __ which ASP.NET maps to :, so Cors__Origins in Azure becomes key "Cors:Origins"
            var originsStr = builder.Configuration["Cors:Origins"] ?? builder.Configuration["Cors__Origins"];
            origins = string.IsNullOrWhiteSpace(originsStr)
                ? new List<string> { "http://localhost:3000" }
                : originsStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Where(o => !string.IsNullOrWhiteSpace(o))
                    .Select(o => o.Trim())
                    .ToList();
        }
        if (origins.Count == 0)
            origins = new List<string> { "http://localhost:3000" };

        // origins.Add("https://postgen-web-prod.orangesand-4b8e6f98.uksouth.azurecontainerapps.io");

        policy.WithOrigins(origins.ToArray()).AllowAnyMethod().AllowAnyHeader();
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

builder.AddAzureOpenAIClient(connectionName: "openai")
               .AddChatClient(deploymentName: "openai-chat-deployment");

builder.AddAzureBlobServiceClient(connectionName: "blobs");


builder.Services.AddAuthentication(FirebaseAuthOptions.DefaultScheme)
    .AddScheme<FirebaseAuthOptions, FirebaseAuthHandler>(FirebaseAuthOptions.DefaultScheme, _ => { });
builder.Services.AddAuthorization();

var app = builder.Build();

// Run migrations at startup (required for app to function)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

// // Ensure blob container exists in background so slow/unavailable storage does not block startup
// _ = Task.Run(async () =>
// {
//     try
//     {
//         await using var scope = app.Services.CreateAsyncScope();
//         var blobOptions = scope.ServiceProvider.GetRequiredService<IOptions<BlobStorageOptions>>().Value;
//         var blobServiceClient = app.Services.GetRequiredService<BlobServiceClient>();
//         var containerClient = blobServiceClient.GetBlobContainerClient(blobOptions.ContainerName);
//         await containerClient.CreateIfNotExistsAsync();
//     }
//     catch
//     {
//         // Best-effort; health check will report blob status
//     }
// });

// app.Use(async (context, next) =>
// {
//     context.Request.EnableBuffering();
//     await next();
// });
// Only redirect HTTP→HTTPS when running locally. In Azure Container Apps the ingress terminates TLS
// and forwards HTTP to the app; running redirect here would run before CORS and break preflight.
if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
    app.MapDefaultEndpoints();
else
    app.MapHealthChecks("/health");
app.MapGet("/ready", () => Results.Ok(new { status = "ready: " + (app.Configuration["Cors:Origins"] ?? app.Configuration["Cors__Origins"] ?? "") }));

app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapDashboardEndpoints();
app.MapPostEndpoints();
app.MapSeriesEndpoints();

app.Run();
