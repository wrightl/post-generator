using Azure.Core;
using Azure.Provisioning.CognitiveServices;

var builder = DistributedApplication.CreateBuilder(args);

var apiName = "postgenerator-api";
var frontendName = "Web";
var appName = "postgenerator";
var speechRegion = "westeurope";
var documentstorageName = "documentstorage";
var blobName = "blobs";
var openaiName = "openai";
var chatModelName = "gpt-5-mini";
var chatModelVersion = "2025-08-07";
var modelSkuName = "GlobalStandard";
var sqlServerName = $"{appName}";
var sqlDbName = $"{appName}db";
var defaultMailgunFromName = "Post Generator";
var defaultMailgunFromAddress = "noreply@example.com";

// Variables & secrets
var replicas = builder.AddParameter("minReplicas");
var sqlPassword = builder.AddParameter($"{sqlServerName}-password", secret: true);

// custom domain and certificate for container app - these are only needed for the deployment to azure
var certificateNameApiFromConfig = builder.Configuration["CERTIFICATE_NAME_API"] ?? "";
var certificateNameAppFromConfig = builder.Configuration["CERTIFICATE_NAME_APP"] ?? "";
var customDomainApiFromConfig = builder.Configuration["CUSTOMDOMAIN_API"] ?? "";
var customDomainAppFromConfig = builder.Configuration["CUSTOMDOMAIN_APP"] ?? "";
var customDomainApi = builder.AddParameter("customDomainApi", customDomainApiFromConfig, publishValueAsDefault: true);
var certificateNameApi = builder.AddParameter("certificateNameApi", value: certificateNameApiFromConfig, publishValueAsDefault: true);
var customDomainApp = builder.AddParameter("customDomainApp", customDomainAppFromConfig, publishValueAsDefault: true);
var certificateNameApp = builder.AddParameter("certificateNameApp", value: certificateNameAppFromConfig, publishValueAsDefault: true);
var firebaseCredentialsJson = builder.AddParameter("firebase-credentials-json", secret: true);
var firebaseProjectId = builder.AddParameter("firebase-project-id");
var mailgunDomain = builder.AddParameter("mailgun-domain");
var mailgunFromAddress = builder.AddParameter("mailgun-from-address", defaultMailgunFromAddress);
var mailgunFromName = builder.AddParameter("mailgun-from-name", defaultMailgunFromName);
var mailgunApiKey = builder.AddParameter("mailgun-api-key", secret: true);


// App Container Environment
builder.AddAzureContainerAppEnvironment($"{appName}-environment");

// Azure OpenAI
var openai = builder.AddAzureOpenAI(openaiName).ConfigureInfrastructure(infra =>
{
    var openaiService = infra.GetProvisionableResources()
                             .OfType<CognitiveServicesAccount>()
                             .Single();
    openaiService.Location = new AzureLocation(speechRegion);
});

// Chat deployment
openai.AddDeployment(
    name: $"{openaiName}-chat-deployment",
    modelVersion: chatModelVersion,
    modelName: chatModelName)
    .WithProperties(deployment =>
    {
        deployment.SkuName = modelSkuName;
    });

// azure storage
var documentStorage = builder.AddAzureStorage(documentstorageName)
                            .RunAsEmulator(azurite =>
                            {
                                azurite.WithDataVolume();
                            })
                            .AddBlobs(blobName);

var apiService = builder.AddProject<Projects.Api>(apiName)
                        .WithExternalHttpEndpoints()
                        .WithReference(openai)
                        .WithReference(documentStorage)
                        .WithEnvironment("Firebase__ProjectId", firebaseProjectId)
                        .WithEnvironment("Firebase__CredentialJsonBase64", firebaseCredentialsJson)
                        .WithEnvironment("Mailgun__Domain", mailgunDomain)
                        .WithEnvironment("Mailgun__FromAddress", mailgunFromAddress)
                        .WithEnvironment("Mailgun__FromName", mailgunFromName)
                        .WithEnvironment("Mailgun__ApiKey", mailgunApiKey)
                        .WithHttpHealthCheck("/alive")
                        .PublishAsAzureContainerApp((module, app) =>
                        {
                            // Scale to 0
                            app.Template.Scale.MinReplicas = replicas.AsProvisioningParameter(module);
#pragma warning disable ASPIREACADOMAINS001 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
                            app.ConfigureCustomDomain(customDomainApi, certificateNameApi);
#pragma warning restore ASPIREACADOMAINS001 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
                        });


if (builder.ExecutionContext.IsPublishMode)
{
    // // variables and secrets only needed for the deployment to azure
    // // variables
    // var appBaseUrl = builder.AddParameter("app-base-url");
    // var auth0Audience = builder.AddParameter("auth0-audience");
    // // var auth0Scope = builder.AddParameter("auth0-scope", value: "", publishValueAsDefault: true);
    // var apiServerUrl = builder.AddParameter("api-server-url");

    // // secrets
    // var auth0Secret = builder.AddParameter("auth0-secret", secret: true);
    // var auth0ClientSecret = builder.AddParameter("auth0-client-secret", secret: true);
    // var nextPublicLaunchDarklyClientId = builder.AddParameter("next-public-launchdarkly-client-id", secret: true);
    // var googleMapsApiKey = builder.AddParameter("next-public-google-maps-api-key", secret: true);

    // sql azure
    var azureSql = builder.AddAzureSqlServer(sqlServerName);

    var azureDb = azureSql.AddDatabase(sqlDbName);

    apiService.WithReference(azureDb)
              .WaitFor(azureDb);

    // Use Docker container for production frontend
    // Pass DEPLOY_ENV as build argument to select the correct .env file
    var frontend = builder.AddDockerfile(frontendName, "../Web")
        .WithReference(apiService)
        .WaitFor(apiService)
        .WithHttpEndpoint(targetPort: 3000)
        .WithExternalHttpEndpoints()
        .PublishAsAzureContainerApp((module, app) =>
        {
            app.Template.Scale.MinReplicas = replicas.AsProvisioningParameter(module);
#pragma warning disable ASPIREACADOMAINS001 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
            app.ConfigureCustomDomain(customDomainApp, certificateNameApp);
#pragma warning restore ASPIREACADOMAINS001 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
        });
}
else
{
    // sql server
    var sql = builder.AddSqlServer(sqlServerName, password: sqlPassword, port: 49977)
        .WithLifetime(ContainerLifetime.Persistent)
        .WithDataVolume();

    var db = sql.AddDatabase(sqlDbName);

    apiService.WithReference(db)
              .WaitFor(db);


    // Use npm for frontend development
    var frontend = builder.AddNpmApp(frontendName, "../Web", "dev")
        .WithReference(apiService)
        .WaitFor(apiService)
        .WithExternalHttpEndpoints();
}

builder.Build().Run();
