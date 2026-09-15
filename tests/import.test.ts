import { expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importArticles } from '../scripts/notion/import-articles'
import { publishSnapshot } from '../scripts/io'
import { sourceContract } from '../lib/site'
import type { Article, Snapshot } from '../lib/content/schema'
import type { NotionPage } from '../scripts/notion/source'

const a = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const b = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
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

it('keeps the complete previous snapshot when a later article fails after an upload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'personal-site-import-'))
  const path = join(directory, 'snapshot.json')
  const uploads: string[] = []
  try {
    await publishSnapshot(original, path)
    const before = await readFile(path, 'utf8')
    const run = async () => {
      const routes = {
        ...original.routes,
        [b]: { slug: 'new-article', aliases: [], active: true }
      }
      const articles = await importArticles({
        pages: [page(a), page(b)],
        previous: original.articles,
        routes,
        report: () => {},
        read: async (value) => {
          if (value.id === b) throw new Error('Required media failed')
          uploads.push('immutable-object')
          return {
            ...article,
            title: 'An update that must not be published yet'
          }
        }
      })
      await publishSnapshot({ ...original, articles, routes }, path)
    }
    await expect(run()).rejects.toThrow('Required media failed')
    expect(uploads).toEqual(['immutable-object'])
    expect(await readFile(path, 'utf8')).toBe(before)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
