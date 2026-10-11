import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  entryMarkdown,
  markdownBlocks,
  markdownText
} from '../lib/content/markdown'
import { plainSpan } from '../scripts/notion/normalize'
import { snapshotSchema, type Block } from '../lib/content/schema'
import { resolveContentLinks } from '../lib/content/content-links'
import { site } from '../lib/site'

vi.mock('@/lib/content/load', async () => {
  const { readFileSync } = await import('node:fs')
  const { snapshotSchema } = await import('../lib/content/schema')
  const { resolveContentLinks } = await import('../lib/content/content-links')
  const content = resolveContentLinks(
    snapshotSchema.parse(
      JSON.parse(readFileSync('content/snapshot.json', 'utf8'))
    )
  )
  return {
    content,
    articles: Object.values(content.articles),
    projects: Object.values(content.projects ?? {})
  }
})

import { generateStaticParams } from '../app/markdown/[...path]/route'
import { GET as legacyImage } from '../app/api/social-image/route'

const snapshot = resolveContentLinks(
  snapshotSchema.parse(
    JSON.parse(readFileSync('content/snapshot.json', 'utf8'))
  )
)
afterEach(() => vi.unstubAllGlobals())

describe('Markdown representations', () => {
  it('renders the complete published collection without runtime fetches', () => {
    const entries = [
      ...Object.values(snapshot.articles),
      ...Object.values(snapshot.projects ?? {})
    ]
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('Unexpected runtime fetch'))
    vi.stubGlobal('fetch', fetcher)
    expect(generateStaticParams()).toEqual([
      { path: ['index'] },
      { path: ['projects'] },
      { path: ['writing'] },
      ...Object.values(snapshot.articles).map(({ slug }) => ({ path: [slug] })),
      ...Object.values(snapshot.projects ?? {}).map(({ slug }) => ({
        path: ['projects', slug]
      }))
    ])
    for (const entry of entries) {
      const body = entryMarkdown(entry, snapshot)
      expect(body.startsWith('# ')).toBe(true)
      expect(body).toContain('Canonical URL: ' + site.origin)
      expect(body).not.toMatch(/\[object Object\]/)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('preserves nested lists, code fences, table cells, and normalized heading anchors', () => {
    const blocks: Block[] = [
      {
        id: '1'.repeat(32),
        type: 'heading',
        level: 2,
        richText: [plainSpan('Intro')],
        color: 'default',
        children: []
      },
      {
        id: '2'.repeat(32),
        type: 'bulleted_list_item',
        richText: [plainSpan('Parent')],
        color: 'default',
        children: [
          {
            id: '3'.repeat(32),
            type: 'numbered_list_item',
            richText: [plainSpan('Child')],
            color: 'default',
            children: []
          }
        ]
      },
      {
        id: '4'.repeat(32),
        type: 'code',
        language: 'markdown',
        richText: [plainSpan('```js\nconst n = 1\n```')],
        color: 'default',
        caption: [],
        children: []
      },
      {
        id: '5'.repeat(32),
        type: 'table',
        columns: ['a', 'b'],
        columnHeader: true,
        rowHeader: false,
        rows: [
          [[plainSpan('Header')], [plainSpan('Other')]],
          [[plainSpan('A|B\nC')], [{ ...plainSpan('x|y'), code: true }]]
        ],
        children: []
      }
    ]
    const body = markdownBlocks(blocks, snapshot, '/example')
    expect(body).toContain('<a id="' + '1'.repeat(32) + '"></a>\n\n## Intro')
    expect(body).toContain('- Parent\n\n  1. Child')
    expect(body).toContain('````markdown\n```js\nconst n = 1\n```\n````')
    expect(body).toContain('| A\\|B<br>C | ` x\\|y ` |')
  })

  it('resolves relative links, escapes text, and drops unsafe destinations', () => {
    expect(
      markdownText([{ ...plainSpan('Section'), href: '#intro' }], '/example')
    ).toBe('[Section](<' + site.origin + '/example#intro>)')
    expect(
      markdownText(
        [{ ...plainSpan('[danger]'), href: 'javascript:alert(1)' }],
        '/example'
      )
    ).toBe('\\[danger\\]')
    expect(
      markdownText([{ ...plainSpan('a`b'), code: true }], '/example')
    ).toBe('`` a`b ``')
    expect(
      markdownText(
        [plainSpan('Normal prose. A well-known project.')],
        '/example'
      )
    ).toBe('Normal prose. A well-known project.')
  })

  it('restores the legacy image URL without redirecting unknown IDs', () => {
    const response = legacyImage(
      new Request(
        site.origin +
          '/api/social-image?id=d1b5dcf8-b9ff-425b-8aef-5ce6f0730202'
      )
    )
    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toMatch(
      /^\/api\/social-image\/nextjs-notion-starter-kit\?v=[a-f0-9]{16}$/
    )
    expect(
      legacyImage(new Request(site.origin + '/api/social-image?id=not-public'))
        .status
    ).toBe(404)
  })
})
