import { z } from 'zod'
import type {
  Article,
  Block,
  MediaSource,
  RichText,
  RouteRecord
} from '../../lib/content/schema'
import { compactId, rewriteLink } from '../../lib/content/routes'
import { site, sourceContract } from '../../lib/site'
import {
  NotionSourceClient,
  propertyById,
  type NotionBlock,
  type NotionPage,
  type NotionSource,
  type propertySchema
} from './source'

const richResponseSchema = z
  .object({
    type: z.string(),
    plain_text: z.string(),
    href: z.string().nullable(),
    annotations: z.object({
      bold: z.boolean(),
      italic: z.boolean(),
      strikethrough: z.boolean(),
      underline: z.boolean(),
      code: z.boolean(),
      color: z.string()
    })
  })
  .passthrough()
export function richText(value: unknown): RichText[] {
  return z
    .array(richResponseSchema)
    .parse(value)
    .map((span) => ({
      text: span.plain_text,
      href: span.href ?? undefined,
      bold: span.annotations.bold,
      italic: span.annotations.italic,
      underline: span.annotations.underline,
      strike: span.annotations.strikethrough,
      code: span.annotations.code,
      color: span.annotations.color,
      equation: span.type === 'equation' ? true : undefined
    }))
}
export function plainText(value: unknown) {
  return richText(value)
    .map((part) => part.text)
    .join('')
}
export function plainSpan(text: string, href?: string): RichText {
  return {
    text,
    href,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    code: false,
    color: 'default'
  }
}
const richBodySchema = z
  .object({
    rich_text: z.array(richResponseSchema),
    color: z.string().optional()
  })
  .passthrough()
const fileSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('file'), file: z.object({ url: z.url() }) }),
  z.object({
    type: z.literal('external'),
    external: z.object({ url: z.url() })
  })
])
type ImportMedia = (
  source: MediaSource,
  url: string,
  refresh?: () => Promise<string>
) => Promise<string>

export class Normalizer {
  readonly blockCounts: Record<string, number> = {}
  readonly warnings: string[] = []
  constructor(
    readonly api: NotionSourceClient,
    readonly routes: Record<string, RouteRecord>,
    readonly importMedia: ImportMedia
  ) {}

  text(value: unknown) {
    return richText(value).map((span) => ({
      ...span,
      href: span.href
        ? rewriteLink(span.href, this.routes, sourceContract.rootPageId)
        : undefined
    }))
  }

  async file(
    value: unknown,
    key: string,
    edited: string,
    refreshValue?: () => Promise<unknown>
  ) {
    const file = fileSchema.parse(value)
    const url = file.type === 'file' ? file.file.url : file.external.url
    return this.importMedia(
      {
        key,
        edited,
        kind: file.type,
        url: file.type === 'external' ? url : undefined
      },
      url,
      refreshValue
        ? async () => {
            const fresh = fileSchema.parse(await refreshValue())
            return fresh.type === 'file' ? fresh.file.url : fresh.external.url
          }
        : undefined
    )
  }

  async icon(
    value: unknown,
    key: string,
    edited: string
  ): Promise<Article['icon']> {
    if (!value) return undefined
    const icon = z.object({ type: z.string() }).passthrough().parse(value)
    if (icon.type === 'emoji')
      return { type: 'emoji', value: z.string().parse(icon.emoji) }
    if (icon.type === 'custom_emoji') {
      const custom = z.object({ url: z.url() }).parse(icon.custom_emoji)
      return {
        type: 'image',
        media: await this.file(
          { type: 'external', external: { url: custom.url } },
          key,
          edited
        )
      }
    }
    return { type: 'image', media: await this.file(value, key, edited) }
  }

  async article(
    page: NotionPage,
    propertyIds: Record<string, string>
  ): Promise<Article> {
    const prop = (name: string) => propertyById(page, propertyIds[name]!)
    const rich = async (name: string) => {
      const property = await this.api.fullProperty(page.id, prop(name))
      return plainText(property[property.type])
    }
    const title = await rich('Name')
    const description = await rich('Description')
    const author = await rich('Author')
    const date = z
      .object({ start: z.string() })
      .nullable()
      .parse(prop('Published').date)
    if (!date)
      throw new Error('Published article has no Published date: ' + page.id)
    const blocks = await this.blocks(page.id)
    return {
      id: page.id,
      title,
      slug: this.routes[page.id]!.slug,
      description,
      published: date.start,
      modified: page.last_edited_time,
      author: author || site.author,
      tags: z
        .array(z.object({ name: z.string() }))
        .parse(prop('Tags').multi_select)
        .map(({ name }) => name),
      featured: z.boolean().parse(prop('Featured').checkbox),
      cover: page.cover
        ? await this.file(
            page.cover,
            page.id + ':cover',
            page.last_edited_time,
            async () =>
              z
                .object({ cover: z.unknown() })
                .parse(await this.api.request('pages/' + page.id)).cover
          )
        : undefined,
      icon: page.icon
        ? await this.icon(page.icon, page.id + ':icon', page.last_edited_time)
        : undefined,
      blocks
    }
  }

