targetScope = 'subscription'

@description('Short project/resource prefix. Use lowercase letters and numbers where possible because several Azure resources have strict naming rules.')
@minLength(3)
param namePrefix string = 'aicoach'

@description('Deployment environment name.')
@allowed([
  'dev'
  'demo'
  'prod'
])
param environmentName string = 'demo'

@description('Azure region for resource deployment.')
param location string = 'eastus2'

@description('Optional owner tag.')
param owner string = ''

@description('Optional cost center tag.')
param costCenter string = ''

@description('ACR name. Must be globally unique, lowercase alphanumeric, 5-50 characters.')
@minLength(5)
@maxLength(50)
param containerRegistryName string = 'aicoachdemoacr'

@description('Storage account name. Must be globally unique, lowercase alphanumeric, 3-24 characters.')
@minLength(3)
@maxLength(24)
param storageAccountName string = 'aicoachdemost'

@description('PostgreSQL administrator login name.')
param postgresAdminLogin string = 'aicoachadmin'

@secure()
@description('PostgreSQL administrator password. Do not commit real values in parameter files.')
param postgresAdminPassword string

@secure()
@description('JWT signing secret. Do not commit real values in parameter files.')
param jwtSecret string

@secure()
@description('Stable application encryption key for encrypted service config values. Do not commit real values in parameter files.')
param encryptionKey string

@description('Backend container image. Pass a real ACR image after building and pushing.')
param backendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Frontend container image. Pass a real ACR image after building and pushing.')
param frontendImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Backend CORS origins. Frontend normally calls the backend through nginx /api proxy, so same-origin browser calls do not require CORS.')
param corsOrigins string = 'http://localhost:5173,http://localhost:3000'

@description('GitHub repository owner or organization for OIDC federation.')
param githubOwner string = 'jeromeecho'

@description('GitHub repository name for OIDC federation.')
param githubRepo string = 'AI-Coach-vibe-coding'

@description('GitHub branch allowed to deploy through OIDC.')
param githubBranch string = 'main'

@description('Default Azure OpenAI chat/scoring deployment name.')
param chatDeploymentName string = 'gpt-4o'

@description('Default Azure OpenAI chat/scoring model name.')
param chatModelName string = 'gpt-4o'

@description('Default Azure OpenAI chat/scoring model version. Confirm available versions in the target region before deployment.')
param chatModelVersion string = '2024-11-20'

@description('Default Azure OpenAI realtime / Voice Live deployment name.')
param realtimeDeploymentName string = 'gpt-realtime-1-5'

@description('Default Azure OpenAI realtime / Voice Live model name.')
param realtimeModelName string = 'gpt-realtime-1.5'

@description('Default Azure OpenAI realtime / Voice Live model version. Confirm available versions in the target region before deployment.')
param realtimeModelVersion string = '2026-02-23'

@description('Azure OpenAI realtime deployment SKU. Realtime preview often requires GlobalStandard even when chat deployments use Standard.')
@allowed([
  'GlobalStandard'
  'Standard'
])
param realtimeDeploymentSkuName string = 'GlobalStandard'

@description('Realtime deployment capacity allocation. Keep this within the remaining quota for the selected realtime model/SKU/region.')
@minValue(1)
param realtimeDeploymentCapacity int = 5

@description('Whether to include Azure AI / Foundry / OpenAI resources in the deployment.')
param enableAzureAi bool = true

@description('Whether to include Speech / Voice Live / Avatar resources in the deployment plan.')
param enableVoiceAndAvatar bool = true

@description('Whether to include Content Understanding resources in the deployment plan.')
param enableContentUnderstanding bool = true

@description('Whether to include Azure AI Search resources in the deployment plan.')
param enableAiSearch bool = true

var locationToken = replace(toLower(location), ' ', '')
var resourceGroupName = 'rg-${namePrefix}-${environmentName}-${locationToken}'
var deploymentName = '${namePrefix}-${environmentName}-${locationToken}'
var commonTags = union({
  project: 'ai-coach'
  environment: environmentName
  managedBy: 'bicep'
}, empty(owner) ? {} : {
  owner: owner
}, empty(costCenter) ? {} : {
  costCenter: costCenter
})

resource deploymentResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

module monitoring './modules/monitoring.bicep' = {
  name: '${deploymentName}-monitoring'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
  }
}

module managedIdentity './modules/managed-identity.bicep' = {
  name: '${deploymentName}-managed-identity'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
  }
}

module containerRegistry './modules/container-registry.bicep' = {
  name: '${deploymentName}-container-registry'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    registryName: containerRegistryName
  }
}

module keyVault './modules/key-vault.bicep' = {
  name: '${deploymentName}-key-vault'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    jwtSecret: jwtSecret
    encryptionKey: encryptionKey
    postgresAdminPassword: postgresAdminPassword
  }
}

module postgresql './modules/postgresql.bicep' = {
  name: '${deploymentName}-postgresql'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
  }
}

module storage './modules/storage.bicep' = {
  name: '${deploymentName}-storage'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    storageAccountName: storageAccountName
  }
}

