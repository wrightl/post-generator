targetScope = 'resourceGroup'

param deployThisTime bool = false

@description('Base name for resources (e.g. postgen)')
param baseName string = 'postgen'

@description('Azure region')
param location string = resourceGroup().location

@description('Environment name (e.g. dev, prod)')
param environmentName string = 'dev'

@description('When true, deploy only Azure OpenAI for local dev (no ACR, Container App, Function, etc.)')
param localDevOnly bool = false

@description('When true, deploy dall-e-3 image model. Set false in regions where Standard SKU is not supported (e.g. West Europe).')
param deployImageModel bool = true

@description('Region for chat (GPT). From AZURE_AI_LOCATION.')
param openAIChatLocation string = 'westeurope'

@description('Region for image (DALL-E). From AZURE_IMAGE_LOCATION.')
param openAIImageLocation string = 'swedencentral'

@description('SQL Server administrator login. From AZURE_SQL_ADMIN_LOGIN.')
param sqlAdminLogin string = 'sqladmin'

@secure()
@description('SQL Server administrator password. From AZURE_SQL_ADMIN_PASSWORD secret.')
param sqlAdminPassword string = ''

@description('Initial API container image (replaced by CD)')
param apiImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Initial Web container image (replaced by CD)')
param webImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Firebase project ID. From FIREBASE_PROJECT_ID.')
param firebaseProjectId string = ''

@secure()
@description('Firebase service account JSON (base64). From FIREBASE_CREDENTIAL_JSON_BASE64.')
param firebaseCredentialJsonBase64 string = ''

@description('Firebase API key. From NEXT_PUBLIC_FIREBASE_API_KEY.')
param firebaseApiKey string = ''

@description('Firebase auth domain. From NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN.')
param firebaseAuthDomain string = ''

@description('Firebase storage bucket. From NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.')
param firebaseStorageBucket string = ''

@description('Firebase messaging sender ID. From NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID.')
param firebaseMessagingSenderId string = ''

@description('Firebase app ID. From NEXT_PUBLIC_FIREBASE_APP_ID.')
param firebaseAppId string = ''

@description('CORS allowed origins (comma-separated). From CORS_ORIGINS.')
param corsOrigins string = ''

@secure()
@description('Mailgun API key. From MAILGUN_API_KEY.')
param mailgunApiKey string = ''

@description('Mailgun domain. From MAILGUN_DOMAIN.')
param mailgunDomain string = ''

@description('Mailgun from address. From MAILGUN_FROM_ADDRESS.')
param mailgunFromAddress string = ''

@description('Mailgun from name. From MAILGUN_FROM_NAME.')
param mailgunFromName string = ''

