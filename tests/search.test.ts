import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildSearchIndex } from '../lib/content/search-index'
import type { Article, Block, Snapshot } from '../lib/content/schema'
import {
  normalizeSearchText,
  searchDocuments,
  type SearchDocument,
  type SearchIndex
} from '../lib/search'
import { sourceContract } from '../lib/site'
import { readSnapshot } from '../scripts/io'
import { plainSpan } from '../scripts/notion/normalize'
import { publishSearchIndex } from '../scripts/search-index'

const directories: string[] = []
afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})

const a = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const b = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function paragraph(text: string, children: Block[] = []): Block {
  return {
    id: '11111111111111111111111111111111',
    type: 'paragraph',
    richText: [plainSpan(text)],
    color: 'default',
    children
  }
}

function snapshot(): Snapshot {
  const article: Article = {
    id: a,
    title: 'Café navigation',
    slug: 'canonical',
    description: 'Designing a better search experience',
    tags: ['TypeScript'],
    published: '2026-09-01',
    modified: '2026-09-01',
    author: 'Travis Fischer',
    featured: false,
    blocks: [
      paragraph('Nested keyword keyword', [paragraph('Interruption')]),
      {
        id: '22222222222222222222222222222222',
        type: 'code',
        language: 'javascript',
        richText: [plainSpan('AbortController')],
        caption: [plainSpan('Cancellation')],
        color: 'default',
        children: []
      },
      {
        id: '33333333333333333333333333333333',
        type: 'table',
        columns: ['Name'],
        rows: [[[plainSpan('Combobox')]]],
        columnHeader: true,
        rowHeader: false,
        children: []
      },
      {
        id: '44444444444444444444444444444444',
        type: 'bookmark',
        url: 'https://example.com',
        caption: [],
        children: []
      }
    ]
  }
  return {
    schemaVersion: 1,
    importerVersion: 1,
    source: { ...sourceContract, apiVersion: '2026-03-11', propertyIds: {} },
    articles: { [a]: article },
    routes: {
      [a]: { slug: article.slug, aliases: ['old-slug'], active: true },
      [b]: { slug: 'private', aliases: [], active: false }
    },
    media: {},
    tweets: {},
    bookmarks: {
      'https://example.com': {
        title: 'Accessible',
        description: 'Keyboard focus'
      }
    }
  }
}

describe('static search index', () => {
  it('indexes canonical public paths, nested text, captions, tables, tags and previews', () => {
    const index = buildSearchIndex(snapshot())
    expect(index.documents.map((document) => document.href)).toEqual([
      '/canonical',
      '/',
      '/projects',
      '/writing'
    ])
    const document = index.documents[0]!
    expect(document.titleText).toBe('cafe navigation')
    expect(document.summaryText).toContain('typescript')
    for (const keyword of [
      'interruption',
      'abortcontroller',
      'cancellation',
      'combobox',
      'accessible',
      'keyboard'
    ])
      expect(document.bodyTerms).toContain(keyword)
    expect(
      document.bodyTerms.split(' ').filter((term) => term === 'keyword')
    ).toHaveLength(1)
    expect(JSON.stringify(index)).not.toContain('https://example.com')
  })

  it('excludes inactive and removed articles and does not expose redirect aliases', () => {
    const content = snapshot()
    content.routes[a]!.active = false
    expect(
      buildSearchIndex(content).documents.map((document) => document.href)
    ).toEqual(['/', '/projects', '/writing'])
    delete content.articles[a]
    expect(buildSearchIndex(content).documents).toHaveLength(3)
    content.articles[a] = { ...snapshot().articles[a]!, id: b, slug: 'unsafe' }
    expect(buildSearchIndex(content).documents).toHaveLength(3)
  })

  it('orders empty searches by newest article, independently of source insertion order', () => {
    const content = snapshot()
    content.articles[b] = {
      ...content.articles[a]!,
      id: b,
      slug: 'newer',
      published: '2026-09-02'
    }
    content.routes[b] = { slug: 'newer', aliases: [], active: true }
    const original = buildSearchIndex(content)
    content.articles = Object.fromEntries(
      Object.entries(content.articles).reverse()
    )
    expect(buildSearchIndex(content)).toEqual(original)
    expect(original.documents[0]!.href).toBe('/newer')
  })

  it('rejects unsafe paths before producing navigation targets', () => {
    const content = snapshot()
    content.routes[a]!.slug = '/evil.example'
    expect(() => buildSearchIndex(content)).toThrow('Invalid')
  })

  it('publishes stable compact bytes, skips no-op writes, and refreshes removals', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'personal-site-search-test-')
    )
    directories.push(directory)
    const path = join(directory, 'public', 'search-index.json')
    const content = snapshot()
    expect(await publishSearchIndex(content, path)).toBe(true)
    const before = await readFile(path, 'utf8')
    expect(before.split('\n')).toHaveLength(2)
    expect(await publishSearchIndex(content, path)).toBe(false)
    delete content.articles[a]
    content.routes[a]!.active = false
    expect(await publishSearchIndex(content, path)).toBe(true)
    expect(JSON.parse(await readFile(path, 'utf8')).documents).toHaveLength(3)
  })

  it('indexes projects independently of colliding article slugs, including their body and metadata', () => {
    const content = snapshot()
    const { author: _author, ...base } = content.articles[a]!
    content.projects = {
      [b]: {
        ...base,
        id: b,
        title: 'Visual experiment',
        authors: [],
        description: 'Generative art',
        tags: ['WebGL'],
        blocks: [paragraph('Particle simulation')],
        published: undefined
      }
    }
    content.projectRoutes = {
      [b]: { slug: base.slug, aliases: ['old-project'], active: true }
    }
    const index = buildSearchIndex(content)
    expect(index.documents.some((entry) => entry.href === '/canonical')).toBe(
      true
    )
    expect(
      searchDocuments(index.documents, 'visual webgl particle')[0]
    ).toMatchObject({ href: '/project/canonical', kind: 'project' })
    expect(
      index.documents.some((entry) => entry.href.includes('old-project'))
    ).toBe(false)
    content.projectRoutes[b]!.active = false
    expect(
      buildSearchIndex(content).documents.some(
        (entry) => entry.kind === 'project'
      )
    ).toBe(false)
  })

  it('keeps the checked-in index in sync with the public snapshot', async () => {
    const content = await readSnapshot()
    expect(content).toBeDefined()
    const saved = JSON.parse(await readFile('public/search-index.json', 'utf8'))
    expect(saved).toEqual(buildSearchIndex(content!))
  })
})

