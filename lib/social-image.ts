import { createHash } from 'node:crypto'
import type { Article, Snapshot } from './content/schema'
import { deploymentOrigin, site } from './site'
import { getBodyOverride, plainTextDescription } from './content/body-overrides'

export const socialImageSize = { width: 1200, height: 630 } as const
// Bump when the template changes so social crawlers discover a fresh image URL.
export const socialImageTemplateVersion = 2

// Key exceptions by Notion ID so title or slug changes retain the choice.
const coverSocialImageArticleIds = new Set(['3f7edb27f12481ad887ee8617d554ab2'])

function socialImageCoverOverride(article: Article, snapshot: Snapshot) {
  if (!coverSocialImageArticleIds.has(article.id)) return undefined
  const media = article.cover ? snapshot.media[article.cover] : undefined
  const image = media?.variants.at(-1) ?? media?.original
  return image?.mime.startsWith('image/') ? image : undefined
}

export function socialImageData(article: Article, snapshot: Snapshot) {
  const media = article.cover ? snapshot.media[article.cover] : undefined
  return {
    title: article.title,
    description: plainTextDescription(article),
    author: article.author,
    published: article.published,
    siteName: site.name,
    domain: new URL(site.origin).hostname,
    cover: (media?.variants.at(-1) ?? media?.original)?.url
  }
}

export type SocialImageData = Omit<
  ReturnType<typeof socialImageData>,
  'siteName'
> & {
  siteName: string
}

export function socialImagePath(article: Article, snapshot: Snapshot) {
  const override = getBodyOverride(article.id)?.socialImagePath
  if (override) return override
  const version = createHash('sha256')
    .update(
      JSON.stringify([
        socialImageTemplateVersion,
        socialImageData(article, snapshot)
      ])
    )
    .digest('hex')
    .slice(0, 16)
  return (
    '/api/social-image/' + encodeURIComponent(article.slug) + '?v=' + version
  )
}

export function socialImageUrl(article: Article, snapshot: Snapshot) {
  return (
    socialImageCoverOverride(article, snapshot)?.url ??
    deploymentOrigin() + socialImagePath(article, snapshot)
  )
}

export function articleSocialImage(article: Article, snapshot: Snapshot) {
  const cover = socialImageCoverOverride(article, snapshot)
  return {
    url: socialImageUrl(article, snapshot),
    width: cover ? cover.width : socialImageSize.width,
    height: cover ? cover.height : socialImageSize.height,
    alt: article.title,
    type: cover?.mime ?? 'image/webp'
  }
}
