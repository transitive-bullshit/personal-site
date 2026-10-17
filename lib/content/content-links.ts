import { internalPageId } from './references'
import { rewriteLink } from './routes'
import type { Snapshot } from './schema'

function visitHrefs(
  snapshot: Snapshot,
  visit: (href: string, entryId: string) => string | undefined
) {
  function walk(value: unknown, entryId: string): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, entryId)
    } else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      for (const [key, item] of Object.entries(record)) {
        if (key === 'href' && typeof item === 'string') {
          const href = visit(item, entryId)
          if (href === undefined) delete record[key]
          else record[key] = href
        } else walk(item, entryId)
      }
    }
  }
  for (const entries of [snapshot.articles, snapshot.projects ?? {}])
    for (const [id, entry] of Object.entries(entries)) walk(entry, id)
}

// Resolve links at load time too: cached pages need not be fetched again when
// their target is published or its canonical route changes.
export function resolveContentLinks(snapshot: Snapshot) {
  visitHrefs(snapshot, (href) =>
    rewriteLink(
      href,
      snapshot.routes,
      snapshot.source.rootPageId,
      snapshot.projectRoutes
    )
  )
  return snapshot
}

// Links to unpublished pages would expose Notion IDs; render them as text.
export function unlinkUnpublishedPages(
  snapshot: Snapshot,
  warn: (message: string) => void
) {
  visitHrefs(snapshot, (href, entryId) => {
    if (!internalPageId(href)) return href
    warn(`Unlinked unpublished page ${href} in ${entryId}`)
    return undefined
  })
  return snapshot
}
