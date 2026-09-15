import type { Article, Snapshot } from './schema'
import { site } from '../site'
import { socialImageUrl } from '../social-image'

export function articleJsonLd(article: Article, snapshot: Snapshot) {
  const image = article.cover
    ? snapshot.media[article.cover]?.original.url
    : undefined
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    author: { '@type': 'Person', name: article.author, url: site.origin },
    datePublished: article.published,
    dateModified: article.modified,
    mainEntityOfPage: site.origin + '/' + article.slug,
    url: site.origin + '/' + article.slug,
    image: [socialImageUrl(article, snapshot), ...(image ? [image] : [])]
  }
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
