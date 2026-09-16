import { normalizeSearchText, type SearchIndex } from '../search'
import { site } from '../site'
import { walkBlocks } from './references'
import { validateSlug } from './routes'
import type { Article, Project, Snapshot } from './schema'

function articleBodyTerms(article: Article | Project, snapshot: Snapshot) {
  const text: string[] = []
  walkBlocks(article.blocks, (block) => {
    if ('richText' in block)
      text.push(block.richText.map((part) => part.text).join(''))
    if ('caption' in block)
      text.push(block.caption.map((part) => part.text).join(''))
    if (block.type === 'table')
      for (const row of block.rows)
        for (const cell of row)
          text.push(cell.map((part) => part.text).join(''))
    if (block.type === 'equation') text.push(block.expression)
    if (block.type === 'file') text.push(block.name)
    if (block.type === 'bookmark') {
      const preview = snapshot.bookmarks?.[block.url]
      if (preview) text.push(preview.title, preview.description)
    }
    if (block.type === 'embed' && block.tweetId) {
      const tweet = snapshot.tweets[block.tweetId]
      if (tweet?.status === 'available') text.push(tweet.data.text)
    }
  })
  // Deduplication keeps the lazy-loaded asset small; we don't need word counts.
  return [...new Set(normalizeSearchText(text.join(' ')).split(' '))]
    .filter(Boolean)
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
  ].sort(
    (a, b) =>
      (b.entry.published ?? '').localeCompare(a.entry.published ?? '') ||
      a.kind.localeCompare(b.kind) ||
      a.slug.localeCompare(b.slug)
  )
  return {
    version: 1,
    documents: [
      ...entries.map(({ entry, kind, slug }) => {
        validateSlug(slug)
        return {
          kind,
          href:
            (kind === 'project' ? '/projects/' : '/') +
            encodeURIComponent(slug),
          title: entry.title,
          published: entry.published,
          titleText: normalizeSearchText(entry.title),
          summaryText: normalizeSearchText(
            entry.description + ' ' + entry.tags.join(' ')
          ),
          bodyTerms: articleBodyTerms(entry, snapshot)
        }
      }),
      ...pages.map((page) => ({
        kind: 'page' as const,
        href: page.href,
        title: page.title,
        titleText: normalizeSearchText(page.title),
        summaryText: normalizeSearchText(page.summary),
        bodyTerms: ''
      }))
    ]
  }
}
