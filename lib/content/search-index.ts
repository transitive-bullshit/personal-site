import { normalizeSearchText, type SearchIndex } from '../search'
import { site } from '../site'
import { walkBlocks } from './references'
import { validateSlug } from './routes'
import type { Article, Snapshot } from './schema'

function articleBodyTerms(article: Article, snapshot: Snapshot) {
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
  { href: '/writing', title: 'Writing', summary: 'All articles and essays' }
]

export function buildSearchIndex(snapshot: Snapshot): SearchIndex {
  const articles = Object.values(snapshot.articles)
    .filter((article) => snapshot.routes[article.id]?.active)
    .sort(
      (a, b) =>
        b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug)
    )
  return {
    version: 1,
    documents: [
      ...articles.map((article) => {
        const slug = snapshot.routes[article.id]!.slug
        validateSlug(slug)
        return {
          href: '/' + encodeURIComponent(slug),
          title: article.title,
          published: article.published,
          titleText: normalizeSearchText(article.title),
          summaryText: normalizeSearchText(
            article.description + ' ' + article.tags.join(' ')
          ),
          bodyTerms: articleBodyTerms(article, snapshot)
        }
      }),
      ...pages.map((page) => ({
        href: page.href,
        title: page.title,
        titleText: normalizeSearchText(page.title),
        summaryText: normalizeSearchText(page.summary),
        bodyTerms: ''
      }))
    ]
  }
}
