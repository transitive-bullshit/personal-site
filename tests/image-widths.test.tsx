import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Blocks } from '../components/article/blocks'
import { blockSchema, type Block, type Snapshot } from '../lib/content/schema'
import { syncImageWidths } from '../scripts/notion/image-widths'

vi.mock('../components/article/media', () => ({
  ZoomableImage: () => <img alt='' />,
  NotionIcon: () => null
}))
vi.mock('../components/article/code-block', () => ({ CodeBlock: () => null }))
vi.mock('../components/article/tweet', () => ({ ArticleTweet: () => null }))
vi.mock('../components/article/bookmark', () => ({ Bookmark: () => null }))

type Fetch = NonNullable<Parameters<typeof syncImageWidths>[1]['fetch']>

const ids = [
  '3e5edb27f12480bcaeaddc7ff5430b47',
  '3e5edb27f12480a48852c00970dfc23e',
  '3e5edb27f1248085b67ed7f0b8e750da'
]
const uuid = (id: string) =>
  id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
const image = (id: string): Block => ({
  id,
  type: 'image',
  media: id,
  caption: [],
  children: []
})
const response = {
  recordMap: {
    block: Object.fromEntries(
      ids.map((id, i) => [
        uuid(id),
        {
          value: {
            value: {
              id: uuid(id),
              type: 'image',
              format: {
                block_width: [2266, 432, 480][i],
                block_page_width: i === 0,
                block_full_width: false
              }
            },
            role: 'reader'
          }
        }
      ])
    )
  }
}

describe('Notion image display widths', () => {
  it('syncs the real page-width and resized formats through the schema and renderer', async () => {
    const blocks = ids.map(image)
    const fetch = vi.fn<Fetch>().mockResolvedValue(response)
    await syncImageWidths(blocks, {
      fetch,
      warn: vi.fn<(message: string) => void>()
    })
    const parsed = blocks.map((block) => blockSchema.parse(block))
    const html = renderToStaticMarkup(
      <Blocks blocks={parsed} snapshot={{ media: {} } as Snapshot} />
    )
    expect(html).toContain(`id="${ids[0]}"`)
    expect(html).toContain('width:432px;max-width:100%;margin-inline:auto')
    expect(html).toContain('width:480px;max-width:100%;margin-inline:auto')
    expect(html).not.toContain('width:2266px')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]![0].body.requests).toHaveLength(3)
  })

  it('retains saved widths on failure or missing records and warns', async () => {
    const block = { ...image(ids[1]!), width: 432 }
    const warn = vi.fn<(message: string) => void>()
    await syncImageWidths([block], {
      fetch: vi.fn<Fetch>().mockRejectedValue(new Error('offline')),
      warn
    })
    expect(block.width).toBe(432)
    await syncImageWidths([block], {
      fetch: vi.fn<Fetch>().mockResolvedValue({ recordMap: { block: {} } }),
      warn
    })
    expect(block.width).toBe(432)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('clears a saved width when an image becomes page-width, including nested images', async () => {
    const block = { ...image(ids[0]!), width: 432 }
    await syncImageWidths(
      [{ id: 'a'.repeat(32), type: 'column', children: [block] }],
      {
        fetch: vi.fn<Fetch>().mockResolvedValue(response),
        warn: vi.fn<(message: string) => void>()
      }
    )
    expect(block.width).toBeUndefined()
  })

  it('restores saved widths for freshly imported blocks when the supplement fails', async () => {
    const block = image(ids[1]!)
    await syncImageWidths([block], {
      previousBlocks: [{ ...image(ids[1]!), width: 432 } as Block],
      fetch: vi.fn<Fetch>().mockRejectedValue(new Error('offline')),
      warn: vi.fn<(message: string) => void>()
    })
    expect(block).toMatchObject({ width: 432 })
  })

  it('skips requests without images and rejects invalid snapshot widths', async () => {
    const fetch = vi.fn<Fetch>()
    await syncImageWidths([], {
      fetch,
      warn: vi.fn<(message: string) => void>()
    })
    expect(fetch).not.toHaveBeenCalled()
    for (const width of [0, -1, Infinity, NaN]) {
      expect(blockSchema.safeParse({ ...image(ids[0]!), width }).success).toBe(
        false
      )
    }
  })
})