var uniqueSuffix = uniqueString(resourceGroup().id, baseName)
var acrName = '${baseName}acr${uniqueSuffix}'
var containerAppEnvName = '${baseName}-env-${environmentName}'
var apiAppName = '${baseName}-api-${environmentName}'
var webAppName = '${baseName}-web-${environmentName}'
var functionAppName = '${baseName}-func-${environmentName}'
var storageName = toLower(replace('${baseName}${uniqueSuffix}', '-', ''))
var logAnalyticsName = '${baseName}-logs-${environmentName}'
// var openAIName = '${baseName}-openai-${environmentName}-${uniqueSuffix}' // Unused variable
var openAIChatName = '${baseName}-openai-chat-${environmentName}-${uniqueSuffix}'
var openAIImageName = '${baseName}-openai-image-${environmentName}-${uniqueSuffix}'
var sqlServerName = '${baseName}-sql-${environmentName}-${uniqueSuffix}'
var sqlDatabaseName = 'postgenerator'
var blobContainerName = 'post-images'
var deploymentStorageContainerName = 'app-package-${baseName}-${environmentName}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = if (!localDevOnly) {
  name: logAnalyticsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = if (!localDevOnly) {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: true
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = if (!localDevOnly && deployThisTime) {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = if (!localDevOnly && deployThisTime) {
  parent: storage
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = if (!localDevOnly && deployThisTime) {
  parent: blobService
  name: blobContainerName
}

resource deploymentStorageContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = if (!localDevOnly && deployThisTime) {
  parent: blobService
  name: deploymentStorageContainerName
}

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = if (!localDevOnly) {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2022-05-01-preview' = if (!localDevOnly) {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  sku: {
    name: 'S0'
    tier: 'Standard'
  }
}

resource sqlFirewallRule 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = if (!localDevOnly) {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Local dev: separate accounts so GPT can be in West Europe and DALL-E in Sweden Central regardless of RG location.
resource openaiChatAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (localDevOnly && deployThisTime) {
  name: openAIChatName
  location: openAIChatLocation
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {}
}

resource openaiChatAccountDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = if (localDevOnly && deployThisTime) {
  parent: openaiChatAccount
  name: 'gpt-4o'
  sku: { name: 'GlobalStandard', capacity: 10 }
  properties: {
    model: { name: 'gpt-4o', format: 'OpenAI' }
    raiPolicyName: 'Microsoft.Default'
    versionUpgradeOption: 'OnceCurrentVersionExpired'
  }
}

resource openaiImageAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (localDevOnly && deployImageModel && deployThisTime) {
  name: openAIImageName
  location: openAIImageLocation
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {}
}

resource openaiImageAccountDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = if (localDevOnly && deployImageModel && deployThisTime) {
  parent: openaiImageAccount
  name: 'dall-e-3'
  sku: { name: 'Standard', capacity: 1 }
  properties: {
    model: { name: 'dall-e-3', format: 'OpenAI' }
    raiPolicyName: 'Microsoft.Default'
    versionUpgradeOption: 'OnceCurrentVersionExpired'
  }
}

// Full deploy: chat account in AZURE_AI_LOCATION, image account in AZURE_IMAGE_LOCATION (when deployImageModel).
resource openaiProdChat 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (!localDevOnly && deployThisTime) {
  name: openAIChatName
  location: openAIChatLocation
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {}
}

resource openaiProdChatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = if (!localDevOnly && deployThisTime) {
  parent: openaiProdChat
  name: 'gpt-4o'
  sku: { name: 'GlobalStandard', capacity: 10 }
  properties: {
    model: { name: 'gpt-4o', format: 'OpenAI' }
    raiPolicyName: 'Microsoft.Default'
    versionUpgradeOption: 'OnceCurrentVersionExpired'
  }
}

resource openaiProdImage 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (!localDevOnly && deployImageModel && deployThisTime) {
  name: openAIImageName
  location: openAIImageLocation
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {}
}

resource openaiProdImageDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = if (!localDevOnly && deployImageModel && deployThisTime) {
  parent: openaiProdImage
  name: 'dall-e-3'
  sku: { name: 'Standard', capacity: 1 }
  properties: {
    model: { name: 'dall-e-3', format: 'OpenAI' }
    raiPolicyName: 'Microsoft.Default'
    versionUpgradeOption: 'OnceCurrentVersionExpired'
  }
}

resource containerAppEnv 'Microsoft.App/managedEnvironments@2024-03-01' = if (!localDevOnly) {
  name: containerAppEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics!.properties.customerId
        sharedKey: logAnalytics!.listKeys().primarySharedKey
      }
    }
  }
}

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = if (!localDevOnly) {
  name: apiAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      registries: [{
        server: acr!.properties.loginServer
        username: acr!.listCredentials().username
        passwordSecretRef: 'acr-password'
      }]
      secrets: concat(
        [
          { name: 'acr-password', value: acr!.listCredentials().passwords[0].value }
          { name: 'openai-api-key', value: openaiProdChat!.listKeys().key1 }
          { name: 'sql-connection-string', value: 'Server=tcp:${sqlServer!.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabaseName};Persist Security Info=False;User ID=${sqlAdminLogin};Password=${sqlAdminPassword};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;' }
          { name: 'blob-connection-string', value: 'DefaultEndpointsProtocol=https;AccountName=${storage!.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage!.listKeys().keys[0].value}' }
        ],
        deployImageModel ? [{ name: 'openai-image-api-key', value: openaiProdImage!.listKeys().key1 }] : [],
        firebaseCredentialJsonBase64 != '' ? [{ name: 'firebase-credential-base64', value: firebaseCredentialJsonBase64 }] : [],
        mailgunApiKey != '' ? [{ name: 'mailgun-api-key', value: mailgunApiKey }] : []
      )
    }
    template: {
      containers: [{
        name: 'api'
        image: apiImage
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: concat(
          [
            { name: 'AzureOpenAI__Endpoint', value: openaiProdChat!.properties.endpoint }
            { name: 'AzureOpenAI__ApiKey', secretRef: 'openai-api-key' }
            { name: 'AzureOpenAI__ChatDeploymentName', value: 'gpt-4o' }
            { name: 'AzureOpenAI__ImageDeploymentName', value: 'dall-e-3' }
            { name: 'ConnectionStrings__DefaultConnection', secretRef: 'sql-connection-string' }
            { name: 'BlobStorage__ConnectionString', secretRef: 'blob-connection-string' }
            { name: 'BlobStorage__ContainerName', value: blobContainerName }
            { name: 'Firebase__ProjectId', value: firebaseProjectId }
            { name: 'Cors__Origins', value: corsOrigins }
            { name: 'Mailgun__Domain', value: mailgunDomain }
            { name: 'Mailgun__FromAddress', value: mailgunFromAddress }
            { name: 'Mailgun__FromName', value: mailgunFromName }
          ],
          deployImageModel ? [
            { name: 'AzureOpenAI__ImageEndpoint', value: openaiProdImage!.properties.endpoint }
            { name: 'AzureOpenAI__ImageApiKey', secretRef: 'openai-image-api-key' }
          ] : [],
          firebaseCredentialJsonBase64 != '' ? [{ name: 'Firebase__CredentialJsonBase64', secretRef: 'firebase-credential-base64' }] : [],
          mailgunApiKey != '' ? [{ name: 'Mailgun__ApiKey', secretRef: 'mailgun-api-key' }] : []
        )
      }]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [{
          name: 'http'
          http: {
            metadata: { concurrentRequests: '10' }
            auth: []
          }
        }]
      }
    }
  }
}

