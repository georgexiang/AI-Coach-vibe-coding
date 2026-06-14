targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param networkProfile string = 'publicDemo'
param vnetName string = ''
param vnetAddressPrefix string = '10.60.0.0/16'
param containerAppsSubnetPrefix string = '10.60.0.0/23'
param privateEndpointsSubnetPrefix string = '10.60.2.0/24'

param storageAccountId string = ''
param keyVaultId string = ''
param postgresqlServerId string = ''
param foundryAccountId string = ''

var usePrivateBackend = networkProfile == 'privateBackend'
var useExistingVnet = usePrivateBackend && !empty(vnetName)
var effectiveVnetName = empty(vnetName) ? 'vnet-${namePrefix}-${environmentName}' : vnetName
var containerAppsSubnetName = 'snet-container-apps'
var privateEndpointsSubnetName = 'snet-private-endpoints'
var vnetId = useExistingVnet ? existingVnet.id : createdVnet.id
var infrastructureSubnetId = usePrivateBackend ? '${vnetId}/subnets/${containerAppsSubnetName}' : ''
var runtimeSubnetId = infrastructureSubnetId
var privateEndpointsSubnetId = usePrivateBackend ? '${vnetId}/subnets/${privateEndpointsSubnetName}' : ''

resource existingVnet 'Microsoft.Network/virtualNetworks@2024-05-01' existing = if (useExistingVnet) {
  name: effectiveVnetName
}

resource createdVnet 'Microsoft.Network/virtualNetworks@2024-05-01' = if (usePrivateBackend && !useExistingVnet) {
  name: effectiveVnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        vnetAddressPrefix
      ]
    }
    subnets: [
      {
        name: containerAppsSubnetName
        properties: {
          addressPrefix: containerAppsSubnetPrefix
          delegations: [
            {
              name: 'container-apps'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: privateEndpointsSubnetName
        properties: {
          addressPrefix: privateEndpointsSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
          privateLinkServiceNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource blobDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = if (usePrivateBackend) {
  name: 'privatelink.blob.core.windows.net'
  location: 'global'
  tags: tags
}

resource vaultDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = if (usePrivateBackend) {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  tags: tags
}

resource postgresDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = if (usePrivateBackend) {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource cognitiveservicesDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = if (usePrivateBackend) {
  name: 'privatelink.cognitiveservices.azure.com'
  location: 'global'
  tags: tags
}

resource openAiDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = if (usePrivateBackend) {
  name: 'privatelink.openai.azure.com'
  location: 'global'
  tags: tags
}

resource servicesAiDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = if (usePrivateBackend) {
  name: 'privatelink.services.ai.azure.com'
  location: 'global'
  tags: tags
}

resource blobLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = if (usePrivateBackend) {
  parent: blobDnsZone
  name: '${effectiveVnetName}-blob-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: useExistingVnet ? existingVnet.id : createdVnet.id
    }
  }
}

resource vaultLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = if (usePrivateBackend) {
  parent: vaultDnsZone
  name: '${effectiveVnetName}-vault-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: useExistingVnet ? existingVnet.id : createdVnet.id
    }
  }
}

resource postgresLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = if (usePrivateBackend) {
  parent: postgresDnsZone
  name: '${effectiveVnetName}-postgres-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: useExistingVnet ? existingVnet.id : createdVnet.id
    }
  }
}

resource cognitiveservicesLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = if (usePrivateBackend) {
  parent: cognitiveservicesDnsZone
  name: '${effectiveVnetName}-cog-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: useExistingVnet ? existingVnet.id : createdVnet.id
    }
  }
}

resource openAiLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = if (usePrivateBackend) {
  parent: openAiDnsZone
  name: '${effectiveVnetName}-openai-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: useExistingVnet ? existingVnet.id : createdVnet.id
    }
  }
}

resource servicesAiLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = if (usePrivateBackend) {
  parent: servicesAiDnsZone
  name: '${effectiveVnetName}-services-ai-link'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: useExistingVnet ? existingVnet.id : createdVnet.id
    }
  }
}