module containerApps './modules/container-apps.bicep' = {
  name: '${deploymentName}-container-apps'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    logAnalyticsWorkspaceName: monitoring.outputs.logAnalyticsWorkspaceName
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    registryLoginServer: containerRegistry.outputs.registryLoginServer
    backendIdentityId: managedIdentity.outputs.backendIdentityId
    backendIdentityClientId: managedIdentity.outputs.backendIdentityClientId
    backendImage: backendImage
    frontendImage: frontendImage
    postgresServerFqdn: postgresql.outputs.serverFqdn
    postgresDatabaseName: postgresql.outputs.databaseName
    postgresAdminLogin: postgresql.outputs.administratorLogin
    storageAccountBlobEndpoint: storage.outputs.blobEndpoint
    storageContainerName: 'materials'
    postgresAdminPassword: postgresAdminPassword
    jwtSecret: jwtSecret
    encryptionKey: encryptionKey
    corsOrigins: corsOrigins
  }
}

module aiFoundry './modules/ai-foundry.bicep' = if (enableAzureAi) {
  name: '${deploymentName}-ai-foundry'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    projectName: '${namePrefix}-${environmentName}'
    chatDeploymentName: chatDeploymentName
    chatModelName: chatModelName
    chatModelVersion: chatModelVersion
    realtimeDeploymentName: realtimeDeploymentName
    realtimeModelName: realtimeModelName
    realtimeModelVersion: realtimeModelVersion
    realtimeDeploymentSkuName: realtimeDeploymentSkuName
    realtimeDeploymentCapacity: realtimeDeploymentCapacity
  }
}

module aiOpenAi './modules/ai-openai.bicep' = if (enableAzureAi) {
  name: '${deploymentName}-ai-openai'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    chatDeploymentName: chatDeploymentName
    chatModelName: chatModelName
    chatModelVersion: chatModelVersion
    realtimeDeploymentName: realtimeDeploymentName
    realtimeModelName: realtimeModelName
    realtimeModelVersion: realtimeModelVersion
    realtimeDeploymentSkuName: realtimeDeploymentSkuName
    realtimeDeploymentCapacity: realtimeDeploymentCapacity
  }
}

module speechAvatar './modules/speech-avatar.bicep' = if (enableVoiceAndAvatar) {
  name: '${deploymentName}-speech-avatar'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    enableAvatar: enableVoiceAndAvatar
  }
}

module contentUnderstanding './modules/content-understanding.bicep' = if (enableContentUnderstanding) {
  name: '${deploymentName}-content-understanding'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
  }
}

module aiSearch './modules/ai-search.bicep' = if (enableAiSearch) {
  name: '${deploymentName}-ai-search'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
  }
}

module githubOidc './modules/github-oidc.bicep' = {
  name: '${deploymentName}-github-oidc'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    githubOwner: githubOwner
    githubRepo: githubRepo
    githubBranch: githubBranch
  }
}

module roleAssignments './modules/role-assignments.bicep' = {
  name: '${deploymentName}-role-assignments'
  scope: deploymentResourceGroup
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: commonTags
    backendIdentityPrincipalId: managedIdentity.outputs.backendIdentityPrincipalId
    enableAzureAi: enableAzureAi
    enableVoiceAndAvatar: enableVoiceAndAvatar
    enableContentUnderstanding: enableContentUnderstanding
    enableAiSearch: enableAiSearch
    githubDeploymentPrincipalId: githubOidc.outputs.githubDeploymentPrincipalId
  }
}

output resourceGroupName string = resourceGroupName
output location string = location
output tenantId string = tenant().tenantId
output containerRegistryName string = containerRegistry.outputs.summary.registryName
output containerRegistryLoginServer string = containerRegistry.outputs.registryLoginServer
output backendContainerAppName string = containerApps.outputs.backendAppName
output frontendContainerAppName string = containerApps.outputs.frontendAppName
output backendUrl string = containerApps.outputs.backendUrl
output frontendUrl string = containerApps.outputs.frontendUrl
output githubDeploymentClientId string = githubOidc.outputs.githubDeploymentClientId
output deployment object = {
  monitoring: monitoring.outputs.summary
  managedIdentity: managedIdentity.outputs.summary
  containerRegistry: containerRegistry.outputs.summary
  keyVault: keyVault.outputs.summary
  postgresql: postgresql.outputs.summary
  storage: storage.outputs.summary
  containerApps: containerApps.outputs.summary
  aiFoundry: enableAzureAi ? aiFoundry!.outputs.summary : null
  aiOpenAi: enableAzureAi ? aiOpenAi!.outputs.summary : null
  speechAvatar: enableVoiceAndAvatar ? speechAvatar!.outputs.summary : null
  contentUnderstanding: enableContentUnderstanding ? contentUnderstanding!.outputs.summary : null
  aiSearch: enableAiSearch ? aiSearch!.outputs.summary : null
  githubOidc: githubOidc.outputs.summary
  roleAssignments: roleAssignments.outputs.summary
}

output githubActions object = {
  AZURE_CLIENT_ID: githubOidc.outputs.githubDeploymentClientId
  AZURE_TENANT_ID: tenant().tenantId
  AZURE_SUBSCRIPTION_ID: subscription().subscriptionId
  ACR_NAME: containerRegistry.outputs.summary.registryName
  RESOURCE_GROUP: resourceGroupName
}
