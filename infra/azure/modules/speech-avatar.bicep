targetScope = 'resourceGroup'

param namePrefix string
param environmentName string
param location string
param tags object

param enableAvatar bool = true

var speechAccountName = toLower('${namePrefix}-${environmentName}-speech-${uniqueString(resourceGroup().id, location)}')

resource speechAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: speechAccountName
  location: location
  tags: union(tags, {
    avatarEnabled: string(enableAvatar)
  })
  kind: 'SpeechServices'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: speechAccountName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

output summary object = {
  module: 'speech-avatar'
  speechAccountName: speechAccount.name
  endpoint: speechAccount.properties.endpoint
  voiceLiveEnabled: true
  avatarEnabled: enableAvatar
  note: 'Voice Live and Avatar availability depends on region, quota, and preview feature availability.'
  environmentName: environmentName
  location: location
}

output speechAccountId string = speechAccount.id
output speechEndpoint string = speechAccount.properties.endpoint
