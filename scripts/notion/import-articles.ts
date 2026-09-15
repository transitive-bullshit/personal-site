import type { Article, RouteRecord } from '../../lib/content/schema'
import type { NotionPage } from './source'

export async function importArticles(options: {
  pages: NotionPage[]
  previous: Record<string, Article>
  routes: Record<string, RouteRecord>
  read: (page: NotionPage) => Promise<Article>
  report: (message: string) => void
}) {
  const articles: Record<string, Article> = {}
  for (const [id, article] of Object.entries(options.previous)) {
    if (options.routes[id]?.active) articles[id] = article
  }
  const errors: string[] = []
  let cursor = 0
  async function worker() {
    while (cursor < options.pages.length) {
      const index = cursor++
      const page = options.pages[index]!
      const path = '/' + options.routes[page.id]!.slug
      options.report(`[${index + 1}/${options.pages.length}] ${path}`)
      try {
        articles[page.id] = await options.read(page)
      } catch (err) {
        const message =
          path + ': ' + (err instanceof Error ? err.message : String(err))
        errors.push(message)
        options.report(message)
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(3, options.pages.length) }, worker)
  )
  if (errors.length)
    throw new Error('Content import failed:\n' + errors.sort().join('\n'))
  return articles
}
