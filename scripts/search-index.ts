import { buildSearchIndex } from '../lib/content/search-index'
import { publishJson } from './io'
import type { Snapshot } from '../lib/content/schema'

export function publishSearchIndex(
  snapshot: Snapshot,
  path = 'public/search-index.json'
) {
  return publishJson(buildSearchIndex(snapshot), path, 0)
}
