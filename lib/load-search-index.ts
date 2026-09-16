import type { SearchIndex } from './search'

let pending: Promise<SearchIndex> | undefined

// Only called by the lazy-loaded palette. Reopenings reuse the same asset.
export function loadSearchIndex() {
  pending ??= fetch('/search-index.json')
    .then(async (response) => {
      if (!response.ok) throw new Error('Unable to load search')
      const index: SearchIndex = await response.json()
      if (index.version !== 1 || !Array.isArray(index.documents))
        throw new Error('Unsupported search index')
      return index
    })
    .catch((err: unknown) => {
      pending = undefined
      throw err
    })
  return pending
}
