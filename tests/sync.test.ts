import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterEach,
  beforeEach,
  expect,
  it,
  vi,
  type MockInstance
} from 'vitest'
import { main } from '../scripts/sync'
import { loadEnv, publishSnapshot, readSnapshot } from '../scripts/io'
import { publishSearchIndex } from '../scripts/search-index'
import { MediaCache } from '../scripts/media/cache'
import { MediaStorage } from '../scripts/media/storage'
import { NotionSourceClient, type NotionPage } from '../scripts/notion/source'
import { sourceContract, projectSourceContract } from '../lib/site'
import {
  contentFixture,
  articleId,
  projectId,
  paragraph,
  storedMedia
} from './fixtures/content'
import type { Snapshot } from '../lib/content/schema'

// Filesystem destinations and credentials are isolated; normalization, importing,
// reference validation, and atomic publication stay real.
vi.mock('../scripts/io', async (original) => ({
  ...(await original<typeof import('../scripts/io')>()),
  loadEnv: vi.fn<typeof import('../scripts/io').loadEnv>(),
  readSnapshot: vi.fn<typeof import('../scripts/io').readSnapshot>(),
  publishSnapshot: vi.fn<typeof import('../scripts/io').publishSnapshot>()
}))
vi.mock('../scripts/search-index', async (original) => ({
  ...(await original<typeof import('../scripts/search-index')>()),
  publishSearchIndex:
    vi.fn<typeof import('../scripts/search-index').publishSearchIndex>()
}))

let rows: MockInstance<NotionSourceClient['rows']>
let children: MockInstance<NotionSourceClient['children']>
let directory: string
let snapshotPath: string
let previous: Snapshot
let argv: string[]
let exitCode: typeof process.exitCode
const propertyIds = Object.fromEntries(
  [
    'Name',
    'Slug',
    'Public',
    'Featured',
    'Description',
    'Author',
    'Tweet',
    'Published',
    'Tags',
    'Type',
    'Source',
    'Website',
    'YouTube'
  ].map((name) => [name, name])
)
function span(text: string) {
  return {
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
  }
}
function row(id: string, slug: string, isPublic = true): NotionPage {
  return {
    id,
    object: 'page',
    parent: {
      type: 'data_source_id',
      data_source_id: projectSourceContract.dataSourceId
    },
    last_edited_time: '2026-10-01',
    in_trash: false,
    properties: {
      Name: { id: 'Name', type: 'title', title: [span('Imported project')] },
      Slug: { id: 'Slug', type: 'rich_text', rich_text: [span(slug)] },
      Public: { id: 'Public', type: 'checkbox', checkbox: isPublic },
      Featured: { id: 'Featured', type: 'checkbox', checkbox: true },
      Description: {
        id: 'Description',
        type: 'rich_text',
        rich_text: [span('Imported description')]
      },
      Author: {
        id: 'Author',
        type: 'people',
        people: [{ id: articleId, name: 'Creator' }]
      },
      Tweet: { id: 'Tweet', type: 'rich_text', rich_text: [] },
      Published: { id: 'Published', type: 'date', date: null },
      Tags: {
        id: 'Tags',
        type: 'multi_select',
        multi_select: [{ name: 'Demo' }]
      },
      Type: { id: 'Type', type: 'select', select: { name: 'Web app' } },
      Source: {
        id: 'Source',
        type: 'url',
        url: 'https://github.com/fixture/project'
      },
      Website: { id: 'Website', type: 'url', url: 'https://example.com' },
      YouTube: { id: 'YouTube', type: 'url', url: null }
    }
  }
}

