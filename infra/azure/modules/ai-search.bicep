targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

var searchServiceName = toLower('${namePrefix}-${environmentName}-search-${uniqueString(resourceGroup().id, location)}')

resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: searchServiceName
  location: location
  tags: tags
  sku: {
    name: 'basic'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    disableLocalAuth: false
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
  }
}

output summary object = {
  module: 'ai-search'
  searchServiceName: searchService.name
  endpoint: 'https://${searchService.name}.search.windows.net'
  sku: 'basic'
  environmentName: environmentName
  location: location
}

output searchServiceId string = searchService.id
output searchEndpoint string = 'https://${searchService.name}.search.windows.net'
