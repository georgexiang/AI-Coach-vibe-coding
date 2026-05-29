targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param projectName string

param chatDeploymentName string
param chatModelName string
param chatModelVersion string
param realtimeDeploymentName string
param realtimeModelName string
param realtimeModelVersion string
param realtimeDeploymentSkuName string = 'GlobalStandard'
@minValue(1)
param realtimeDeploymentCapacity int = 5

var foundryAccountName = toLower('${namePrefix}-${environmentName}-foundry-${uniqueString(resourceGroup().id, location)}')

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2026-03-01' = {
  name: foundryAccountName
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  properties: {
    allowProjectManagement: true
    customSubDomainName: foundryAccountName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: foundryAccount
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
  parent: foundryAccount
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

resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2026-03-01' = {
  parent: foundryAccount
  name: projectName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: 'AI Coach ${environmentName}'
    description: 'AI Coach Azure AI Foundry project for ${environmentName}.'
  }
}

output summary object = {
  module: 'ai-foundry'
  foundryAccountName: foundryAccount.name
  endpoint: foundryAccount.properties.endpoint
  projectName: foundryProject.name
  projectId: foundryProject.id
  deployments: [
    chatDeployment.name
    realtimeDeployment.name
  ]
  note: 'Uses current CognitiveServices accounts/projects Foundry resource model. Agent and connection initialization may still need post-deploy CLI steps.'
  environmentName: environmentName
  location: location
}

output foundryAccountId string = foundryAccount.id
output foundryEndpoint string = foundryAccount.properties.endpoint
output foundryProjectId string = foundryProject.id
output foundryChatDeploymentName string = chatDeployment.name
output foundryRealtimeDeploymentName string = realtimeDeployment.name
