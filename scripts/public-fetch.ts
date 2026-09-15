import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const blocked = new BlockList()
for (const [ip, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const)
  blocked.addSubnet(ip, prefix, 'ipv4')
for (const [ip, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
] as const)
  blocked.addSubnet(ip, prefix, 'ipv6')

export function isPublicAddress(address: string) {
  const family = isIP(address)
  return (
    Boolean(family) && !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6')
  )
}

async function validateUrl(url: URL) {
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('Unsupported preview URL')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(hostname, { all: true })
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw new Error('Preview URL must resolve to a public address')
}

// Preview discovery is script-only. Validate every redirect before following it.
export const publicFetch: typeof fetch = async (input, init) => {
  let url = new URL(input instanceof Request ? input.url : String(input))
  const signal = AbortSignal.any([
    AbortSignal.timeout(30_000),
    ...(init?.signal ? [init.signal] : [])
  ])
  for (let hop = 0; hop < 6; hop++) {
    await validateUrl(url)
    const response = await fetch(url, {
      ...init,
      signal,
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; PersonalSitePreview/1.0; +https://transitivebullsh.it)'
      }
    })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get('location')
    await response.body?.cancel()
    if (!location) throw new Error('Redirect without a destination')
    url = new URL(location, url)
  }
  throw new Error('Too many preview redirects')
}
