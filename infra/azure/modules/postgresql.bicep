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

var serverName = toLower('${namePrefix}-${environmentName}-pg-${uniqueString(resourceGroup().id, location)}')

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
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
  serverId: server.id
  environmentName: environmentName
  location: location
}

output serverFqdn string = server.properties.fullyQualifiedDomainName
output databaseName string = databaseName
output administratorLogin string = administratorLogin
