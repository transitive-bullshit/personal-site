import { Client, LogLevel } from '@notionhq/client'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import { sourceContract } from '../../lib/site'
import { compactId } from '../../lib/content/routes'

export const API_VERSION = '2026-03-11'
const parentSchema = z
  .object({
    type: z.string(),
    page_id: z.string().optional(),
    database_id: z.string().optional(),
    data_source_id: z.string().optional()
  })
  .passthrough()
export const propertySchema = z
  .object({ id: z.string(), type: z.string() })
  .passthrough()
export const pageSchema = z.object({
  object: z.literal('page'),
  id: z.string().transform(compactId),
  parent: parentSchema,
  properties: z.record(z.string(), propertySchema),
  last_edited_time: z.string(),
  archived: z.boolean().optional(),
  in_trash: z.boolean(),
  cover: z.unknown().optional(),
  icon: z.unknown().optional()
})
export type NotionPage = z.infer<typeof pageSchema>
export const sourceSchema = z.object({
  id: z.string().transform(compactId),
  parent: parentSchema,
  database_parent: parentSchema.optional(),
  properties: z.record(
    z.string(),
    z
      .object({ id: z.string(), name: z.string().optional(), type: z.string() })
      .passthrough()
  )
})
export type NotionSource = z.infer<typeof sourceSchema>
export const blockResponseSchema = z
  .object({
    id: z.string().transform(compactId),
    type: z.string(),
    has_children: z.boolean(),
    last_edited_time: z.string(),
    archived: z.boolean().optional(),
    in_trash: z.boolean().optional()
  })
  .passthrough()
export type NotionBlock = z.infer<typeof blockResponseSchema>
const listSchema = z.object({
  results: z.array(z.unknown()),
  has_more: z.boolean(),
  next_cursor: z.string().nullable()
})
export const articleProperties = {
  Name: 'title',
  Public: 'checkbox',
  Featured: 'checkbox',
  Slug: 'rich_text',
  Description: 'rich_text',
  Author: 'rich_text',
  Tweet: 'rich_text',
  Published: 'date',
  'Last Updated': 'last_edited_time',
  Tags: 'multi_select'
} as const

export const projectProperties = {
  ...articleProperties,
  Author: 'people',
  Source: 'url',
  Website: 'url'
} as const

export class NotionSourceClient {
  private client: Client
  private queue: Promise<unknown> = Promise.resolve()
  requests = 0

  constructor(token: string) {
    this.client = new Client({
      auth: token,
      notionVersion: API_VERSION,
      timeoutMs: 30_000,
      logLevel: LogLevel.ERROR
    })
  }

  async request(
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    // One paced API stream avoids bursts across recursively traversed articles.
    const run = this.queue.then(async () => {
      await delay(340)
      this.requests++
      return this.client.request({
        path,
        method: body ? 'post' : 'get',
        body
      })
    })
    this.queue = run.catch(() => {})
    return run
  }

  async list(path: string, method: 'get' | 'post' = 'get') {
    const results: unknown[] = []
    let cursor: string | undefined
    const seen = new Set<string>()
    do {
      const page = listSchema.parse(
        await this.request(
          method === 'get'
            ? path +
                '?page_size=100' +
                (cursor ? '&start_cursor=' + encodeURIComponent(cursor) : '')
            : path,
          method === 'post'
            ? { page_size: 100, start_cursor: cursor }
            : undefined
        )
      )
      results.push(...page.results)
      if (!page.has_more) break
      if (!page.next_cursor || seen.has(page.next_cursor))
        throw new Error('Invalid pagination cursor at ' + path)
      cursor = page.next_cursor
      seen.add(cursor)
    } while (true)
    return results
  }

  async children(id: string) {
    return (await this.list('blocks/' + id + '/children'))
      .map((item) => blockResponseSchema.parse(item))
      .filter((block) => !block.archived && !block.in_trash)
  }

  async source(id: string) {
    return sourceSchema.parse(await this.request('data_sources/' + id))
  }

  async rows(id: string) {
    const rows = (await this.list('data_sources/' + id + '/query', 'post')).map(
      (row) => pageSchema.parse(row)
    )
    for (const row of rows) {
      if (compactId(row.parent.data_source_id ?? '') !== id)
        throw new Error('Page has unexpected data source: ' + row.id)
    }
    return rows.filter((row) => !row.archived && !row.in_trash)
  }

  async verify(
    previousIds?: Record<string, string>,
    contract: {
      workspaceId: string
      rootPageId: string
      databaseId: string
      dataSourceId: string
    } = sourceContract,
    expectedProperties: Record<string, string> = articleProperties
  ) {
    const identity = z
      .object({
        type: z.literal('bot'),
        bot: z.object({ workspace_id: z.string().transform(compactId) })
      })
      .parse(await this.request('users/me'))
    if (identity.bot.workspace_id !== contract.workspaceId)
      throw new Error('Notion token belongs to a different workspace')

    const root = pageSchema.parse(
      await this.request('pages/' + contract.rootPageId)
    )
    if (root.archived || root.in_trash)
      throw new Error('The configured root page is archived')
    const database = z
      .object({
        id: z.string().transform(compactId),
        parent: parentSchema,
        data_sources: z.array(z.object({ id: z.string().transform(compactId) }))
      })
      .parse(await this.request('databases/' + contract.databaseId))
    if (
      compactId(database.parent.page_id ?? '') !== contract.rootPageId ||
      !database.data_sources.some(({ id }) => id === contract.dataSourceId)
    ) {
      throw new Error(
        'Configured database is no longer beneath the root or its data source changed'
      )
    }
    const source = await this.source(contract.dataSourceId)
    if (compactId(source.parent.database_id ?? '') !== contract.databaseId)
      throw new Error('Unexpected source parent')
    const propertyIds: Record<string, string> = {}
    for (const [name, type] of Object.entries(expectedProperties)) {
      const prop = previousIds?.[name]
        ? Object.values(source.properties).find(
            (value) => value.id === previousIds[name]
          )
        : source.properties[name]
      if (!prop || prop.type !== type)
        throw new Error(`Expected ${name} property of type ${type}`)
      propertyIds[name] = prop.id
    }
    return { source, propertyIds }
  }

  async database(id: string) {
    return z
      .object({
        data_sources: z.array(
          z.object({ id: z.string().transform(compactId) })
        ),
        parent: parentSchema
      })
      .parse(await this.request('databases/' + id))
  }

  async fullProperty(pageId: string, property: z.infer<typeof propertySchema>) {
    const value = property[property.type]
    if (
      !['title', 'rich_text', 'relation', 'people'].includes(property.type) ||
      !Array.isArray(value) ||
      value.length < 25
    )
      return property
    const items = await this.list(
      'pages/' +
        pageId +
        '/properties/' +
        encodeURIComponent(decodeURIComponent(property.id))
    )
    return {
      ...property,
      [property.type]: items.map(
        (item) => z.record(z.string(), z.unknown()).parse(item)[property.type]
      )
    }
  }
}

export function propertyById(page: NotionPage, id: string) {
  const property = Object.values(page.properties).find(
    (value) => value.id === id
  )
  if (!property) throw new Error(`Missing property ${id} on page ${page.id}`)
  return property
}
