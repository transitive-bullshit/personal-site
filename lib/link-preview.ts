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
  pageOrigin: string,
  scope: LinkPreviewScope,
  internalPaths: ReadonlySet<string>
): LinkPreviewTarget | undefined {
  let url: URL
  try {
    url = new URL(href, pageOrigin)
  } catch {
    return undefined
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return undefined

  url.hash = ''
  const internal = url.origin === pageOrigin && internalPaths.has(url.pathname)
  if (scope === 'internal' && !internal) return undefined
  if (!internal && (scope !== 'article' || url.origin === pageOrigin))
    return undefined

  return {
    cacheKey: internal ? url.pathname : url.href,
    href: internal ? url.pathname + url.search : url.href,
    internal
  }
}
