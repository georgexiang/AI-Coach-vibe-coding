targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param chatDeploymentName string
param chatModelName string
param chatModelVersion string
param chatDeploymentCapacity int = 120

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

output summary object = {
  module: 'ai-openai'
  accountName: account.name
  endpoint: account.properties.endpoint
  deployments: [
    chatDeployment.name
  ]
  environmentName: environmentName
  location: location
}

output openAiAccountId string = account.id
output openAiEndpoint string = account.properties.endpoint
output chatDeploymentName string = chatDeployment.name
