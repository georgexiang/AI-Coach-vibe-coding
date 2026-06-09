targetScope = 'resourceGroup'

@minLength(3)
param namePrefix string
param environmentName string
param location string
param tags object

@minLength(3)
@maxLength(24)
param storageAccountName string

@allowed([
  'publicDemo'
  'privateBackend'
])
param networkProfile string = 'publicDemo'

var usePrivateBackend = networkProfile == 'privateBackend'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: usePrivateBackend ? 'Disabled' : 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: usePrivateBackend ? 'Deny' : 'Allow'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource materialsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'materials'
  properties: {
    publicAccess: 'None'
  }
}

resource skillsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'skills'
  properties: {
    publicAccess: 'None'
  }
}

resource audioContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'audio'
  properties: {
    publicAccess: 'None'
  }
}

resource exportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'exports'
  properties: {
    publicAccess: 'None'
  }
}

output summary object = {
  module: 'storage'
  namePrefix: namePrefix
  storageAccountName: storageAccount.name
  storageAccountId: storageAccount.id
  blobEndpoint: storageAccount.properties.primaryEndpoints.blob
  containers: [
    materialsContainer.name
    skillsContainer.name
    audioContainer.name
    exportsContainer.name
  ]
  environmentName: environmentName
  location: location
}

output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
