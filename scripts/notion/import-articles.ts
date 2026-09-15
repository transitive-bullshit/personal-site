import pMap from 'p-map'
import type { Article, RouteRecord } from '../../lib/content/schema'
import type { NotionPage } from './source'

export async function importArticles(options: {
  pages: NotionPage[]
  previous: Record<string, Article>
  routes: Record<string, RouteRecord>
  force?: boolean
  fast?: boolean
  read: (page: NotionPage) => Promise<Article>
  report: (message: string) => void
  warn?: (message: string) => void
}) {
  const articles: Record<string, Article> = {}
  for (const [id, article] of Object.entries(options.previous)) {
    const route = options.routes[id]
    if (route?.active)
      articles[id] =
        article.slug === route.slug ? article : { ...article, slug: route.slug }
  }
  await pMap(
    options.pages,
    async (page, index) => {
      const route = options.routes[page.id]!
      const path = '/' + route.slug
      const previous = options.previous[page.id]
      const sourceEdited = Date.parse(page.last_edited_time)
      const importedEdited = Date.parse(previous?.modified ?? '')
      if (
        !options.force &&
        previous &&
        !previous.needsImageSync &&
        Number.isFinite(sourceEdited) &&
        Number.isFinite(importedEdited) &&
        sourceEdited <= importedEdited
      ) {
        options.report(
          `[${index + 1}/${options.pages.length}] ${path} (unchanged)`
        )
        return
      }
      options.report(`[${index + 1}/${options.pages.length}] ${path}`)
      try {
        const article = await options.read(page)
        articles[page.id] = options.fast
          ? { ...article, needsImageSync: true }
          : article
      } catch (err) {
        const message =
          path + ': ' + (err instanceof Error ? err.message : String(err))
        const fallback = articles[page.id]
          ? 'keeping the previous version'
          : 'skipping the new article'
        if (!articles[page.id]) route.active = false
        const warn = options.warn ?? options.report
        warn(message + '; ' + fallback)
      }
    },
    { concurrency: 8 }
  )
  return articles
}
