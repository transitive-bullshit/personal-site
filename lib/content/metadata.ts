import type { Article, Project, Snapshot } from './schema'
import { defaultSocialImages } from '../metadata'
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

export const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': site.origin + '/#person',
      name: site.author,
      description:
        'Software developer and open source creator sharing projects and writing about software, AI, and entrepreneurship.',
      alternateName: site.name,
      url: site.origin,
      image: site.origin + '/icon.png',
      sameAs: [
        'https://github.com/transitive-bullshit',
        'https://x.com/' + site.twitter
      ]
    },
    {
      '@type': 'WebSite',
      '@id': site.origin + '/#website',
      name: site.name,
      description: site.description,
      url: site.origin,
      inLanguage: 'en',
      publisher: { '@id': site.origin + '/#person' }
    }
  ]
}

export function pageJsonLd(
  name: string,
  description: string,
  path: string,
  entries?: { title: string; path: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': entries ? 'CollectionPage' : 'WebPage',
    '@id': site.origin + path + '#webpage',
    name,
    description,
    url: site.origin + path,
    isPartOf: { '@id': site.origin + '/#website' },
    about: { '@id': site.origin + '/#person' },
    mainEntity: entries
      ? {
          '@type': 'ItemList',
          numberOfItems: entries.length,
          itemListElement: entries.map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: entry.title,
            url: site.origin + entry.path
          }))
        }
      : undefined
  }
}

export function projectJsonLd(project: Project, snapshot: Snapshot) {
  const media = project.cover ? snapshot.media[project.cover] : undefined
  const image = media?.variants.at(-1) ?? media?.original
  const authors = project.authors.flatMap((author) =>
    author.name ? [{ '@type': 'Person', name: author.name }] : []
  )
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': site.origin + '/projects/' + project.slug + '#project',
    name: project.title,
    description: project.description,
    url: site.origin + '/projects/' + project.slug,
    mainEntityOfPage: site.origin + '/projects/' + project.slug,
    datePublished: project.published,
    dateModified: project.modified,
    keywords: project.tags,
    image: image?.url ?? defaultSocialImages()[0]!.url,
    author: authors.length ? authors : undefined,
    sameAs: project.website
  }
}