resource webApp 'Microsoft.App/containerApps@2024-03-01' = if (!localDevOnly && deployThisTime) {
  name: webAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [{
        server: acr!.properties.loginServer
        username: acr!.listCredentials().username
        passwordSecretRef: 'acr-password'
      }]
      secrets: [
        { name: 'acr-password', value: acr!.listCredentials().passwords[0].value }
      ]
    }
    template: {
      containers: [{
        name: 'web'
        image: webImage
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'PORT', value: '3000' }
          { name: 'NEXT_PUBLIC_API_URL', value: 'https://${apiApp!.properties.configuration.ingress.fqdn}' }
          { name: 'NEXT_PUBLIC_FIREBASE_API_KEY', value: firebaseApiKey }
          { name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', value: firebaseAuthDomain }
          { name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', value: firebaseProjectId }
          { name: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', value: firebaseStorageBucket }
          { name: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', value: firebaseMessagingSenderId }
          { name: 'NEXT_PUBLIC_FIREBASE_APP_ID', value: firebaseAppId }
        ]
      }]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [{
          name: 'http'
          http: {
            metadata: { concurrentRequests: '10' }
            auth: []
          }
        }]
      }
    }
  }
}

resource functionPlan 'Microsoft.Web/serverfarms@2024-04-01' = if (!localDevOnly && deployThisTime) {
  name: '${baseName}-plan-${environmentName}'
  location: location
  kind: 'functionapp'
  sku: { tier: 'FlexConsumption', name: 'FC1' }
  properties: { reserved: true }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = if (!localDevOnly && deployThisTime) {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'ConnectionStrings__DefaultConnection', value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabaseName};Persist Security Info=False;User ID=${sqlAdminLogin};Password=${sqlAdminPassword};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;' }
        { name: 'Mailgun__ApiKey', value: mailgunApiKey }
        { name: 'Mailgun__Domain', value: mailgunDomain }
        { name: 'Mailgun__FromAddress', value: mailgunFromAddress }
        { name: 'Mailgun__FromName', value: mailgunFromName }
      ]
    }
    functionAppConfig: {
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: { name: 'dotnet-isolated', version: '10.0' }
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentStorageContainerName}'
          authentication: {
            type: 'StorageAccountConnectionString'
            storageAccountConnectionStringName: 'AzureWebJobsStorage'
          }
        }
      }
    }
  }
}

// var openAIImageEndpointLocal = localDevOnly && deployImageModel ? openaiImageAccount!.properties.endpoint : ''
// var openAIImageEndpointProd = openaiProdImage.?properties.?endpoint ?? ''
// var openAIImageAccountNameLocal = localDevOnly && deployImageModel ? openaiImageAccount!.name : ''
// var openAIImageAccountNameProd = openaiProdImage.?name ?? ''

output acrLoginServer string = !localDevOnly ? acr!.properties.loginServer : ''
output acrName string = !localDevOnly ? acr!.name : ''
output apiAppName string = !localDevOnly ? apiApp!.name : ''
output apiAppFqdn string = !localDevOnly ? apiApp!.properties.configuration.ingress.fqdn : ''
output apiUrl string = !localDevOnly ? 'https://${apiApp!.properties.configuration.ingress.fqdn}' : ''
// output webAppName string = !localDevOnly ? webApp!.name : ''
// output webAppFqdn string = !localDevOnly ? webApp!.properties.configuration.ingress.fqdn : ''
// output webUrl string = !localDevOnly ? 'https://${webApp!.properties.configuration.ingress.fqdn}' : ''
// output functionAppName string = !localDevOnly ? functionApp.name : ''
// output openAIEndpoint string = localDevOnly ? openaiChatAccount!.properties.endpoint : openaiProdChat!.properties.endpoint
// output openAIImageEndpoint string = localDevOnly ? openAIImageEndpointLocal : openAIImageEndpointProd
// output openAIImageAccountName string = localDevOnly ? openAIImageAccountNameLocal : openAIImageAccountNameProd
// output openAIChatAccountName string = localDevOnly ? openaiChatAccount!.name : openaiProdChat!.name
// output storageAccountName string = !localDevOnly ? storage!.name : ''
// output staticWebAppName string = !localDevOnly ? staticWebApp.name : ''
output resourceGroupName string = resourceGroup().name
