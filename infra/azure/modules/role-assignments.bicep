targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param backendIdentityPrincipalId string
param enableAzureAi bool
param enableVoiceAndAvatar bool
param enableContentUnderstanding bool
param enableAiSearch bool
param githubDeploymentPrincipalId string

var acrPullRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
var acrPushRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8311e382-0749-4cb8-b61a-304f252e45ec')
var contributorRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
var keyVaultSecretsUserRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
var storageBlobDataContributorRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var cognitiveServicesUserRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908')
var azureAiDeveloperRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '64702f94-c441-49e6-a78b-ef80e0188fee')
var searchIndexDataContributorRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8ebe5a00-799e-43f5-93ac-243d3dce84a7')

resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, backendIdentityPrincipalId, 'acr-pull')
  properties: {
    principalId: backendIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

resource backendKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, backendIdentityPrincipalId, 'key-vault-secrets-user')
  properties: {
    principalId: backendIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: keyVaultSecretsUserRoleDefinitionId
  }
}

resource backendStorageBlobDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, backendIdentityPrincipalId, 'storage-blob-data-contributor')
  properties: {
    principalId: backendIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: storageBlobDataContributorRoleDefinitionId
  }
}

resource backendCognitiveServicesUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableAzureAi || enableVoiceAndAvatar || enableContentUnderstanding) {
  name: guid(resourceGroup().id, backendIdentityPrincipalId, 'cognitive-services-user')
  properties: {
    principalId: backendIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: cognitiveServicesUserRoleDefinitionId
  }
}

resource backendAzureAiDeveloper 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableAzureAi) {
  name: guid(resourceGroup().id, backendIdentityPrincipalId, 'azure-ai-developer')
  properties: {
    principalId: backendIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: azureAiDeveloperRoleDefinitionId
  }
}

resource backendSearchIndexDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (enableAiSearch) {
  name: guid(resourceGroup().id, backendIdentityPrincipalId, 'search-index-data-contributor')
  properties: {
    principalId: backendIdentityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: searchIndexDataContributorRoleDefinitionId
  }
}

resource githubDeploymentContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, githubDeploymentPrincipalId, 'github-deployment-contributor')
  properties: {
    principalId: githubDeploymentPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: contributorRoleDefinitionId
  }
}

resource githubDeploymentAcrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, githubDeploymentPrincipalId, 'github-deployment-acr-push')
  properties: {
    principalId: githubDeploymentPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPushRoleDefinitionId
  }
}

output summary object = {
  module: 'role-assignments'
  namePrefix: namePrefix
  environmentName: environmentName
  location: location
  tags: tags
  scope: resourceGroup().id
  backendIdentityPrincipalId: backendIdentityPrincipalId
  githubDeploymentPrincipalId: githubDeploymentPrincipalId
  resources: [
    backendAcrPull.name
    backendKeyVaultSecretsUser.name
    backendStorageBlobDataContributor.name
    enableAzureAi || enableVoiceAndAvatar || enableContentUnderstanding ? backendCognitiveServicesUser.name : 'cognitive-services-user-disabled'
    enableAiSearch ? backendSearchIndexDataContributor.name : 'search-index-data-contributor-disabled'
    githubDeploymentContributor.name
    githubDeploymentAcrPush.name
  ]
}
