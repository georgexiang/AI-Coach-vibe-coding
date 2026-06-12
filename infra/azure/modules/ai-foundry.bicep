targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param projectName string

param chatDeploymentName string
param chatModelName string
param chatModelVersion string
param chatDeploymentCapacity int = 120

@allowed([
  'publicDemo'
  'privateBackend'
])
param networkProfile string = 'publicDemo'

var foundryAccountName = toLower('${namePrefix}-${environmentName}-foundry-${uniqueString(resourceGroup().id, location)}')
var usePrivateBackend = networkProfile == 'privateBackend'

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
    publicNetworkAccess: usePrivateBackend ? 'Disabled' : 'Enabled'
    networkAcls: {
      defaultAction: usePrivateBackend ? 'Deny' : 'Allow'
    }
  }
}

resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: foundryAccount
  name: chatDeploymentName
  sku: {
    name: 'Standard'
    capacity: chatDeploymentCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: chatModelName
      version: chatModelVersion
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
  ]
  note: 'Uses current CognitiveServices accounts/projects Foundry resource model. Voice Live selects supported realtime models at runtime and does not require a realtime deployment here.'
  environmentName: environmentName
  location: location
}

output foundryAccountId string = foundryAccount.id
output foundryEndpoint string = foundryAccount.properties.endpoint
output foundryProjectId string = foundryProject.id
output foundryChatDeploymentName string = chatDeployment.name