beforeEach(async () => {
  argv = process.argv
  exitCode = process.exitCode
  process.argv = [
    process.execPath,
    'scripts/sync.ts',
    '--only',
    'projects',
    '--force',
    '--prune'
  ]
  directory = await mkdtemp(join(tmpdir(), 'personal-site-sync-'))
  snapshotPath = join(directory, 'snapshot.json')
  previous = contentFixture()
  const io =
    await vi.importActual<typeof import('../scripts/io')>('../scripts/io')
  await io.publishSnapshot(previous, snapshotPath)
  vi.mocked(loadEnv).mockResolvedValue(undefined)
  vi.mocked(readSnapshot).mockImplementation(() =>
    io.readSnapshot(snapshotPath)
  )
  vi.mocked(publishSnapshot).mockImplementation((snapshot) =>
    io.publishSnapshot(snapshot, snapshotPath)
  )
  const search = await vi.importActual<
    typeof import('../scripts/search-index')
  >('../scripts/search-index')
  vi.mocked(publishSearchIndex).mockImplementation((snapshot) =>
    search.publishSearchIndex(snapshot, join(directory, 'search-index.json'))
  )
  vi.stubEnv('NOTION_TOKEN', 'fixture')
  for (const [key, value] of Object.entries({
    S3_API_ENDPOINT: 'https://storage.example.com',
    S3_PUBLIC_URL: 'https://assets.example.com',
    S3_BUCKET_NAME: 'fixture',
    S3_ACCESS_KEY_ID: 'fixture',
    S3_SECRET_ACCESS_KEY: 'fixture'
  }))
    vi.stubEnv(key, value)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(MediaStorage.prototype, 'exists').mockResolvedValue(true)
  const open = MediaCache.open.bind(MediaCache)
  vi.spyOn(MediaCache, 'open').mockImplementation(() =>
    open(join(directory, 'media-cache.json'))
  )
  vi.spyOn(NotionSourceClient.prototype, 'verify').mockResolvedValue({
    propertyIds,
    source: {
      id: projectSourceContract.dataSourceId,
      parent: {
        type: 'database_id',
        database_id: projectSourceContract.databaseId
      },
      properties: {}
    }
  })
  rows = vi.spyOn(NotionSourceClient.prototype, 'rows').mockResolvedValue([])
  children = vi
    .spyOn(NotionSourceClient.prototype, 'children')
    .mockResolvedValue([])
})
afterEach(async () => {
  process.argv = argv
  process.exitCode = exitCode
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

it('imports public project bodies, excludes private bodies, and prunes only the selected collection', async () => {
  const privateId = 'e'.repeat(32)
  previous.projects![privateId] = {
    ...previous.projects![projectId]!,
    id: privateId,
    slug: 'private-project',
    blocks: []
  }
  previous.projectRoutes![privateId] = {
    slug: 'private-project',
    active: true,
    aliases: []
  }
  const missingId = '8'.repeat(32)
  previous.projects![missingId] = {
    ...previous.projects![projectId]!,
    id: missingId,
    slug: 'missing-project',
    blocks: []
  }
  previous.projectRoutes![missingId] = {
    slug: 'missing-project',
    active: true,
    aliases: []
  }
  previous.articles[articleId]!.cover = 'cover'
  previous.media.cover = storedMedia()
  previous.routes[articleId]!.aliases = ['saved-article-alias']
  const io =
    await vi.importActual<typeof import('../scripts/io')>('../scripts/io')
  await io.publishSnapshot(previous, snapshotPath)
  rows.mockResolvedValue([
    row(projectId, 'fixture-project'),
    row(privateId, 'private-project', false)
  ])
  const block = paragraph('f'.repeat(32), 'Imported body')
  children.mockResolvedValue([
    {
      id: block.id,
      type: 'paragraph',
      has_children: false,
      last_edited_time: '2026-10-01',
      paragraph: { rich_text: [span('Imported body')], color: 'default' }
    }
  ])
  await main()
  const saved = JSON.parse(await readFile(snapshotPath, 'utf8')) as Snapshot
  expect(saved.articles).toEqual(previous.articles)
  expect(saved.routes).toEqual(previous.routes)
  expect(saved.projects).toEqual({
    [projectId]: {
      id: projectId,
      slug: 'fixture-project',
      title: 'Imported project',
      description: 'Imported description',
      modified: '2026-10-01',
      featured: true,
      tags: ['Demo'],
      authors: [{ id: articleId, name: 'Creator' }],
      type: 'Web app',
      source: 'https://github.com/fixture/project',
      website: 'https://example.com',
      blocks: [block]
    }
  })
  expect(saved.projectRoutes![privateId]!.active).toBe(false)
  expect(saved.projectRoutes![missingId]!.active).toBe(false)
  expect(saved.media).toEqual(previous.media)
  expect(rows).toHaveBeenCalledExactlyOnceWith(
    projectSourceContract.dataSourceId
  )
  expect(children).toHaveBeenCalledExactlyOnceWith(projectId)
})

it('stops before publication if either selected collection cannot be discovered', async () => {
  process.argv = [process.execPath, 'scripts/sync.ts', '--prune']
  const before = await readFile(snapshotPath, 'utf8')
  rows.mockImplementation(async (id) => {
    if (id === sourceContract.dataSourceId)
      throw new Error('Article discovery failed')
    return []
  })
  await expect(main()).rejects.toThrow('Article discovery failed')
  expect(publishSnapshot).not.toHaveBeenCalled()
  expect(publishSearchIndex).not.toHaveBeenCalled()
  expect(children).not.toHaveBeenCalled()
  expect(await readFile(snapshotPath, 'utf8')).toBe(before)
})

it.each(['download', 'inspection'])(
  'retains saved content and skips new content after a real media %s failure',
  async (failure) => {
    const newId = 'e'.repeat(32)
    rows.mockResolvedValue([
      row(projectId, 'fixture-project'),
      row(newId, 'new-project')
    ])
    children.mockImplementation(async (id) => [
      {
        id: id === projectId ? 'f'.repeat(32) : '9'.repeat(32),
        type: 'video',
        has_children: false,
        last_edited_time: '2026-10-01',
        video: {
          type: 'file',
          file: { url: 'https://example.com/invalid.mp4' },
          caption: []
        }
      }
    ])
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response('invalid video', {
          status: failure === 'download' ? 404 : 200,
          headers: { 'content-type': 'video/mp4' }
        })
    )
    vi.stubGlobal('fetch', fetcher)
    await main()
    const saved = JSON.parse(await readFile(snapshotPath, 'utf8')) as Snapshot
    expect(saved.projects).toEqual(previous.projects)
    expect(saved.projectRoutes![newId]!.active).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(2)
    const reason =
      failure === 'download'
        ? 'Media download returned HTTP 404'
        : 'Unable to inspect video'
    expect(vi.mocked(console.warn).mock.calls.flat().join('\n')).toContain(
      reason
    )
    expect(process.exitCode).toBe(1)
    expect(publishSnapshot).toHaveBeenCalledOnce()
  }
)

it('prunes articles while preserving projects when only articles are selected', async () => {
  process.argv = [
    process.execPath,
    'scripts/sync.ts',
    '--only',
    'articles',
    '--prune'
  ]
  await main()
  const saved = JSON.parse(await readFile(snapshotPath, 'utf8')) as Snapshot
  expect(saved.articles).toEqual({})
  expect(saved.routes[articleId]!.active).toBe(false)
  expect(saved.projects).toEqual(previous.projects)
  expect(saved.projectRoutes).toEqual(previous.projectRoutes)
  expect(rows).toHaveBeenCalledExactlyOnceWith(sourceContract.dataSourceId)
  expect(children).not.toHaveBeenCalled()
})

it('publishes acceptable bookmark failures without failing sync and does not fetch them again', async () => {
  const url = 'https://93.184.216.34/deleted-bookmark'
  rows.mockResolvedValue([row(projectId, 'fixture-project')])
  children.mockResolvedValue([
    {
      id: 'f'.repeat(32),
      type: 'bookmark',
      has_children: false,
      last_edited_time: '2026-10-01',
      bookmark: { url, caption: [] }
    }
  ])
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('Gone', { status: 410 }))
  vi.stubGlobal('fetch', fetcher)
  process.exitCode = undefined
  await main()
  const saved = JSON.parse(await readFile(snapshotPath, 'utf8')) as Snapshot
  expect(saved.bookmarks?.[url]?.failure).toEqual({
    stage: 'metadata',
    reason: 'HTTP 410'
  })
  expect(process.exitCode).toBeUndefined()
  expect(fetcher).toHaveBeenCalledOnce()
  process.argv = process.argv.filter((arg) => arg !== '--force')
  await main()
  expect(fetcher).toHaveBeenCalledOnce()
  expect(process.exitCode).toBeUndefined()
})
