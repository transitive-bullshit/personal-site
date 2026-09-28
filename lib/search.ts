export type SearchDocument = {
  href: string
  kind?: 'article' | 'project' | 'page'
  title: string
  published?: string
  titleText: string
  summaryText: string
  bodyTerms: string
}

export type SearchIndex = {
  version: 1
  documents: SearchDocument[]
}

export function normalizeSearchText(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// The corpus is small: a linear keyword scan is cheaper and simpler than a trie.
// All query terms must match, with titles strongly preferred over summary/body.
export function searchDocuments(documents: SearchDocument[], search: string) {
  // Storage order is URL-based for Git; display order remains newest first.
  const ordered = [...documents].sort(
    (a, b) =>
      Number(a.kind === 'page') - Number(b.kind === 'page') ||
      (b.published ?? '').localeCompare(a.published ?? '') ||
      (a.kind ?? '').localeCompare(b.kind ?? '', 'en') ||
      a.href.localeCompare(b.href, 'en')
  )
  const query = normalizeSearchText(search)
  if (!query) return ordered
  const terms = [...new Set(query.split(' '))]
  return ordered
    .map((document, position) => {
      let score = 0
      for (const term of terms) {
        if (document.titleText.includes(term)) score += 100
        else if (document.summaryText.includes(term)) score += 25
        else if (document.bodyTerms.includes(term)) score += 10
        else return { document, position, score: 0 }
      }
      if (document.titleText === query) score += 500
      else if (document.titleText.startsWith(query)) score += 250
      else if (document.titleText.includes(query)) score += 200
      return { document, position, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .map(({ document }) => document)
}
