targetScope = 'resourceGroup'

@minLength(3)
param namePrefix string
param environmentName string
param location string
param tags object

@secure()
param jwtSecret string

@secure()
param encryptionKey string

@secure()
param postgresAdminPassword string

var vaultName = take(toLower('${namePrefix}-${environmentName}-${uniqueString(resourceGroup().id, location)}'), 24)

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource jwtSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'jwt-secret-key'
  properties: {
    value: jwtSecret
  }
}

resource encryptionKeyResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'encryption-key'
  properties: {
    value: encryptionKey
  }
}

resource postgresPasswordSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'postgres-admin-password'
  properties: {
    value: postgresAdminPassword
  }
}

output summary object = {
  module: 'key-vault'
  vaultName: vault.name
  vaultUri: vault.properties.vaultUri
  vaultId: vault.id
  secretNames: [
    jwtSecretResource.name
    encryptionKeyResource.name
    postgresPasswordSecretResource.name
  ]
  environmentName: environmentName
  location: location
}
