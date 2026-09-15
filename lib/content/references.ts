import type { Article, Block, Snapshot } from './schema'
import { validateRoutes } from './routes'

export function walkBlocks(blocks: Block[], visit: (block: Block) => void) {
  for (const block of blocks) {
    visit(block)
    walkBlocks(block.children, visit)
  }
}

export function articleReferences(article: Article) {
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

export function validateSnapshot(snapshot: Snapshot) {
  validateRoutes(snapshot.routes)
  for (const [id, route] of Object.entries(snapshot.routes)) {
    if (route.active !== Boolean(snapshot.articles[id]))
      throw new Error('Route/article publication mismatch: ' + id)
  }
  for (const [id, article] of Object.entries(snapshot.articles)) {
    if (article.id !== id || snapshot.routes[id]?.slug !== article.slug)
      throw new Error('Article identity/path mismatch: ' + id)
    const refs = articleReferences(article)
    for (const key of refs.media)
      if (!snapshot.media[key]) throw new Error('Missing media: ' + key)
    for (const key of refs.tweets)
      if (!snapshot.tweets[key]) throw new Error('Missing tweet state: ' + key)
    const ids = new Set<string>()
    walkBlocks(article.blocks, (block) => {
      if (ids.has(block.id))
        throw new Error('Duplicate block ID in article ' + id + ': ' + block.id)
      ids.add(block.id)
    })
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
