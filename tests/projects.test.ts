import { getProjectHeroVideo } from '../lib/content/project-hero'
import { expect, it, vi } from 'vitest'
import {
  projectSchema,
  snapshotSchema,
  type Project
} from '../lib/content/schema'
import {
  resolveContentLinks,
  unlinkUnpublishedPages
} from '../lib/content/content-links'
import { validateSnapshot } from '../lib/content/references'
import { crossCollectionSlugWarnings } from '../lib/content/routes'
import {
  contentFixture,
  articleId,
  projectId,
  paragraph,
  storedMedia
} from './fixtures/content'
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
  const legacy = contentFixture()
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

it('maps project people and structured links onto common page fields', async () => {
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
    Type: {
      id: 'type',
      type: 'select',
      select: { name: 'Video' } as { name: string } | null
    },
    Author: {
      id: 'author',
      type: 'people',
      people: [{ id: other, name: 'Creator' }]
    },
    Source: { id: 'source', type: 'url', url: project.source },
    Website: { id: 'website', type: 'url', url: project.website },
    YouTube: {
      id: 'youtube',
      type: 'url',
      url: 'https://youtu.be/demo' as string | null
    },
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
  expect(result).toEqual({
    ...project,
    type: 'Video',
    youtube: 'https://youtu.be/demo',
    tweet: 'https://x.com/user/status/123'
  })
  properties.YouTube.url = null
  expect(
    (
      await normalizer.project(
        { ...page, properties },
        Object.fromEntries(
          Object.entries(properties).map(([name, prop]) => [name, prop.id])
        )
      )
    ).youtube
  ).toBeUndefined()
  properties.YouTube.url = 'https://youtu.be/demo'
  properties.Type.select = null
  expect(
    (
      await normalizer.project(
        { ...page, properties },
        Object.fromEntries(
          Object.entries(properties).map(([name, prop]) => [name, prop.id])
        )
      )
    ).type
  ).toBeUndefined()
  expect(
    (
      await normalizer.project(
        { ...page, properties },
        Object.fromEntries(
          Object.entries(properties).map(([name, prop]) => [name, prop.id])
        )
      )
    ).youtube
  ).toBeUndefined()
  expect(
    projectSchema.safeParse({ ...result, source: 'javascript:alert(1)' })
      .success
  ).toBe(false)
  expect(
    projectSchema.safeParse({ ...result, youtube: 'javascript:alert(1)' })
      .success
  ).toBe(false)
})

it('rewrites cached Notion project links into the project namespace', () => {
  const snapshot = contentFixture()
  const source = snapshot.articles[articleId]!
  const target = snapshot.projects![projectId]!
  const block = paragraph('e'.repeat(32), 'Project')
  block.richText[0]!.href = 'https://app.notion.com/p/' + target.id
  source.blocks = [block]
  resolveContentLinks(snapshot)
  expect(block.richText[0]!.href).toBe('/projects/fixture-project')
})

it('resolves imported page links before validating a synced snapshot', () => {
  const snapshot = contentFixture()
  const published = paragraph('e'.repeat(32), 'Project')
  published.richText[0]!.href = '/p/' + projectId
  const unpublished = paragraph('f'.repeat(32), 'Draft')
  unpublished.richText[0]!.href = '/p/' + '9'.repeat(32)
  snapshot.articles[articleId]!.blocks = [published, unpublished]
  const warnings: string[] = []
  unlinkUnpublishedPages(resolveContentLinks(snapshot), (message) =>
    warnings.push(message)
  )
  expect(published.richText[0]!.href).toBe('/projects/fixture-project')
  expect(unpublished.richText[0]).not.toHaveProperty('href')
  expect(warnings).toHaveLength(1)
  expect(() => validateSnapshot(snapshot)).not.toThrow()
})

it('promotes the first top-level uploaded video for Video projects', () => {
  const snapshot = contentFixture()
  for (const key of ['first', 'second']) {
    const media = storedMedia(key)
    snapshot.media[key] = {
      ...media,
      variants: [],
      original: {
        ...media.original,
        mime: 'video/mp4',
        key: 'personal-site/media/' + '1'.repeat(64) + '.mp4',
        url:
          'https://assets.cultural-alignment.com/personal-site/media/' +
          '1'.repeat(64) +
          '.mp4'
      }
    }
  }
  const hero = {
    id: 'e'.repeat(32),
    type: 'video' as const,
    media: 'first',
    caption: [],
    children: []
  }
  const later = { ...hero, id: 'f'.repeat(32), media: 'second' }
  const saved = {
    ...project,
    type: 'Video',
    blocks: [
      paragraph('c'.repeat(32), 'Leading paragraph', [
        { ...later, id: '7'.repeat(32) }
      ]),
      hero,
      later
    ]
  }
  expect(getProjectHeroVideo(saved, snapshot)).toEqual(hero)
  for (const type of [undefined, 'Web app'])
    expect(getProjectHeroVideo({ ...saved, type }, snapshot)).toBeUndefined()
  expect(
    getProjectHeroVideo({ ...saved, blocks: [] }, snapshot)
  ).toBeUndefined()
  expect(getProjectHeroVideo(saved, { ...snapshot, media: {} })).toBeUndefined()
  expect(
    getProjectHeroVideo(
      {
        ...saved,
        blocks: [
          {
            ...hero,
            media: undefined,
            url: 'https://youtube.com/watch?v=demo'
          },
          hero
        ]
      },
      snapshot
    )
  ).toBeUndefined()
})
