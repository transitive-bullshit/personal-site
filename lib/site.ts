export const site = {
  name: 'Transitive Bullshit',
  author: 'Travis Fischer',
  description: 'Personal site of Travis Fischer aka Transitive Bullshit',
  origin: 'https://transitivebullsh.it',
  twitter: 'transitive_bs'
} as const

// Match Next.js's social-image deployment selection: public production domain
// or preview branch alias, with the unique deployment URL as a fallback.
// Canonical article URLs continue to use site.origin.
export function deploymentOrigin() {
  const host =
    process.env.VERCEL_ENV === 'preview'
      ? process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
      : process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  return host ? 'https://' + host : site.origin
}

export const sourceContract = {
  rootPageId: '78fc5a4b88d74b0e824e29407e9f1ec1',
  workspaceId: 'fde5ac74eea345278f004482710e1af3',
  databaseId: 'f917892e0b8c4dbeb1743620de57a0ec',
  dataSourceId: 'bb51e17f99ae4f0797a84c9af77a85ec'
} as const

export const projectSourceContract = {
  ...sourceContract,
  databaseId: '3c5edb27f12480a69a16d7c2f8a1f078',
  dataSourceId: '6ffedb27f12482598a40075b8e5a4993'
} as const
