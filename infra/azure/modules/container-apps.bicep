targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param logAnalyticsWorkspaceName string
param applicationInsightsConnectionString string
param registryLoginServer string
param backendIdentityId string
param backendIdentityClientId string
param backendImage string
param frontendImage string
param postgresServerFqdn string
param postgresDatabaseName string
param postgresAdminLogin string
param storageAccountBlobEndpoint string
param storageContainerName string = 'materials'

@secure()
param postgresAdminPassword string

@secure()
param jwtSecret string

@secure()
param encryptionKey string

param corsOrigins string
@allowed([
  'publicDemo'
])
param networkProfile string = 'publicDemo'

var environmentResourceName = 'cae-${namePrefix}-${environmentName}'
var backendAppName = 'ca-${namePrefix}-${environmentName}-backend'
var frontendAppName = 'ca-${namePrefix}-${environmentName}-frontend'
var publicIngress = networkProfile == 'publicDemo'

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentResourceName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: workspace.properties.customerId
        sharedKey: workspace.listKeys().primarySharedKey
      }
    }
  }
}

resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: backendAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${backendIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: publicIngress
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registryLoginServer
          identity: backendIdentityId
        }
      ]
      secrets: [
        {
          name: 'database-url'
          #disable-next-line use-secure-value-for-secure-inputs
          value: 'postgresql+asyncpg://${postgresAdminLogin}:${postgresAdminPassword}@${postgresServerFqdn}:5432/${postgresDatabaseName}?ssl=require'
        }
        {
          name: 'secret-key'
          value: jwtSecret
        }
        {
          name: 'encryption-key'
          value: encryptionKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: backendImage
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'SECRET_KEY'
              secretRef: 'secret-key'
            }
            {
              name: 'ENCRYPTION_KEY'
              secretRef: 'encryption-key'
            }
            {
              name: 'DEBUG'
              value: 'false'
            }
            {
              name: 'REGION'
              value: 'global'
            }
            {
              name: 'CORS_ORIGINS'
              value: corsOrigins
            }
            {
              name: 'STORAGE_BACKEND'
              value: 'azure_blob'
            }
            {
              name: 'AZURE_STORAGE_ACCOUNT_URL'
              value: storageAccountBlobEndpoint
            }
            {
              name: 'AZURE_STORAGE_CONTAINER_NAME'
              value: storageContainerName
            }
            {
              name: 'DEFAULT_LLM_PROVIDER'
              value: 'mock'
            }
            {
              name: 'DEFAULT_STT_PROVIDER'
              value: 'mock'
            }
            {
              name: 'DEFAULT_TTS_PROVIDER'
              value: 'mock'
            }
            {
              name: 'DEFAULT_AVATAR_PROVIDER'
              value: 'mock'
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: backendIdentityClientId
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: applicationInsightsConnectionString
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

resource frontendApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: frontendAppName
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${backendIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: publicIngress
        targetPort: 80
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: registryLoginServer
          identity: backendIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          env: [
            {
              name: 'BACKEND_URL'
              value: 'https://${backendApp.properties.configuration.ingress.fqdn}'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

output summary object = {
  module: 'container-apps'
  environmentName: environmentName
  managedEnvironmentName: managedEnvironment.name
  backendAppName: backendApp.name
  backendUrl: 'https://${backendApp.properties.configuration.ingress.fqdn}'
  frontendAppName: frontendApp.name
  frontendUrl: 'https://${frontendApp.properties.configuration.ingress.fqdn}'
  registryLoginServer: registryLoginServer
  location: location
  networkProfile: networkProfile
}

output backendUrl string = 'https://${backendApp.properties.configuration.ingress.fqdn}'
output frontendUrl string = 'https://${frontendApp.properties.configuration.ingress.fqdn}'
output backendAppName string = backendApp.name
output frontendAppName string = frontendApp.name
