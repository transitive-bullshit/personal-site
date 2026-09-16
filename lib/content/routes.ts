import type { RouteRecord } from './schema'
import { site } from '../site'

export const reservedSlugs = new Set([
  'sitemap.xml',
  'llms.txt',
  'robots.txt',
  'favicon.ico',
  'search-index.json',
  '_next',
  'api',
  'transitivebullshit',
  'writing',
  'projects',
  'project',
  'about',
  'feed',
  'top-tweet-interactions-english',
  'top-tweet-interactions-german',
  'top-tweet-interactions-other-languages'
])

export function compactId(id: string) {
  return id.replaceAll('-', '').toLowerCase()
}

// Keep this sequence identical to the legacy site's normalizeTitle.
export function normalizeTitle(title: string) {
  return title
    .replaceAll(' ', '-')
    .replaceAll(
      /[^\dA-Za-z\u3000-\u303F\u3041-\u3096\u30A1-\u30FC\u4E00-\u9FFF\uAC00-\uD7AF-]/g,
      ''
    )
    .replaceAll('--', '-')
    .replace(/-$/, '')
    .replace(/^-/, '')
    .trim()
    .toLowerCase()
}

export function validateSlug(slug: string) {
  if (
    !slug ||
    /[\s/\\?#%]/u.test(slug) ||
    Array.from(slug).some((character) => character.codePointAt(0)! < 32) ||
    slug === '.' ||
    slug === '..' ||
    reservedSlugs.has(slug)
  ) {
    throw new Error(`Invalid or reserved article pathname: /${slug}`)
  }
}

export type SourcePage = {
  id: string
  title: string
  slug: string
  public: boolean
}

export function reconcileRoutes(
  pages: SourcePage[],
  previous: Record<string, RouteRecord>,
  options: { prune?: boolean; acceptSlugChanges?: boolean } = {}
) {
  const routes = structuredClone(previous)
  const warnings: string[] = []
  const seen = new Set<string>()
  for (const page of pages) {
    seen.add(page.id)
    const old = previous[page.id]
    if (!page.public) {
      if (old) routes[page.id] = { ...old, active: false }
      continue
    }
    const proposed = page.slug || normalizeTitle(page.title) || page.id
    validateSlug(proposed)
    const changed = old && old.slug !== proposed
    const slug = changed && !options.acceptSlugChanges ? old.slug : proposed
    if (changed && !options.acceptSlugChanges) {
      warnings.push(
        `/${old.slug}: proposed pathname /${proposed}; keeping existing path (use --accept-slug-changes)`
      )
    }
    routes[page.id] = {
      slug,
      aliases: [
        ...new Set([
          ...(old?.aliases ?? []),
          ...(changed && options.acceptSlugChanges ? [old.slug] : [])
        ])
      ]
        .filter((alias) => alias !== slug)
        .sort(),
      active: true
    }
  }
  for (const [id, old] of Object.entries(previous)) {
    if (!seen.has(id) && old.active) {
      routes[id] = { ...old, active: !options.prune }
      warnings.push(
        options.prune
          ? `Pruned missing article /${old.slug}`
          : `Missing article /${old.slug}: retaining snapshot (use --prune to remove)`
      )
    }
  }
  validateRoutes(routes)
  return { routes, warnings }
}

export function validateRoutes(routes: Record<string, RouteRecord>) {
  const owners = new Map<string, string>()
  // Tombstones retain ownership, but do not resolve publicly.
  for (const [id, route] of Object.entries(routes)) {
    for (const slug of [route.slug, ...route.aliases]) {
      validateSlug(slug)
      const owner = owners.get(slug)
      if (owner && owner !== id)
        throw new Error(
          `Pathname collision: /${slug} belongs to ${owner} and ${id}`
        )
      owners.set(slug, id)
    }
  }
  for (const [slug, owner] of owners) {
    const embeddedId = pageIdFromPath(slug)
    if (embeddedId && embeddedId !== owner && routes[embeddedId]) {
      throw new Error(
        `Pathname /${slug} conflicts with another page's ID alias`
      )
    }
  }
}

export function pageIdFromPath(path: string): string | undefined {
  const match = path.match(
    /(?:^|-)([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  )
  return match ? compactId(match[1]!) : undefined
}

export function resolveRoute(
  slug: string,
  routes: Record<string, RouteRecord>
) {
  for (const [id, route] of Object.entries(routes)) {
    if (route.active && (route.slug === slug || route.aliases.includes(slug))) {
      return { id, slug: route.slug, redirect: route.slug !== slug }
    }
  }
  const id = pageIdFromPath(slug)
  if (id && routes[id]?.active)
    return { id, slug: routes[id].slug, redirect: true }
  return undefined
}

export function blockAnchor(id: string) {
  return compactId(id)
}

export function rewriteLink(
  href: string,
  routes: Record<string, RouteRecord>,
  rootId: string
) {
  if (href.startsWith('#')) return '#' + compactId(href.slice(1))
  let url: URL
  try {
    url = new URL(href, site.origin)
  } catch {
    return href
  }
  if (
    ![
      'www.notion.so',
      'notion.so',
      'notion.site',
      'www.notion.site',
      'transitivebullsh.it'
    ].includes(url.hostname) &&
    !url.hostname.endsWith('.notion.site')
  )
    return href
  if (url.hostname === new URL(site.origin).hostname && url.pathname === '/')
    return '/' + (url.hash ? '#' + compactId(url.hash.slice(1)) : '')
  const segment = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
  const id = pageIdFromPath(segment)
  if (id === rootId)
    return '/' + (url.hash ? '#' + compactId(url.hash.slice(1)) : '')
  const match = resolveRoute(segment, routes)
  if (!match) return href
  return '/' + match.slug + (url.hash ? '#' + compactId(url.hash.slice(1)) : '')
}

// Separate route namespaces allow migration without dropping either source entry.
export function crossCollectionSlugWarnings(
  articles: Record<string, RouteRecord>,
  projects: Record<string, RouteRecord>
) {
  const warnings: string[] = []
  for (const [projectId, project] of Object.entries(projects)) {
    if (!project.active) continue
    for (const [articleId, article] of Object.entries(articles)) {
      if (!article.active) continue
      const paths = new Set([article.slug, ...article.aliases])
      for (const slug of [project.slug, ...project.aliases]) {
        if (paths.has(slug))
          warnings.push(
            `Article/project slug conflict: ${slug} (article ${articleId}, project ${projectId}); both entries retained`
          )
      }
    }
  }
  return warnings
}
