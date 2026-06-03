targetScope = 'resourceGroup'

param serverName string
param entraAdminLogin string = ''
param entraAdminSid string = ''
@allowed([
  'User'
  'Group'
  'ServicePrincipal'
])
param entraAdminPrincipalType string = 'User'
param activeDirectoryAuthEnabled bool = false

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' existing = {
  name: serverName
}

resource activeDirectoryAdministrator 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2022-12-01' = if (activeDirectoryAuthEnabled && !empty(entraAdminLogin) && !empty(entraAdminSid)) {
  parent: server
  name: entraAdminSid
  properties: {
    principalName: entraAdminLogin
    principalType: entraAdminPrincipalType
    tenantId: tenant().tenantId
  }
}

output administratorId string = activeDirectoryAuthEnabled && !empty(entraAdminLogin) && !empty(entraAdminSid) ? activeDirectoryAdministrator.id : ''
