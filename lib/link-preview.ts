import { site } from './site'

export type LinkPreviewScope = 'article' | 'internal'

export type LinkPreviewData = {
  url: string
  title: string
  description?: string
  image?: string
  imageAlt?: string
  siteName?: string
  fallback?: boolean
}

export type LinkPreviewTarget = {
  cacheKey: string
  href: string
  internal: boolean
}

export function fallbackLinkPreview(
  value: string,
  metadata?: { title?: string; description?: string }
): LinkPreviewData | undefined {
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return undefined
    const domain = url.hostname.replace(/^www\./, '')
    const rawFilename = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
    let filename = rawFilename
    try {
      filename = decodeURIComponent(rawFilename)
    } catch {
      /* Keep malformed escapes as text. */
    }
    const inferred = filename
      .replace(/\.(pdf|html?|md)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()
    const title =
      metadata?.title?.trim().slice(0, 300) || inferred.slice(0, 300) || domain
    const params = new URLSearchParams({ url: url.href, title, v: '1' })
    return {
      url: url.href,
      title,
      description: metadata?.description,
      siteName: domain,
      image: '/api/link-preview/fallback?' + params,
      imageAlt: title,
      fallback: true
    }
  } catch {
    return undefined
  }
}

export function linkPreviewKind(value: string) {
  const url = new URL(value)
  if (/\.pdf$/i.test(url.pathname)) return 'PDF document'
  if (['youtube.com', 'www.youtube.com', 'youtu.be'].includes(url.hostname))
    return 'Video'
  if (['arxiv.org', 'www.arxiv.org'].includes(url.hostname))
    return 'Research paper'
  if (url.hostname === 'github.com') return 'GitHub project'
  return 'Web page'
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
