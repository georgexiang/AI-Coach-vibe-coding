targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param githubOwner string
param githubRepo string
param githubBranch string

var identityName = 'id-${namePrefix}-${environmentName}-github-deploy'
var credentialName = 'github-${githubBranch}'
var repositorySubject = 'repo:${githubOwner}/${githubRepo}:ref:refs/heads/${githubBranch}'

resource githubDeploymentIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
  tags: tags
}

resource githubFederatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: githubDeploymentIdentity
  name: credentialName
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: repositorySubject
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

output summary object = {
  module: 'github-oidc'
  identityName: githubDeploymentIdentity.name
  clientId: githubDeploymentIdentity.properties.clientId
  principalId: githubDeploymentIdentity.properties.principalId
  federatedCredentialName: githubFederatedCredential.name
  subject: repositorySubject
  environmentName: environmentName
  location: location
}

output githubDeploymentIdentityId string = githubDeploymentIdentity.id
output githubDeploymentClientId string = githubDeploymentIdentity.properties.clientId
output githubDeploymentPrincipalId string = githubDeploymentIdentity.properties.principalId
