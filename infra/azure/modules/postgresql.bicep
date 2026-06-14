targetScope = 'resourceGroup'

@minLength(3)
param namePrefix string
param environmentName string
param location string
param tags object

param administratorLogin string = 'aicoachadmin'

@secure()
param administratorPassword string

param databaseName string = 'ai_coach'
param manageAdministratorPassword bool = true
param activeDirectoryAuthEnabled bool = false

@allowed([
  'publicDemo'
  'privateBackend'
])
param networkProfile string = 'publicDemo'

var serverName = toLower('${namePrefix}-${environmentName}-pg-${uniqueString(resourceGroup().id, location)}')
var usePrivateBackend = networkProfile == 'privateBackend'

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: union({
    administratorLogin: administratorLogin
    version: '16'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: activeDirectoryAuthEnabled ? 'Enabled' : 'Disabled'
      passwordAuth: 'Enabled'
      tenantId: tenant().tenantId
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: usePrivateBackend ? 'Disabled' : 'Enabled'
    }
  }, manageAdministratorPassword ? {
    administratorLoginPassword: administratorPassword
  } : {})
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (!usePrivateBackend) {
  parent: server
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output summary object = {
  module: 'postgresql'
  serverName: server.name
  serverFqdn: server.properties.fullyQualifiedDomainName
  databaseName: databaseName
  administratorLogin: administratorLogin
  manageAdministratorPassword: manageAdministratorPassword
  activeDirectoryAuthEnabled: activeDirectoryAuthEnabled
  serverId: server.id
  environmentName: environmentName
  location: location
}

output serverFqdn string = server.properties.fullyQualifiedDomainName
output serverName string = server.name
output serverId string = server.id
output databaseName string = databaseName
output administratorLogin string = administratorLogin
