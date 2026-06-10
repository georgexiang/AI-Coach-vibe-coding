targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param chatDeploymentName string
param chatModelName string
param chatModelVersion string
param realtimeDeploymentName string
param realtimeModelName string
param realtimeModelVersion string
param realtimeDeploymentSkuName string = 'GlobalStandard'
@minValue(1)
param realtimeDeploymentCapacity int = 5

var accountName = toLower('${namePrefix}-${environmentName}-openai-${uniqueString(resourceGroup().id, location)}')

resource account 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: account
  name: chatDeploymentName
  sku: {
    name: 'Standard'
    capacity: 10
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: chatModelName
      version: chatModelVersion
    }
  }
}

resource realtimeDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: account
  name: realtimeDeploymentName
  dependsOn: [
    chatDeployment
  ]
  sku: {
    name: realtimeDeploymentSkuName
    capacity: realtimeDeploymentCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: realtimeModelName
      version: realtimeModelVersion
    }
  }
}

output summary object = {
  module: 'ai-openai'
  accountName: account.name
  endpoint: account.properties.endpoint
  deployments: [
    chatDeployment.name
    realtimeDeployment.name
  ]
  realtimeDeploymentSkuName: realtimeDeploymentSkuName
  environmentName: environmentName
  location: location
}

output openAiAccountId string = account.id
output openAiEndpoint string = account.properties.endpoint
output chatDeploymentName string = chatDeployment.name
output realtimeDeploymentName string = realtimeDeployment.name
