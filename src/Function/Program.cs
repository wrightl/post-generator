using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PostGenerator.Core;
using PostGenerator.Function.Services;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((ctx, services) =>
    {
        services.AddHttpClient();
        services.Configure<MailgunOptions>(ctx.Configuration.GetSection(MailgunOptions.SectionName));
        services.AddSingleton<IMailgunNotificationService, MailgunNotificationService>();
        services.AddSingleton<IPostPublisher, LinkedInPublisher>();
        services.AddSingleton<IPostPublisher, SkoolPublisher>();
        services.AddSingleton<IPostPublisher, InstagramPublisher>();
        services.AddSingleton<IBlueskySessionService, BlueskySessionService>();
        services.AddSingleton<IPostPublisher, BlueskyPublisher>();
        services.AddSingleton<IPostPublisher, FacebookPublisher>();
        services.AddSingleton<IPostPublisher, TikTokPublisher>();
        services.AddSingleton<PublishRunner>();
    })
    .Build();

host.Run();
