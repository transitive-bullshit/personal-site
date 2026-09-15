import { z } from 'zod'

export const idSchema = z.string().regex(/^[a-f0-9]{32}$/)
export const httpUrlSchema = z.url().refine((value) => {
  const url = new URL(value)
  return (
    ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  )
})
export const richTextSchema = z.object({
  text: z.string(),
  href: z.string().optional(),
  bold: z.boolean(),
  italic: z.boolean(),
  underline: z.boolean(),
  strike: z.boolean(),
  code: z.boolean(),
  color: z.string(),
  equation: z.boolean().optional()
})
export type RichText = z.infer<typeof richTextSchema>
export const iconSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('emoji'), value: z.string() }),
  z.object({ type: z.literal('image'), media: z.string() })
])
const text = { richText: z.array(richTextSchema), color: z.string() }
const caption = { caption: z.array(richTextSchema) }
const bodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), ...text }),
  z.object({
    type: z.literal('heading'),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    ...text
  }),
  z.object({ type: z.literal('bulleted_list_item'), ...text }),
  z.object({ type: z.literal('numbered_list_item'), ...text }),
  z.object({ type: z.literal('to_do'), checked: z.boolean(), ...text }),
  z.object({ type: z.literal('quote'), ...text }),
  z.object({ type: z.literal('toggle'), ...text }),
  z.object({
    type: z.literal('callout'),
    icon: iconSchema.optional(),
    ...text
  }),
  z.object({
    type: z.literal('code'),
    language: z.string(),
    ...text,
    ...caption
  }),
  z.object({ type: z.literal('image'), media: z.string(), ...caption }),
  z.object({
    type: z.literal('file'),
    media: z.string(),
    name: z.string(),
    ...caption
  }),
  z.object({
    type: z.literal('video'),
    url: httpUrlSchema.optional(),
    media: z.string().optional(),
    ...caption
  }),
  z.object({ type: z.literal('audio'), media: z.string(), ...caption }),
  z.object({
    type: z.literal('embed'),
    url: httpUrlSchema,
    tweetId: z.string().optional(),
    ...caption
  }),
  z.object({ type: z.literal('bookmark'), url: httpUrlSchema, ...caption }),
  z.object({
    type: z.literal('table'),
    columns: z.array(z.string()),
    rows: z.array(z.array(z.array(richTextSchema))),
    columnHeader: z.boolean(),
    rowHeader: z.boolean()
  }),
  z.object({ type: z.literal('equation'), expression: z.string() }),
  z.object({ type: z.literal('divider') }),
  z.object({ type: z.literal('table_of_contents') }),
  z.object({ type: z.literal('column_list') }),
  z.object({ type: z.literal('column') }),
  z.object({ type: z.literal('synced_block') })
])
export type Block = z.infer<typeof bodySchema> & {
  id: string
  children: Block[]
}
export const blockSchema: z.ZodType<Block> = z.intersection(
  bodySchema,
  z.object({ id: idSchema, children: z.array(z.lazy(() => blockSchema)) })
)
export const assetSchema = z.object({
  url: httpUrlSchema,
  key: z.string().regex(/^personal-site\/media\/[a-f0-9]{64}\.[a-z0-9]+$/),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  mime: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
})
export const mediaSourceSchema = z.object({
  key: z.string(),
  kind: z.enum(['file', 'external']),
  edited: z.string(),
  url: httpUrlSchema.optional()
})
export const mediaSchema = z.object({
  source: mediaSourceSchema,
  pipelineVersion: z.number().int().positive(),
  original: assetSchema,
  variants: z.array(assetSchema),
  blurDataURL: z
    .string()
    .max(2048)
    .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/)
    .optional()
})
export const bookmarkPreviewSchema = z.object({
  title: z.string(),
  description: z.string(),
  needsImageSync: z.literal(true).optional(),
  image: mediaSchema.optional()
})
export type BookmarkPreview = z.infer<typeof bookmarkPreviewSchema>

export type MediaSource = z.infer<typeof mediaSourceSchema>
export type Media = z.infer<typeof mediaSchema>
export type Asset = z.infer<typeof assetSchema>
export const articleSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string(),
  published: z.string(),
  modified: z.string(),
  author: z.string(),
  tags: z.array(z.string()),
  featured: z.boolean(),
  needsImageSync: z.literal(true).optional(),
  cover: z.string().optional(),
  icon: iconSchema.optional(),
  blocks: z.array(blockSchema)
})
export type Article = z.infer<typeof articleSchema>
export const routeRecordSchema = z.object({
  slug: z.string().min(1),
  aliases: z.array(z.string()),
  active: z.boolean()
})
export type RouteRecord = z.infer<typeof routeRecordSchema>

// Keep the complete provider payload for react-tweet; validate its rendering boundary.
export const tweetDataSchema = z
  .object({
    __typename: z.literal('Tweet'),
    id_str: z.string(),
    text: z.string(),
    lang: z.string(),
    created_at: z.string(),
    display_text_range: z.tuple([z.number(), z.number()]),
    user: z
      .object({
        name: z.string(),
        screen_name: z.string(),
        profile_image_url_https: httpUrlSchema
      })
      .passthrough(),
    favorite_count: z.number(),
    conversation_count: z.number(),
    edit_control: z.object({}).passthrough(),
    isEdited: z.boolean(),
    isStaleEdit: z.boolean()
  })
  .passthrough()
export const tweetSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('available'), data: tweetDataSchema }),
  z.object({ status: z.literal('unavailable') })
])
export const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  importerVersion: z.literal(1),
  source: z.object({
    rootPageId: idSchema,
    workspaceId: idSchema,
    databaseId: idSchema,
    dataSourceId: idSchema,
    apiVersion: z.string(),
    propertyIds: z.record(z.string(), z.string())
  }),
  articles: z.record(idSchema, articleSchema),
  routes: z.record(idSchema, routeRecordSchema),
  media: z.record(z.string(), mediaSchema),
  bookmarks: z.record(httpUrlSchema, bookmarkPreviewSchema).optional(),
  tweets: z.record(z.string(), tweetSchema)
})
export type Snapshot = z.infer<typeof snapshotSchema>
export type TweetSnapshot = z.infer<typeof tweetSchema>