resource storagePrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = if (usePrivateBackend && !empty(storageAccountId)) {
  name: 'pep-${namePrefix}-${environmentName}-storage'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointsSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'plc-storage'
        properties: {
          privateLinkServiceId: storageAccountId
          groupIds: [
            'blob'
          ]
        }
      }
    ]
  }
}

resource storagePrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = if (usePrivateBackend && !empty(storagePrivateEndpoint.id)) {
  parent: storagePrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob'
        properties: {
          privateDnsZoneId: blobDnsZone.id
        }
      }
    ]
  }
}

resource keyVaultPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = if (usePrivateBackend && !empty(keyVaultId)) {
  name: 'pep-${namePrefix}-${environmentName}-kv'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointsSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'plc-kv'
        properties: {
          privateLinkServiceId: keyVaultId
          groupIds: [
            'vault'
          ]
        }
      }
    ]
  }
}

resource keyVaultPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = if (usePrivateBackend && !empty(keyVaultPrivateEndpoint.id)) {
  parent: keyVaultPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'vault'
        properties: {
          privateDnsZoneId: vaultDnsZone.id
        }
      }
    ]
  }
}

resource postgresPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = if (usePrivateBackend && !empty(postgresqlServerId)) {
  name: 'pep-${namePrefix}-${environmentName}-pg'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointsSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'plc-pg'
        properties: {
          privateLinkServiceId: postgresqlServerId
          groupIds: [
            'postgresqlServer'
          ]
        }
      }
    ]
  }
}

resource postgresPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = if (usePrivateBackend && !empty(postgresPrivateEndpoint.id)) {
  parent: postgresPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'postgres'
        properties: {
          privateDnsZoneId: postgresDnsZone.id
        }
      }
    ]
  }
}

resource foundryPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = if (usePrivateBackend && !empty(foundryAccountId)) {
  name: 'pep-${namePrefix}-${environmentName}-foundry'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointsSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'plc-foundry'
        properties: {
          privateLinkServiceId: foundryAccountId
          groupIds: [
            'account'
          ]
        }
      }
    ]
  }
}

resource foundryPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = if (usePrivateBackend && !empty(foundryPrivateEndpoint.id)) {
  parent: foundryPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cognitiveservices'
        properties: {
          privateDnsZoneId: cognitiveservicesDnsZone.id
        }
      }
      {
        name: 'openai'
        properties: {
          privateDnsZoneId: openAiDnsZone.id
        }
      }
      {
        name: 'services-ai'
        properties: {
          privateDnsZoneId: servicesAiDnsZone.id
        }
      }
    ]
  }
}

output summary object = {
  module: 'network'
  networkProfile: networkProfile
  vnetName: usePrivateBackend ? (useExistingVnet ? existingVnet.name : createdVnet.name) : ''
  vnetId: usePrivateBackend ? (useExistingVnet ? existingVnet.id : createdVnet.id) : ''
  infrastructureSubnetId: infrastructureSubnetId
  runtimeSubnetId: runtimeSubnetId
  privateEndpointsSubnetId: privateEndpointsSubnetId
  privateEndpoints: {
    storage: usePrivateBackend && !empty(storageAccountId) ? storagePrivateEndpoint.name : ''
    keyVault: usePrivateBackend && !empty(keyVaultId) ? keyVaultPrivateEndpoint.name : ''
    postgresql: usePrivateBackend && !empty(postgresqlServerId) ? postgresPrivateEndpoint.name : ''
    foundry: usePrivateBackend && !empty(foundryAccountId) ? foundryPrivateEndpoint.name : ''
  }
}

output vnetName string = usePrivateBackend ? (useExistingVnet ? existingVnet.name : createdVnet.name) : ''
output vnetId string = usePrivateBackend ? (useExistingVnet ? existingVnet.id : createdVnet.id) : ''
output infrastructureSubnetId string = infrastructureSubnetId
output runtimeSubnetId string = runtimeSubnetId
output privateEndpointsSubnetId string = privateEndpointsSubnetId
