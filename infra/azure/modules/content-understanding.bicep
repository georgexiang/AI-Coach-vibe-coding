targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

var accountName = toLower('${namePrefix}-${environmentName}-cu-${uniqueString(resourceGroup().id, location)}')

resource contentUnderstandingAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'AIServices'
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

output summary object = {
  module: 'content-understanding'
  accountName: contentUnderstandingAccount.name
  endpoint: contentUnderstandingAccount.properties.endpoint
  note: 'Content Understanding APIs are preview-sensitive; analyzer initialization is handled outside this base resource.'
  environmentName: environmentName
  location: location
}

output contentUnderstandingAccountId string = contentUnderstandingAccount.id
output contentUnderstandingEndpoint string = contentUnderstandingAccount.properties.endpoint
