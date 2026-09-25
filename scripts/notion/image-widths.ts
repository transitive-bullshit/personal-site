import { NotionAPI } from 'notion-client'
import { z } from 'zod'
import type { Block } from '../../lib/content/schema'
import { walkBlocks } from '../../lib/content/references'
import { compactId } from '../../lib/content/routes'

const api = new NotionAPI({ ofetchOptions: { timeout: 15_000, retry: 2 } })
const responseSchema = z.object({
  recordMap: z.object({ block: z.record(z.string(), z.unknown()) })
})
const imageSchema = z.object({
  id: z.string().transform(compactId),
  type: z.literal('image'),
  format: z
    .object({
      block_width: z.number().positive().optional(),
      block_page_width: z.boolean().optional(),
      block_full_width: z.boolean().optional()
    })
    .optional()
})
const envelopeSchema = z.object({ value: z.unknown() })
type Request = {
  endpoint: string
  body: {
    requests: { pointer: { table: string; id: string }; version: number }[]
  }
}

// Only request images already selected by the official importer. Do not traverse
// pages or discover content through the unofficial API.
export async function syncImageWidths(
  blocks: Block[],
  {
    fetch = (request) => api.fetch(request),
    previousBlocks = [],
    warn
  }: {
    fetch?: (request: Request) => Promise<unknown>
    previousBlocks?: Block[]
    warn: (message: string) => void
  }
) {
  const savedWidths = new Map<string, number>()
  walkBlocks(previousBlocks, (block) => {
    if (block.type === 'image' && block.width !== undefined)
      savedWidths.set(block.id, block.width)
  })
  const images = new Map<string, Extract<Block, { type: 'image' }>[]>()
  walkBlocks(blocks, (block) => {
    if (block.type === 'image') {
      const savedWidth = savedWidths.get(block.id)
      if (block.width === undefined && savedWidth !== undefined)
        block.width = savedWidth
      const matches = images.get(block.id) ?? []
      matches.push(block)
      images.set(block.id, matches)
    }
  })
  const ids = [...images.keys()]
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100)
    let records: Record<string, unknown>
    try {
      const response = responseSchema.parse(
        await fetch({
          endpoint: 'syncRecordValues',
          body: {
            requests: batch.map((id) => ({
              pointer: {
                table: 'block',
                id: id.replace(
                  /(.{8})(.{4})(.{4})(.{4})(.{12})/,
                  '$1-$2-$3-$4-$5'
                )
              },
              version: -1
            }))
          }
        })
      )
      records = Object.fromEntries(
        Object.entries(response.recordMap.block).map(([id, value]) => [
          compactId(id),
          value
        ])
      )
    } catch {
      warn(
        `Image sizing unavailable for ${batch.length} images; keeping saved widths`
      )
      continue
    }
    for (const id of batch) {
      // Notion record-map v3 adds an envelope around the legacy value/role pair.
      let value = records[id]
      for (let depth = 0; depth < 2; depth++) {
        const envelope = envelopeSchema.safeParse(value)
        if (!envelope.success) break
        value = envelope.data.value
      }
      const parsed = imageSchema.safeParse(value)
      if (!parsed.success || parsed.data.id !== id) {
        warn(`Image sizing unavailable for ${id}; keeping saved width`)
        continue
      }
      const format = parsed.data.format
      const width =
        format?.block_page_width || format?.block_full_width
          ? undefined
          : format?.block_width
      for (const block of images.get(id)!) {
        if (width === undefined) delete block.width
        else block.width = width
      }
    }
  }
}
