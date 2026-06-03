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

param manageBootstrapSecrets bool = true

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

resource jwtSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (manageBootstrapSecrets) {
  parent: vault
  name: 'jwt-secret-key'
  properties: {
    value: jwtSecret
  }
}

resource encryptionKeyResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (manageBootstrapSecrets) {
  parent: vault
  name: 'encryption-key'
  properties: {
    value: encryptionKey
  }
}

resource postgresPasswordSecretResource 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (manageBootstrapSecrets) {
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
    'jwt-secret-key'
    'encryption-key'
    'postgres-admin-password'
  ]
  manageBootstrapSecrets: manageBootstrapSecrets
  environmentName: environmentName
  location: location
}
