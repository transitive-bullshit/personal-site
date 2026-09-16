import 'server-only'
import type { LinkPreviewData } from '@/lib/link-preview'
import { site } from '@/lib/site'
import { socialImagePath } from '@/lib/social-image'
import { content } from './load'

export const internalLinkPreviews: LinkPreviewData[] = Object.values(
  content.articles
).map((article) => {
  const media = article.cover ? content.media[article.cover] : undefined
  return {
    url: '/' + article.slug,
    title: article.title,
    description: article.description,
    image:
      (media?.variants.at(-1) ?? media?.original)?.url ??
      socialImagePath(article, content),
    imageAlt: article.cover ? article.title : '',
    siteName: site.name
  }
})
