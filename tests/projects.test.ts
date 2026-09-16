import { expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import {
  projectSchema,
  snapshotSchema,
  type Project
} from '../lib/content/schema'
import { resolveContentLinks } from '../lib/content/content-links'
import { validateSnapshot } from '../lib/content/references'
import {
  crossCollectionSlugWarnings,
  reconcileRoutes
} from '../lib/content/routes'
import { importPages } from '../scripts/notion/import-pages'
import { Normalizer } from '../scripts/notion/normalize'
import { NotionSourceClient, type NotionPage } from '../scripts/notion/source'

const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const other = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const project: Project = {
  id,
  title: 'Project',
  slug: 'demo',
  description: '',
  modified: '2026-01-01',
  featured: true,
  authors: [{ id: other, name: 'Creator' }],
  tags: [],
  blocks: [],
  source: 'https://example.com/chat',
  website: 'https://example.com'
}
const route = { slug: 'demo', active: true, aliases: [] }
const page: NotionPage = {
  id,
  object: 'page',
  parent: { type: 'data_source_id', data_source_id: other },
  properties: {},
  in_trash: false,
  last_edited_time: '2026-01-01'
}
const report = () => {}

it('shares cache, force, fast image recovery, and failure fallback with articles', async () => {
  const read = vi.fn<() => Promise<Project>>(async () => project)
  const options = {
    kind: 'project' as const,
    pages: [page],
    previous: { [id]: project },
    routes: { [id]: route },
    read,
    report
  }
  expect((await importPages(options))[id]).toEqual(project)
  expect(read).not.toHaveBeenCalled()
  const fast = await importPages({ ...options, force: true, fast: true })
  expect(fast[id]?.needsImageSync).toBe(true)
  read.mockClear()
  const normal = await importPages({ ...options, previous: fast })
  expect(read).toHaveBeenCalledOnce()
  expect(normal[id]?.needsImageSync).toBeUndefined()
  read.mockRejectedValue(new Error('offline'))
  expect((await importPages({ ...options, force: true }))[id]).toEqual(project)
})

it('removes private projects and scopes prune to project routes', async () => {
  const privateRoutes = reconcileRoutes(
    [{ id, title: 'Project', slug: 'demo', public: false }],
    { [id]: route }
  ).routes
  expect(
    await importPages({
      pages: [],
      previous: { [id]: project },
      routes: privateRoutes,
      read: async () => project,
      report
    })
  ).toEqual({})
  expect(reconcileRoutes([], { [id]: route }).routes[id]?.active).toBe(true)
  expect(
    reconcileRoutes([], { [id]: route }, { prune: true }).routes[id]?.active
  ).toBe(false)
  const changed = [{ id, title: 'Project', slug: 'new', public: true }]
  expect(reconcileRoutes(changed, { [id]: route }).routes[id]?.slug).toBe(
    'demo'
  )
  expect(
    reconcileRoutes(changed, { [id]: route }, { acceptSlugChanges: true })
      .routes[id]?.aliases
  ).toEqual(['demo'])
})

it('reports matching article slugs and aliases without rejecting separate collections', () => {
  const warnings = crossCollectionSlugWarnings(
    { [other]: { ...route, slug: 'old', aliases: ['demo'] } },
    { [id]: route }
  )
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('demo')
  expect(
    crossCollectionSlugWarnings(
      { [other]: { ...route, active: false } },
      { [id]: route }
    )
  ).toEqual([])
})

it('loads legacy snapshots and validates project publication and media references', async () => {
  const legacy = JSON.parse(await readFile('content/snapshot.json', 'utf8'))
  delete legacy.projects
  delete legacy.projectRoutes
  delete legacy.projectSource
  const snapshot = snapshotSchema.parse(legacy)
  expect(() => validateSnapshot(snapshot)).not.toThrow()
  snapshot.projects = { [id]: project }
  snapshot.projectRoutes = { [id]: route }
  expect(() => validateSnapshot(snapshot)).not.toThrow()
  snapshot.projects[id] = { ...project, cover: 'missing-cover' }
  expect(() => validateSnapshot(snapshot)).toThrow('Missing media')
  snapshot.projects[id] = project
  snapshot.projectRoutes[id] = { ...route, active: false }
  expect(() => validateSnapshot(snapshot)).toThrow('publication mismatch')
})

it('normalizes project people and structured links through the shared body reader', async () => {
  const api = new NotionSourceClient('fixture')
  const normalizer = new Normalizer(api, { [id]: route }, async () => 'cover')
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
  const properties = {
    Author: {
      id: 'author',
      type: 'people',
      people: [{ id: other, name: 'Creator' }]
    },
    Source: { id: 'source', type: 'url', url: project.source },
    Website: { id: 'website', type: 'url', url: project.website },
    Tweet: {
      id: 'tweet',
      type: 'rich_text',
      rich_text: [span('https://x.com/user/status/123')]
    }
  }
  const {
    authors: _authors,
    source: _source,
    website: _website,
    ...common
  } = project
  const body = vi.spyOn(normalizer, 'pageContent').mockResolvedValue(common)
  const result = await normalizer.project(
    { ...page, properties },
    Object.fromEntries(
      Object.entries(properties).map(([name, prop]) => [name, prop.id])
    )
  )
  expect(body).toHaveBeenCalledOnce()
  expect(result).toEqual({ ...project, tweet: 'https://x.com/user/status/123' })
  expect(
    projectSchema.safeParse({ ...result, source: 'javascript:alert(1)' })
      .success
  ).toBe(false)
})

it('resolves cached Notion project links when loading an existing snapshot', async () => {
  const snapshot = snapshotSchema.parse(
    JSON.parse(await readFile('content/snapshot.json', 'utf8'))
  )
  const target = Object.values(snapshot.projects ?? {})[0]!
  const article = Object.values(snapshot.articles)[0]!
  article.blocks = [
    {
      id,
      type: 'paragraph',
      color: 'default',
      children: [],
      richText: [
        {
          text: 'Project',
          href: 'https://app.notion.com/p/' + target.id,
          bold: false,
          italic: false,
          underline: false,
          strike: false,
          code: false,
          color: 'default'
        }
      ]
    }
  ]
  resolveContentLinks(snapshot)
  const block = article.blocks[0]!
  expect(block.type === 'paragraph' && block.richText[0]?.href).toBe(
    '/project/' + target.slug
  )
})
