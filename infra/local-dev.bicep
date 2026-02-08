targetScope = 'resourceGroup'

@description('Base name for resources (e.g. postgen)')
param baseName string = 'postgen'

@description('Azure region')
param location string = resourceGroup().location

@description('Environment name (e.g. dev, prod)')
param environmentName string = 'dev'

var uniqueSuffix = uniqueString(resourceGroup().id, baseName)
var openAIName = '${baseName}-openai-${environmentName}-${uniqueSuffix}'

resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAIName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {}
}

resource openaiChatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openai
  name: 'gpt-4o'
  sku: { name: 'Standard', capacity: 10 }
  properties: {
    model: { name: 'gpt-4o', format: 'OpenAI' }
    raiPolicyName: 'Microsoft.Default'
    versionUpgradeOption: 'OnceCurrentVersionExpired'
  }
}

resource openaiImageDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openai
  name: 'dall-e-3'
  location: 'swedencentral'
  sku: { name: 'Standard' }
  properties: {
    model: { name: 'dall-e-3', format: 'OpenAI' }
    raiPolicyName: 'Microsoft.Default'
    versionUpgradeOption: 'OnceCurrentVersionExpired'
  }
}

output openAIEndpoint string = openai.properties.endpoint
