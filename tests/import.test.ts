import { expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importPages } from '../scripts/notion/import-pages'
import { publishSnapshot } from '../scripts/io'
import { sourceContract } from '../lib/site'
import type { Article, Snapshot } from '../lib/content/schema'
import type { NotionPage } from '../scripts/notion/source'
import { project, projectId, contentFixture } from './fixtures/content'

const a = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const b = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const c = 'cccccccccccccccccccccccccccccccc'
const article: Article = {
  id: a,
  title: 'Saved article',
  slug: 'saved-article',
  description: '',
  author: 'Travis Fischer',
  published: '2024-01-01',
  modified: '2024-01-01',
  featured: false,
  tags: [],
  blocks: []
}
const original: Snapshot = {
  schemaVersion: 1,
  importerVersion: 1,
  source: { ...sourceContract, apiVersion: '2026-03-11', propertyIds: {} },
  articles: { [a]: article },
  routes: { [a]: { slug: article.slug, aliases: [], active: true } },
  media: {},
  tweets: {}
}
const page = (id: string): NotionPage => ({
  id,
  object: 'page',
  parent: {
    type: 'data_source_id',
    data_source_id: sourceContract.dataSourceId
  },
  properties: {},
  last_edited_time: '',
  in_trash: false
})

it('publishes successful articles while retaining or skipping failed ones', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'personal-site-import-'))
  const path = join(directory, 'snapshot.json')
  const warnings: string[] = []
  try {
    await publishSnapshot(original, path)
    const run = async () => {
      const routes = {
        ...original.routes,
        [b]: { slug: 'new-article', aliases: [], active: true },
        [c]: { slug: 'broken-article', aliases: [], active: true }
      }
      const articles = await importPages({
        pages: [page(a), page(b), page(c)],
        previous: original.articles,
        routes,
        report: () => {},
        warn: (message) => warnings.push(message),
        read: async (value) => {
          if (value.id === a) throw new Error('Article unavailable')
          if (value.id === c) throw new Error('Required media failed')
          return {
            ...article,
            id: b,
            slug: 'new-article',
            title: 'New article'
          }
        }
      })
      await publishSnapshot({ ...original, articles, routes }, path)
    }
    await expect(run()).resolves.toBeUndefined()
    const published = JSON.parse(await readFile(path, 'utf8')) as Snapshot
    expect(published.articles[a]).toEqual(article)
    expect(published.articles[b]?.title).toBe('New article')
    expect(published.articles[c]).toBeUndefined()
    expect(published.routes[c]?.active).toBe(false)
    expect(warnings.sort()).toEqual([
      '/broken-article: Required media failed; skipping the new article',
      '/saved-article: Article unavailable; keeping the previous version'
    ])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

it('reuses an unchanged article without reading its properties or blocks', async () => {
  const unchanged = { ...page(a), last_edited_time: '2023-12-31T00:00:00.000Z' }
  const read = vi.fn<(page: NotionPage) => Promise<Article>>(async () => ({
    ...article,
    title: 'Refreshed article'
  }))
  const report = vi.fn<(message: string) => void>()
  const cached = await importPages({
    pages: [unchanged],
    previous: original.articles,
    routes: structuredClone(original.routes),
    read,
    report
  })

  expect(cached[a]).toEqual(article)
  expect(read).not.toHaveBeenCalled()
  expect(report).toHaveBeenCalledWith('[1/1] /saved-article (unchanged)')

  const refreshed = await importPages({
    pages: [unchanged],
    previous: original.articles,
    routes: structuredClone(original.routes),
    force: true,
    read,
    report: () => {}
  })
  expect(refreshed[a]?.title).toBe('Refreshed article')
  expect(read).toHaveBeenCalledTimes(1)
})

it('revisits articles changed during a fast sync on the next normal sync', async () => {
  const changed = { ...page(a), last_edited_time: '2025-01-01T00:00:00.000Z' }
  const read = vi.fn<(page: NotionPage) => Promise<Article>>(async (value) => ({
    ...article,
    modified: value.last_edited_time
  }))
  const fast = await importPages({
    pages: [changed],
    previous: original.articles,
    routes: structuredClone(original.routes),
    fast: true,
    read,
    report: () => {}
  })
  expect(fast[a]?.needsImageSync).toBe(true)

  read.mockClear()
  const completed = await importPages({
    pages: [changed],
    previous: fast,
    routes: structuredClone(original.routes),
    read,
    report: () => {}
  })
  expect(read).toHaveBeenCalledTimes(1)
  expect(completed[a]?.needsImageSync).toBeUndefined()
})

it('imports up to eight articles concurrently', async () => {
  const pages = Array.from({ length: 16 }, (_, index) =>
    page(index.toString(16).padStart(32, '0'))
  )
  const routes = Object.fromEntries(
    pages.map((value, index) => [
      value.id,
      { slug: `article-${index}`, aliases: [], active: true }
    ])
  )
  let active = 0
  let maximumActive = 0
  let started = 0
  let releaseFirstBatch: () => void = () => {}
  const firstBatch = new Promise<void>((resolve) => {
    releaseFirstBatch = resolve
  })

  const result = importPages({
    pages,
    previous: {},
    routes,
    report: () => {},
    read: async (value) => {
      active++
      started++
      maximumActive = Math.max(maximumActive, active)
      if (started <= 8) await firstBatch
      active--
      return { ...article, id: value.id, slug: routes[value.id]!.slug }
    }
  })

  try {
    await vi.waitFor(() => expect(started).toBe(8))
    expect(active).toBe(8)
  } finally {
    releaseFirstBatch()
    await result
  }

  await expect(result).resolves.toHaveProperty(pages[15]!.id)
  expect(maximumActive).toBe(8)
})

it('removes inactive saved entries and reports project fallback paths', async () => {
  const snapshot = contentFixture()
  const read = vi
    .fn<() => Promise<typeof project>>()
    .mockRejectedValue(new Error('offline'))
  const warn = vi.fn<(message: string) => void>()
  const routes: Snapshot['routes'] = {
    ...snapshot.projectRoutes!,
    [c]: { slug: 'new-project', active: true, aliases: [] }
  }
  const result = await importPages({
    kind: 'project',
    pages: [page(projectId), page(c)],
    previous: snapshot.projects!,
    routes,
    force: true,
    read,
    report: () => {},
    warn
  })
  expect(result).toEqual({ [projectId]: project })
  expect(routes[c]!.active).toBe(false)
  expect(warn.mock.calls.flat()).toEqual([
    '/projects/fixture-project: offline; keeping the previous version',
    '/projects/new-project: offline; skipping the new project'
  ])
  routes[projectId]!.active = false
  read.mockClear()
  expect(
    await importPages({
      kind: 'project',
      pages: [],
      previous: result,
      routes,
      read,
      report: () => {}
    })
  ).toEqual({})
  expect(read).not.toHaveBeenCalled()
})
