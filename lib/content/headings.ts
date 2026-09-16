import type { Block } from './schema'
import { walkBlocks } from './references'

export type Heading = { id: string; text: string; level: number; depth: number }

export function getHeadings(blocks: Block[]): Heading[] {
  const headings: Heading[] = []
  const levels: number[] = []
  walkBlocks(blocks, (block) => {
    if (block.type !== 'heading') return
    const text = block.richText
      .map((span) => span.text)
      .join('')
      .trim()
    if (!text) return
    while (levels.length && levels.at(-1)! >= block.level) levels.pop()
    const depth = levels.length
    levels.push(block.level)
    headings.push({ id: block.id, text, level: block.level, depth })
  })
  return headings
}

// Notion documents can start at any heading level or skip levels. Preserve
// their relative nesting while reserving h1 for the page title.
export function normalizeHeadingLevels(blocks: Block[]): Block[] {
  const levels = new Map(
    getHeadings(blocks).map((heading) => [heading.id, heading.depth + 1])
  )
  function normalize(items: Block[]): Block[] {
    return items.map((block) => {
      const normalized = { ...block, children: normalize(block.children) }
      if (normalized.type === 'heading')
        normalized.level = (levels.get(block.id) ?? 1) as 1 | 2 | 3
      return normalized
    })
  }
  return normalize(blocks)
}
