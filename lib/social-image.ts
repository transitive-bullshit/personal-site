import { createHash } from 'node:crypto'
import type { Article, Snapshot } from './content/schema'
import { site } from './site'

export const socialImageSize = { width: 1200, height: 630 } as const
// Bump when the template changes so social crawlers discover a fresh image URL.
const templateVersion = 2

export function socialImageData(article: Article, snapshot: Snapshot) {
  const media = article.cover ? snapshot.media[article.cover] : undefined
  return {
    title: article.title,
    description: article.description,
    author: article.author,
    published: article.published,
    siteName: site.name,
    domain: new URL(site.origin).hostname,
    cover: (media?.variants.at(-1) ?? media?.original)?.url
  }
}

export type SocialImageData = ReturnType<typeof socialImageData>

export function socialImageUrl(article: Article, snapshot: Snapshot) {
  const version = createHash('sha256')
    .update(
      JSON.stringify([templateVersion, socialImageData(article, snapshot)])
    )
    .digest('hex')
    .slice(0, 16)
  return (
    site.origin +
    '/api/social-image/' +
    encodeURIComponent(article.slug) +
    '?v=' +
    version
  )
}
