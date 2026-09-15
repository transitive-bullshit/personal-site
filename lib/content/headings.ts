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
