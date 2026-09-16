import 'server-only'
import type { LinkPreviewData } from '@/lib/link-preview'
import { site } from '@/lib/site'
import { socialImagePath } from '@/lib/social-image'
import { content } from './load'

const articlePreviews: LinkPreviewData[] = Object.values(content.articles).map(
  (article) => {
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
  }
)

export const internalLinkPreviews: LinkPreviewData[] = [
  ...articlePreviews,
  ...Object.values(content.projects ?? {}).map((project) => {
    const media = project.cover ? content.media[project.cover] : undefined
    return {
      url: '/projects/' + project.slug,
      title: project.title,
      description: project.description,
      image: (media?.variants.at(-1) ?? media?.original)?.url,
      imageAlt: project.title,
      siteName: site.name
    }
  })
]
