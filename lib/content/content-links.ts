import { rewriteLink } from './routes'
import type { Snapshot } from './schema'

// Resolve links at load time too: cached pages need not be fetched again when
// their target is published or its canonical route changes.
export function resolveContentLinks(snapshot: Snapshot) {
  function visit(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(visit)
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === 'href' && typeof item === 'string') {
          const record = value as Record<string, unknown>
          record[key] = rewriteLink(
            item,
            snapshot.routes,
            snapshot.source.rootPageId,
            snapshot.projectRoutes
          )
        } else visit(item)
      }
    }
  }
  visit(snapshot.articles)
  visit(snapshot.projects)
  return snapshot
}