describe('keyword ranking', () => {
  const document = (
    href: string,
    title: string,
    summary = '',
    body = ''
  ): SearchDocument => ({
    href,
    title,
    titleText: normalizeSearchText(title),
    summaryText: normalizeSearchText(summary),
    bodyTerms: normalizeSearchText(body)
  })

  it('prefers exact and prefix titles, then other titles, summaries, and body text', () => {
    const documents = [
      document('/body', 'Other', '', 'Search'),
      document('/summary', 'Another', 'Search'),
      document('/title', 'Premium Search'),
      document('/prefix', 'Search navigation'),
      document('/exact', 'Search')
    ]
    expect(
      searchDocuments(documents, 'search').map((result) => result.href)
    ).toEqual(['/exact', '/prefix', '/title', '/summary', '/body'])
  })

  it('matches case, punctuation, diacritics, partial words, and terms spread across fields', () => {
    const documents = [document('/cafe', 'Café Navigation', 'TypeScript')]
    expect(searchDocuments(documents, '  CAFE! navig typescr ')).toEqual(
      documents
    )
    expect(normalizeSearchText('你好 — Café')).toBe('你好 cafe')
    expect(searchDocuments(documents, 'cafe impossible')).toEqual([])
  })

  it('preserves recent-article ordering for ties and empty queries without mutating the index', () => {
    const documents = [
      document('/one', 'Search one'),
      document('/two', 'Search two')
    ]
    expect(searchDocuments(documents, 'search')).toEqual(documents)
    expect(searchDocuments(documents, ' ')).toBe(documents)
    expect(searchDocuments(documents, 'two')[0]!.href).toBe('/two')
    expect(documents[0]!.href).toBe('/one')
  })
})

describe('on-demand index loading', () => {
  const index: SearchIndex = { version: 1, documents: [] }

  it('does not fetch at import and shares the first request across openings', async () => {
    vi.resetModules()
    const fetchIndex = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(index))
    vi.stubGlobal('fetch', fetchIndex)
    const { loadSearchIndex } = await import('../lib/load-search-index')
    expect(fetchIndex).not.toHaveBeenCalled()
    const first = loadSearchIndex()
    expect(loadSearchIndex()).toBe(first)
    expect(await first).toEqual(index)
    expect(await loadSearchIndex()).toEqual(index)
    expect(fetchIndex).toHaveBeenCalledExactlyOnceWith('/search-index.json')
  })

  it('allows retry after fetch and schema-version failures', async () => {
    vi.resetModules()
    const fetchIndex = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ version: 2, documents: [] }))
      .mockResolvedValueOnce(Response.json(index))
    vi.stubGlobal('fetch', fetchIndex)
    const { loadSearchIndex } = await import('../lib/load-search-index')
    await expect(loadSearchIndex()).rejects.toThrow('Unable to load')
    await expect(loadSearchIndex()).rejects.toThrow('Unsupported')
    expect(await loadSearchIndex()).toEqual(index)
    expect(fetchIndex).toHaveBeenCalledTimes(3)
  })
})
