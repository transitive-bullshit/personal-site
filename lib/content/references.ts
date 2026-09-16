import type { Article, Block, Project, Snapshot } from './schema'
import { site } from '../site'
import { pageIdFromPath, validateRoutes } from './routes'

export function walkBlocks(blocks: Block[], visit: (block: Block) => void) {
  for (const block of blocks) {
    visit(block)
    walkBlocks(block.children, visit)
  }
}

export function articleReferences(article: Article | Project) {
  const media = new Set<string>()
  const tweets = new Set<string>()
  if (article.cover) media.add(article.cover)
  if (article.icon?.type === 'image') media.add(article.icon.media)
  walkBlocks(article.blocks, (block) => {
    if ('media' in block && block.media) media.add(block.media)
    if (block.type === 'callout' && block.icon?.type === 'image')
      media.add(block.icon.media)
    if (block.type === 'embed' && block.tweetId) tweets.add(block.tweetId)
  })
  return { media, tweets }
}

function visitHrefs(value: unknown, visit: (href: string) => void) {
  if (Array.isArray(value)) {
    for (const item of value) visitHrefs(item, visit)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, item] of Object.entries(value)) {
    if (key === 'href' && typeof item === 'string') visit(item)
    else visitHrefs(item, visit)
  }
}

export function internalPageId(href: string) {
  let url: URL
  try {
    url = new URL(href, site.origin)
  } catch {
    return undefined
  }
  if (
    !['transitivebullsh.it', 'www.transitivebullsh.it'].includes(url.hostname)
  )
    return undefined
  const segment = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
  return pageIdFromPath(segment)
}

export function validateSnapshot(snapshot: Snapshot) {
  for (const [routes, entries] of [
    [snapshot.routes, snapshot.articles],
    [snapshot.projectRoutes ?? {}, snapshot.projects ?? {}]
  ] as const) {
    validateRoutes(routes)
    for (const [id, route] of Object.entries(routes)) {
      if (route.active !== Boolean(entries[id]))
        throw new Error('Route/article publication mismatch: ' + id)
    }
    for (const [id, article] of Object.entries(entries)) {
      if (article.id !== id || routes[id]?.slug !== article.slug)
        throw new Error('Article identity/path mismatch: ' + id)
      const refs = articleReferences(article)
      visitHrefs(article, (href) => {
        const pageId = internalPageId(href)
        if (pageId)
          throw new Error(
            'ID-shaped internal link in article ' + id + ': ' + href
          )
      })
      for (const key of refs.media)
        if (!snapshot.media[key]) throw new Error('Missing media: ' + key)
      for (const key of refs.tweets)
        if (!snapshot.tweets[key])
          throw new Error('Missing tweet state: ' + key)
      const ids = new Set<string>()
      walkBlocks(article.blocks, (block) => {
        if (ids.has(block.id))
          throw new Error(
            'Duplicate block ID in article ' + id + ': ' + block.id
          )
        ids.add(block.id)
      })
    }
  }
  for (const media of [
    ...Object.values(snapshot.media),
    ...Object.values(snapshot.bookmarks ?? {}).flatMap((preview) =>
      preview.image ? [preview.image] : []
    )
  ]) {
    for (const asset of [media.original, ...media.variants]) {
      if (
        !asset.key.includes(asset.hash) ||
        !new URL(asset.url).pathname.endsWith('/' + asset.key)
      )
        throw new Error('Invalid content-addressed media reference')
    }
    if (media.source.kind === 'file' && media.source.url)
      throw new Error('Temporary Notion URL in media descriptor')
  }
}
