import { taskBatch, silentProgress, type TaskProgress } from '../task-progress'
import pMap from 'p-map'
import type { Article, Project, RouteRecord } from '../../lib/content/schema'
import type { NotionPage } from './source'

export async function importPages<T extends Article | Project>(options: {
  progress?: TaskProgress
  kind?: 'article' | 'project'
  pages: NotionPage[]
  previous: Record<string, T>
  routes: Record<string, RouteRecord>
  force?: boolean
  fast?: boolean
  read: (page: NotionPage) => Promise<T>
  report: (message: string) => void
  warn?: (message: string) => void
}) {
  const articles: Record<string, T> = {}
  for (const [id, article] of Object.entries(options.previous)) {
    const route = options.routes[id]
    if (route?.active)
      articles[id] =
        article.slug === route.slug ? article : { ...article, slug: route.slug }
  }
  const run = taskBatch(
    options.progress ?? silentProgress,
    options.pages.length
  )
  await pMap(
    options.pages,
    async (page, index) => {
      const route = options.routes[page.id]!
      const path =
        (options.kind === 'project' ? '/projects/' : '/') + route.slug
      return run(path, async (task) => {
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
          task.status('unchanged')
          if (!options.progress)
            options.report(
              `[${index + 1}/${options.pages.length}] ${path} (unchanged)`
            )
          return
        }
        if (!options.progress)
          options.report(`[${index + 1}/${options.pages.length}] ${path}`)
        try {
          task.status('reading blocks and importing media')
          const article = await options.read(page)
          articles[page.id] = options.fast
            ? { ...article, needsImageSync: true }
            : article
          task.status('imported')
        } catch (err) {
          const message =
            path + ': ' + (err instanceof Error ? err.message : String(err))
          const fallback = articles[page.id]
            ? 'keeping the previous version'
            : 'skipping the new ' + (options.kind ?? 'article')
          if (!articles[page.id]) route.active = false
          const warn = options.warn ?? options.report
          task.status(fallback)
          warn(message + '; ' + fallback)
        }
      })
    },
    { concurrency: 8 }
  )
  return articles
}
