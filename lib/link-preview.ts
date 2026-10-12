import { site } from './site'

export type LinkPreviewScope = 'article' | 'internal'

export type LinkPreviewData = {
  url: string
  title: string
  description?: string
  image?: string
  imageAlt?: string
  siteName?: string
}

export type LinkPreviewTarget = {
  cacheKey: string
  href: string
  internal: boolean
}

export function resolveLinkPreviewTarget(
  href: string,
  pageUrl: string,
  scope: LinkPreviewScope,
  internalPaths: ReadonlySet<string>
): LinkPreviewTarget | undefined {
  let url: URL
  let page: URL
  try {
    page = new URL(pageUrl)
    url = new URL(href, page)
  } catch {
    return undefined
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return undefined

  const siteOrigins = new Set([
    page.origin,
    site.origin,
    site.origin.replace('://www.', '://')
  ])
  const sameSite = siteOrigins.has(url.origin)
  const pathname = (value: URL) => value.pathname.replace(/\/+$/, '') || '/'
  if (sameSite && pathname(url) === pathname(page)) return undefined

  url.hash = ''
  const internal = sameSite && internalPaths.has(url.pathname)
  if (scope === 'internal' && !internal) return undefined
  if (!internal && (scope !== 'article' || sameSite)) return undefined

  return {
    cacheKey: internal ? url.pathname : url.href,
    href: internal ? url.pathname + url.search : url.href,
    internal
  }
}
