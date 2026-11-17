import { normalizeSearchText, type SearchIndex } from '../search'
import { site } from '../site'
import { walkBlocks } from './references'
import { validateSlug } from './routes'
import type { Article, Project, Snapshot } from './schema'

function articleBodyTerms(article: Article | Project, metadata: string) {
  const text: string[] = []
  walkBlocks(article.blocks, (block) => {
    if (block.type === 'heading')
      text.push(block.richText.map((part) => part.text).join(''))
    if ('caption' in block)
      text.push(block.caption.map((part) => part.text).join(''))
  })
  const metadataTerms = new Set(metadata.split(' '))
  // Headings and authored captions provide a small, predictable fallback.
  return [...new Set(normalizeSearchText(text.join(' ')).split(' '))]
    .filter((term) => term && !metadataTerms.has(term))
    .sort()
    .join(' ')
}

// Add future top-level pages here when their routes are implemented.
const pages = [
  { href: '/', title: 'Home', summary: site.description + ' ' + site.author },
  {
    href: '/projects',
    title: 'Projects',
    summary: 'Software, open source, and creative experiments'
  },
  { href: '/writing', title: 'Writing', summary: 'All articles and essays' }
]

export function buildSearchIndex(snapshot: Snapshot): SearchIndex {
  const entries = [
    ...Object.values(snapshot.articles)
      .filter((entry) => snapshot.routes[entry.id]?.active)
      .map((entry) => ({
        entry,
        kind: 'article' as const,
        slug: snapshot.routes[entry.id]!.slug
      })),
    ...Object.values(snapshot.projects ?? {})
      .filter((entry) => snapshot.projectRoutes?.[entry.id]?.active)
      .map((entry) => ({
        entry,
        kind: 'project' as const,
        slug: snapshot.projectRoutes![entry.id]!.slug
      }))
  ]
  return {
    version: 1,
    documents: [
      ...entries.map(({ entry, kind, slug }) => {
        validateSlug(slug)
        const titleText = normalizeSearchText(entry.title)
        const summaryText = normalizeSearchText(
          [
            entry.description,
            ...entry.tags,
            kind,
            'type' in entry ? entry.type : ''
          ].join(' ')
        )
        return {
          kind,
          href:
            (kind === 'project' ? '/projects/' : '/') +
            encodeURIComponent(slug),
          title: entry.title,
          published: entry.published,
          titleText,
          summaryText,
          bodyTerms: articleBodyTerms(entry, titleText + ' ' + summaryText)
        }
      }),
      ...pages.map((page) => ({
        kind: 'page' as const,
        href: page.href,
        title: page.title,
        titleText: normalizeSearchText(page.title),
        summaryText: normalizeSearchText(page.summary + ' page'),
        bodyTerms: ''
      }))
    ].sort((a, b) => a.href.localeCompare(b.href, 'en'))
  }
}
