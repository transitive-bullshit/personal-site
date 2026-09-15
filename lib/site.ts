export const site = {
  name: 'Transitive Bullshit',
  author: 'Travis Fischer',
  description: 'Personal site of Travis Fischer aka Transitive Bullshit',
  origin: 'https://transitivebullsh.it',
  twitter: 'transitive_bs'
} as const

// Deployment-local assets must come from the same build as the article HTML.
// Canonical content URLs continue to use site.origin.
export function deploymentOrigin() {
  return process.env.VERCEL_URL
    ? 'https://' + process.env.VERCEL_URL
    : site.origin
}

export const sourceContract = {
  rootPageId: '78fc5a4b88d74b0e824e29407e9f1ec1',
  workspaceId: 'fde5ac74eea345278f004482710e1af3',
  databaseId: 'f917892e0b8c4dbeb1743620de57a0ec',
  dataSourceId: 'bb51e17f99ae4f0797a84c9af77a85ec'
} as const