  async blocks(
    parent: string,
    ancestors = new Set<string>()
  ): Promise<Block[]> {
    if (ancestors.has(parent))
      throw new Error('Cyclic block reference: ' + parent)
    const next = new Set([...ancestors, parent])
    const result: Block[] = []
    for (const block of await this.api.children(parent)) {
      try {
        const normalized = await this.block(block, next)
        if (normalized) result.push(normalized)
      } catch (err) {
        throw new Error(
          `Block ${block.id} (${block.type}): ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
    return result
  }

  async block(
    block: NotionBlock,
    ancestors: Set<string>
  ): Promise<Block | undefined> {
    this.blockCounts[block.type] = (this.blockCounts[block.type] ?? 0) + 1
    if (block.type === 'child_page') {
      this.warnings.push('Excluded child page ' + block.id)
      return undefined
    }
    const data = z.record(z.string(), z.unknown()).parse(block[block.type])
    const base = { id: block.id, children: [] as Block[] }
    if (block.type === 'child_database')
      return { ...base, ...(await this.databaseTable(block.id)) }
    if (block.type === 'table') {
      const rows = await this.api.children(block.id)
      const width = z.number().int().positive().parse(data.table_width)
      const cells = rows.map((row) => {
        if (row.type !== 'table_row')
          throw new Error('Unexpected child of table')
        const values = z
          .object({ cells: z.array(z.unknown()) })
          .parse(row.table_row)
          .cells.map((cell) => this.text(cell))
        if (values.length !== width) throw new Error('Table row width mismatch')
        return values
      })
      return {
        ...base,
        type: 'table',
        columns: Array.from({ length: width }, () => ''),
        rows: cells,
        columnHeader: z.boolean().parse(data.has_column_header),
        rowHeader: z.boolean().parse(data.has_row_header)
      }
    }
    if (block.type === 'synced_block') {
      const synced = z
        .object({ synced_from: z.object({ block_id: z.string() }).nullable() })
        .parse(data)
      return {
        ...base,
        type: 'synced_block',
        children: await this.blocks(
          compactId(synced.synced_from?.block_id ?? block.id),
          ancestors
        )
      }
    }
    const children = block.has_children
      ? await this.blocks(block.id, ancestors)
      : []
    const withChildren = { ...base, children }
    if (
      [
        'paragraph',
        'bulleted_list_item',
        'numbered_list_item',
        'quote',
        'toggle',
        'to_do',
        'callout',
        'code',
        'heading_1',
        'heading_2',
        'heading_3'
      ].includes(block.type)
    ) {
      const body = richBodySchema.parse(data)
      const text = {
        richText: this.text(body.rich_text),
        color: body.color ?? 'default'
      }
      switch (block.type) {
        case 'heading_1':
          return { ...withChildren, ...text, type: 'heading', level: 1 }
        case 'heading_2':
          return { ...withChildren, ...text, type: 'heading', level: 2 }
        case 'heading_3':
          return { ...withChildren, ...text, type: 'heading', level: 3 }
        case 'to_do':
          return {
            ...withChildren,
            ...text,
            type: 'to_do',
            checked: z.boolean().parse(data.checked)
          }
        case 'callout':
          return {
            ...withChildren,
            ...text,
            type: 'callout',
            icon: data.icon
              ? await this.icon(
                  data.icon,
                  block.id + ':icon',
                  block.last_edited_time
                )
              : undefined
          }
        case 'code':
          return {
            ...withChildren,
            ...text,
            type: 'code',
            language: z.string().parse(data.language),
            caption: this.text(data.caption ?? [])
          }
        case 'paragraph':
        case 'bulleted_list_item':
        case 'numbered_list_item':
        case 'quote':
        case 'toggle':
          return { ...withChildren, ...text, type: block.type }
      }
    }
    if (['image', 'video', 'audio', 'file', 'pdf'].includes(block.type)) {
      const caption = this.text(data.caption ?? [])
      if (block.type === 'video' && data.type === 'external') {
        const external = z.object({ url: z.url() }).parse(data.external)
        const host = new URL(external.url).hostname
        if (
          [
            'youtube.com',
            'www.youtube.com',
            'youtu.be',
            'vimeo.com',
            'www.vimeo.com'
          ].includes(host)
        ) {
          return { ...withChildren, type: 'video', url: external.url, caption }
        }
      }
      const media = await this.file(
        data,
        block.id,
        block.last_edited_time,
        async () => {
          const fresh = z
            .record(z.string(), z.unknown())
            .parse(await this.api.request('blocks/' + block.id))
          return fresh[block.type]
        }
      )
      if (block.type === 'file' || block.type === 'pdf')
        return {
          ...withChildren,
          type: 'file',
          media,
          name: z.string().parse(data.name ?? 'Download attachment'),
          caption
        }
      if (block.type === 'image')
        return { ...withChildren, type: 'image', media, caption }
      if (block.type === 'video')
        return { ...withChildren, type: 'video', media, caption }
      return { ...withChildren, type: 'audio', media, caption }
    }
    if (
      block.type === 'bookmark' ||
      block.type === 'embed' ||
      block.type === 'link_preview'
    ) {
      const url = z.url().parse(data.url)
      const caption = this.text(data.caption ?? [])
      if (block.type === 'bookmark')
        return { ...withChildren, type: 'bookmark', url, caption }
      const parsed = new URL(url)
      const tweetId = [
        'twitter.com',
        'www.twitter.com',
        'x.com',
        'www.x.com',
        'mobile.twitter.com'
      ].includes(parsed.hostname)
        ? parsed.pathname.match(/\/status\/(\d+)/)?.[1]
        : undefined
      return {
        ...withChildren,
        type: 'embed',
        url,
        caption,
        tweetId
      }
    }
    if (block.type === 'link_to_page') {
      const link = z
        .object({ type: z.literal('page_id'), page_id: z.string() })
        .parse(data)
      const url = rewriteLink(
        'https://www.notion.so/' + compactId(link.page_id),
        this.routes,
        sourceContract.rootPageId
      )
      return {
        ...withChildren,
        type: 'paragraph',
        richText: [
          plainSpan(
            this.routes[compactId(link.page_id)]?.slug ?? 'Linked page',
            url
          )
        ],
        color: 'default'
      }
    }
    if (block.type === 'equation')
      return {
        ...withChildren,
        type: 'equation',
        expression: z.string().parse(data.expression)
      }
    switch (block.type) {
      case 'divider':
      case 'table_of_contents':
      case 'column_list':
      case 'column':
        return { ...withChildren, type: block.type }
    }
    throw new Error('Unsupported Notion block type: ' + block.type)
  }

  async databaseTable(id: string) {
    const database = await this.api.database(id)
    if (database.data_sources.length !== 1)
      throw new Error('Inline database must contain exactly one data source')
    const sourceId = database.data_sources[0]!.id
    const source = await this.api.source(sourceId)
    const columns = Object.entries(source.properties).sort(
      ([a, av], [b, bv]) => {
        if (av.type === 'title') return -1
        if (bv.type === 'title') return 1
        return a.localeCompare(b, 'en')
      }
    )
    const pages = await this.api.rows(sourceId)
    const rows = []
    for (const page of pages) {
      const cells = []
      for (const [, column] of columns)
        cells.push(await this.cell(page, column))
      rows.push({ id: page.id, cells })
    }
    rows.sort(
      (a, b) =>
        a.cells[0]!.map((s) => s.text)
          .join('')
          .localeCompare(b.cells[0]!.map((s) => s.text).join(''), 'en') ||
        a.id.localeCompare(b.id)
    )
    return {
      type: 'table' as const,
      columns: columns.map(([name]) => name),
      rows: rows.map(({ cells }) => cells),
      columnHeader: true,
      rowHeader: false
    }
  }

  async cell(
    page: NotionPage,
    column: NotionSource['properties'][string]
  ): Promise<RichText[]> {
    const property = await this.api.fullProperty(
      page.id,
      propertyById(page, column.id)
    )
    return this.propertyCell(property)
  }

  propertyCell(property: z.infer<typeof propertySchema>): RichText[] {
    const value = property[property.type]
    if (property.type === 'title' || property.type === 'rich_text')
      return this.text(value)
    if (value === null) return []
    switch (property.type) {
      case 'number':
        return [plainSpan(String(z.number().parse(value)))]
      case 'checkbox':
        return [plainSpan(z.boolean().parse(value) ? 'Yes' : 'No')]
      case 'url': {
        const url = z.url().parse(value)
        return [
          plainSpan(
            url.replace(/^https?:\/\//, ''),
            rewriteLink(url, this.routes, sourceContract.rootPageId)
          )
        ]
      }
      case 'email':
        return [
          plainSpan(
            z.string().parse(value),
            'mailto:' + z.string().parse(value)
          )
        ]
      case 'phone_number':
        return [plainSpan(z.string().parse(value))]
      case 'select':
      case 'status':
        return [plainSpan(z.object({ name: z.string() }).parse(value).name)]
      case 'multi_select':
        return [
          plainSpan(
            z
              .array(z.object({ name: z.string() }))
              .parse(value)
              .map((v) => v.name)
              .join(', ')
          )
        ]
      case 'date': {
        const date = z
          .object({ start: z.string(), end: z.string().nullable() })
          .parse(value)
        return [plainSpan(date.start + (date.end ? ' – ' + date.end : ''))]
      }
      case 'created_time':
      case 'last_edited_time':
        return [plainSpan(z.string().parse(value))]
      case 'formula': {
        const formula = z
          .object({ type: z.string() })
          .passthrough()
          .parse(value)
        return this.propertyCell({ ...formula, id: property.id })
      }
      default:
        throw new Error(
          'Unsupported inline table property type: ' + property.type
        )
    }
  }
}
