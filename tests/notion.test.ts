import { describe, expect, it, vi } from 'vitest'
import { NotionSourceClient, pageSchema } from '../scripts/notion/source'
import { Normalizer } from '../scripts/notion/normalize'
import type { MediaSource } from '../lib/content/schema'

const a = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const b = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const c = 'cccccccccccccccccccccccccccccccc'
const span = (text: string) => ({
  type: 'text',
  plain_text: text,
  href: null,
  annotations: {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    color: 'default'
  }
})

describe('official Notion traversal', () => {
  it('rejects a token from another workspace before reading content', async () => {
    const api = new NotionSourceClient('fixture')
    const request = vi
      .spyOn(api, 'request')
      .mockResolvedValue({ type: 'bot', bot: { workspace_id: a } })
    await expect(api.verify()).rejects.toThrow('different workspace')
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('reads every pagination page and rejects repeated cursors', async () => {
    const api = new NotionSourceClient('fixture')
    const request = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce({
        results: [1],
        has_more: true,
        next_cursor: 'next'
      })
      .mockResolvedValueOnce({
        results: [2],
        has_more: false,
        next_cursor: null
      })
    expect(await api.list('blocks/' + a + '/children')).toEqual([1, 2])
    expect(request.mock.calls[1]?.[0]).toContain('start_cursor=next')
    request
      .mockReset()
      .mockResolvedValue({ results: [], has_more: true, next_cursor: 'same' })
    await expect(api.list('blocks/' + a + '/children')).rejects.toThrow(
      'pagination'
    )
  })
  it('accepts the pinned API deletion field without requiring the removed archived field', () => {
    const page = pageSchema.parse({
      object: 'page',
      id: a,
      parent: { type: 'data_source_id', data_source_id: b },
      properties: {},
      last_edited_time: '2026-01-01T00:00:00.000Z',
      in_trash: false
    })
    expect(page.archived).toBeUndefined()
    expect(page.in_trash).toBe(false)
  })
  it('fails on unsupported blocks instead of discarding them', async () => {
    const api = new NotionSourceClient('fixture')
    vi.spyOn(api, 'children').mockResolvedValue([
      {
        id: a,
        type: 'future_block',
        has_children: false,
        last_edited_time: '',
        future_block: {}
      }
    ])
    const normalize = new Normalizer(api, {}, async () => 'media')
    await expect(normalize.blocks(b)).rejects.toThrow(
      'Unsupported Notion block type: future_block'
    )
  })
  it('imports comparison rows as properties without traversing their page bodies', async () => {
    const api = new NotionSourceClient('fixture')
    vi.spyOn(api, 'database').mockResolvedValue({
      data_sources: [{ id: b }],
      parent: { type: 'page_id', page_id: a }
    })
    vi.spyOn(api, 'source').mockResolvedValue({
      id: b,
      parent: { type: 'database_id', database_id: a },
      properties: {
        Name: { id: 'title', type: 'title' },
        License: { id: 'license', type: 'select' }
      }
    })
    vi.spyOn(api, 'rows').mockResolvedValue([
      {
        object: 'page',
        id: c,
        parent: { type: 'data_source_id', data_source_id: b },
        properties: {
          Name: { id: 'title', type: 'title', title: [span('A tool')] },
          License: { id: 'license', type: 'select', select: { name: 'MIT' } }
        },
        last_edited_time: '',
        in_trash: false
      }
    ])
    const children = vi.spyOn(api, 'children')
    const normalize = new Normalizer(api, {}, async () => 'media')
    const table = await normalize.databaseTable(a)
    expect(table.columns).toEqual(['Name', 'License'])
    expect(
      table.rows[0]?.map((cell) => cell.map((part) => part.text).join(''))
    ).toEqual(['A tool', 'MIT'])
    expect(children).not.toHaveBeenCalled()
  })
  it('omits excluded child pages without fetching their bodies', async () => {
    const api = new NotionSourceClient('fixture')
    const children = vi.spyOn(api, 'children')
    const normalize = new Normalizer(api, {}, async () => 'media')
    expect(
      await normalize.block(
        {
          id: a,
          type: 'child_page',
          has_children: true,
          last_edited_time: '',
          child_page: { title: 'Excluded' }
        },
        new Set()
      )
    ).toBeUndefined()
    expect(children).not.toHaveBeenCalled()
  })
  it.each(
    ['image', 'video', 'audio', 'file', 'pdf'].flatMap((type) =>
      ['file', 'external'].map((kind) => ({ type, kind }))
    )
  )(
    'reuses saved $type ($kind) and defers unsynced media until normal sync',
    async ({ type, kind }) => {
      const api = new NotionSourceClient('fixture')
      const importMedia = vi.fn<
        (
          source: MediaSource,
          url: string,
          refresh?: () => Promise<string>
        ) => Promise<string>
      >(async () => 'imported')
      const reuseMedia = vi.fn<(key: string) => boolean>((key) => key === a)
      const normalize = new Normalizer(api, {}, importMedia, {
        skipMedia: true,
        reuseMedia
      })
      const mediaBlock = (id: string, normalizer = normalize) =>
        normalizer.block(
          {
            id,
            type,
            has_children: false,
            last_edited_time: '2026-01-01T00:00:00.000Z',
            [type]: {
              type: kind,
              [kind]: { url: 'https://example.com/media' },
              caption: []
            }
          },
          new Set()
        )

      await expect(mediaBlock(a)).resolves.toMatchObject({
        type: type === 'pdf' ? 'file' : type,
        media: a
      })
      await expect(mediaBlock(b)).resolves.toBeUndefined()
      expect(reuseMedia).toHaveBeenCalledTimes(2)
      expect(importMedia).not.toHaveBeenCalled()
      expect(normalize.warnings).toEqual([
        'Skipped unsynced media ' + b + ' in fast mode'
      ])

      const normal = new Normalizer(api, {}, importMedia)
      await expect(mediaBlock(b, normal)).resolves.toMatchObject({
        type: type === 'pdf' ? 'file' : type,
        media: 'imported'
      })
      expect(importMedia).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ key: b, kind }),
        'https://example.com/media',
        expect.any(Function)
      )
    }
  )
  it('keeps external video embeds in fast mode without importing media', async () => {
    const importMedia = vi.fn<() => Promise<string>>(async () => 'imported')
    const normalize = new Normalizer(
      new NotionSourceClient('fixture'),
      {},
      importMedia,
      { skipMedia: true }
    )
    await expect(
      normalize.block(
        {
          id: a,
          type: 'video',
          has_children: false,
          last_edited_time: '',
          video: {
            type: 'external',
            external: { url: 'https://www.youtube.com/watch?v=example' },
            caption: []
          }
        },
        new Set()
      )
    ).resolves.toMatchObject({
      type: 'video',
      url: 'https://www.youtube.com/watch?v=example'
    })
    expect(importMedia).not.toHaveBeenCalled()
    expect(normalize.warnings).toEqual([])
  })
  it('propagates inaccessible required content as a failure', async () => {
    const api = new NotionSourceClient('fixture')
    vi.spyOn(api, 'children').mockRejectedValue(new Error('object_not_found'))
    await expect(
      new Normalizer(api, {}, async () => 'media').blocks(a)
    ).rejects.toThrow('object_not_found')
  })
})
