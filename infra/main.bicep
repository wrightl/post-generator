targetScope = 'resourceGroup'

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

@description('Initial API container image (replaced by CD)')
param apiImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

var uniqueSuffix = uniqueString(resourceGroup().id, baseName)
var acrName = '${baseName}acr${uniqueSuffix}'
var containerAppEnvName = '${baseName}-env-${environmentName}'
var apiAppName = '${baseName}-api-${environmentName}'
var functionAppName = '${baseName}-func-${environmentName}'
var storageName = toLower(replace('${baseName}${uniqueSuffix}', '-', ''))
var logAnalyticsName = '${baseName}-logs-${environmentName}'
var openAIName = '${baseName}-openai-${environmentName}-${uniqueSuffix}'

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

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = if (!localDevOnly) {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
}

resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAIName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {}
}

// GlobalStandard works in all regions (e.g. West Europe); regional 'Standard' is not available for all models everywhere.
resource openaiChatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openai
  name: 'gpt-4o'
  sku: { name: 'GlobalStandard', capacity: 10 }
  properties: {
    model: { name: 'gpt-4o', format: 'OpenAI' }
    raiPolicyName: 'Microsoft.Default'
    versionUpgradeOption: 'OnceCurrentVersionExpired'
  }
}

// dall-e-3 only supports Standard SKU (not GlobalStandard). Standard for dall-e-3 is not available in West Europe; set deployImageModel=false there.
resource openaiImageDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = if (deployImageModel) {
  parent: openai
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
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
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
        server: acr.properties.loginServer
        username: acr.listCredentials().username
        passwordSecretRef: 'acr-password'
      }]
      secrets: [{ name: 'acr-password', value: acr.listCredentials().passwords[0].value }, { name: 'openai-api-key', value: openai.listKeys().key1 }]
    }
    template: {
      containers: [{
        name: 'api'
        image: apiImage
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [{ name: 'AzureOpenAI__Endpoint', value: openai.properties.endpoint }, { name: 'AzureOpenAI__ApiKey', secretRef: 'openai-api-key' }, { name: 'AzureOpenAI__ChatDeploymentName', value: 'gpt-4o' }, { name: 'AzureOpenAI__ImageDeploymentName', value: 'dall-e-3' }]
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

resource functionPlan 'Microsoft.Web/serverfarms@2024-04-01' = if (!localDevOnly) {
  name: '${baseName}-plan-${environmentName}'
  location: location
  kind: 'functionapp'
  sku: { tier: 'FlexConsumption', name: 'FC1' }
  properties: { reserved: true }
}

resource functionApp 'Microsoft.Web/sites@2024-04-01' = if (!localDevOnly) {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    siteConfig: {
      appSettings: [{ name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}' }, { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }, { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'dotnet-isolated' }]
    }
    functionAppConfig: {
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: { name: 'dotnet-isolated', version: '10.0' }
    }
  }
}

output acrLoginServer string = !localDevOnly ? acr.properties.loginServer : ''
output acrName string = !localDevOnly ? acr.name : ''
output apiAppName string = !localDevOnly ? apiApp.name : ''
output apiAppFqdn string = !localDevOnly ? apiApp.properties.configuration.ingress.fqdn : ''
output functionAppName string = !localDevOnly ? functionApp.name : ''
output openAIEndpoint string = openai.properties.endpoint
output storageAccountName string = !localDevOnly ? storage.name : ''
output resourceGroupName string = resourceGroup().name
