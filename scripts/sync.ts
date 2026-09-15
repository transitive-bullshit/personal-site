import { parseArgs } from 'node:util'
import { canonicalJson } from './io'
import { z } from 'zod'
import { sourceContract } from '../lib/site'
import {
  snapshotSchema,
  type Media,
  type Snapshot
} from '../lib/content/schema'
import { reconcileRoutes } from '../lib/content/routes'
import { articleReferences, validateSnapshot } from '../lib/content/references'
import { loadEnv, publishSnapshot, readSnapshot } from './io'
import { API_VERSION, NotionSourceClient, propertyById } from './notion/source'
import { Normalizer, plainText } from './notion/normalize'
import { importArticles } from './notion/import-articles'
import { MediaStorage, storageConfig } from './media/storage'
import { MediaCache } from './media/cache'
import { MediaImporter } from './media/process'
import { backfillPlaceholders } from './media/placeholders'
import { syncBookmarks } from './bookmarks'
import { publicFetch } from './public-fetch'
import { walkBlocks } from '../lib/content/references'
import { syncTweets } from './tweets'

export async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      fast: { type: 'boolean', default: false },
      prune: { type: 'boolean', default: false },
      'accept-slug-changes': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false }
    }
  })
  if (values.help) {
    console.log(
      'pnpm content:sync [--dry-run] [--force] [--fast] [--prune] [--accept-slug-changes]\n--fast skips images; --force re-reads every page. Recovered errors write the snapshot and exit 1.'
    )
    return
  }
  let recoverableErrors = 0
  const warn = (message: string) => console.warn(message)
  const reportRecoverableError = (message: string) => {
    recoverableErrors++
    warn(message)
  }
  await loadEnv()
  if (!process.env.NOTION_TOKEN)
    throw new Error('NOTION_TOKEN is required for content sync')
  const config = storageConfig()
  const previous = await readSnapshot()
  if (previous) {
    validateSnapshot(previous)
    for (const [key, value] of Object.entries(sourceContract)) {
      if (previous.source[key as keyof typeof sourceContract] !== value)
        throw new Error('Snapshot source contract changed: ' + key)
    }
  }
  const api = new NotionSourceClient(process.env.NOTION_TOKEN)
  const { propertyIds } = await api.verify(previous?.source.propertyIds)
  const pages = await api.rows(sourceContract.dataSourceId)
  const sourcePages = pages.map((page) => ({
    id: page.id,
    title: plainText(propertyById(page, propertyIds.Name!).title),
    slug: plainText(propertyById(page, propertyIds.Slug!).rich_text),
    public: z.boolean().parse(propertyById(page, propertyIds.Public!).checkbox)
  }))
  const { routes, warnings } = reconcileRoutes(
    sourcePages,
    previous?.routes ?? {},
    {
      prune: values.prune,
      acceptSlugChanges: values['accept-slug-changes']
    }
  )
  warnings.forEach(warn)
  const options = { force: values.force, dryRun: values['dry-run'] }
  const storage = new MediaStorage(config)
  // Verify R2 access without writing.
  try {
    await storage.exists('personal-site/.access-probe')
  } catch (err) {
    reportRecoverableError(
      'Media storage unavailable; continuing best effort (' +
        (err instanceof Error ? err.message : String(err)) +
        ')'
    )
  }
  const cache = await MediaCache.open()
  const importer = new MediaImporter(
    storage,
    {
      ...previous?.media,
      ...Object.fromEntries(
        Object.values(previous?.bookmarks ?? {}).flatMap((preview) =>
          preview.image ? [[preview.image.source.key, preview.image]] : []
        )
      )
    },
    options,
    cache
  )
  const normalizer = new Normalizer(
    api,
    routes,
    (source, url, refresh) => importer.import(source, url, refresh),
    {
      skipImages: values.fast,
      reuseMedia: (key) => importer.reuse(key)
    }
  )
  const publicIds = new Set(
    sourcePages.filter((page) => page.public).map((page) => page.id)
  )
  const selected = pages.filter((page) => publicIds.has(page.id))
  const articles = await importArticles({
    pages: selected,
    previous: previous?.articles ?? {},
    routes,
    force: values.force,
    fast: values.fast,
    read: (page) => normalizer.article(page, propertyIds),
    report: (message) => console.log(message),
    warn: reportRecoverableError
  })
  normalizer.warnings.forEach(warn)
  const bookmarkUrls = new Set<string>()
  for (const article of Object.values(articles))
    walkBlocks(article.blocks, (block) => {
      if (block.type === 'bookmark') bookmarkUrls.add(block.url)
    })
  console.log('Syncing ' + bookmarkUrls.size + ' bookmark previews')
  const bookmarkResult = await syncBookmarks({
    urls: bookmarkUrls,
    previous: previous?.bookmarks ?? {},
    ...options,
    skipImages: values.fast,
    warn: reportRecoverableError,
    saveImage: async (key, url) => {
      await importer.import(
        { key, kind: 'external', url, edited: url },
        url,
        undefined,
        publicFetch
      )
      const media = importer.media[key]!
      if (!media.original.mime.startsWith('image/'))
        throw new Error('Preview is not an image')
      return media
    }
  })
  const media: Record<string, Media> = {}
  const tweetIds = new Set<string>()
  for (const article of Object.values(articles)) {
    const refs = articleReferences(article)
    for (const id of refs.media) {
      const item = importer.media[id] ?? previous?.media[id]
      if (!item) throw new Error('Media reference missing: ' + id)
      media[id] = item
    }
    for (const id of refs.tweets) tweetIds.add(id)
  }
  const tweets = await syncTweets(
    tweetIds,
    previous?.tweets ?? {},
    options,
    reportRecoverableError
  )
  const snapshot: Snapshot = snapshotSchema.parse({
    schemaVersion: 1,
    importerVersion: 1,
    source: { ...sourceContract, apiVersion: API_VERSION, propertyIds },
    articles,
    routes,
    media,
    tweets,
    bookmarks: bookmarkResult.bookmarks
  })
  const addedPlaceholders = values.fast
    ? 0
    : await backfillPlaceholders(snapshot, {
        ...options,
        cache,
        warn: reportRecoverableError
      })
  validateSnapshot(snapshot)
  const changed = options.dryRun ? false : await publishSnapshot(snapshot)
  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        fast: values.fast,
        recoverableErrors,
        snapshotChanged: changed,
        addedPlaceholders,
        articles: Object.keys(articles).length,
        media: Object.keys(media).length,
        tweets: Object.keys(tweets).length,
        added: Object.keys(articles).filter((id) => !previous?.articles[id])
          .length,
        updated: Object.entries(articles).filter(
          ([id, article]) =>
            previous?.articles[id] &&
            canonicalJson(article) !== canonicalJson(previous.articles[id])
        ).length,
        unchanged: Object.entries(articles).filter(
          ([id, article]) =>
            previous?.articles[id] &&
            canonicalJson(article) === canonicalJson(previous.articles[id])
        ).length,
        removed: Object.keys(previous?.articles ?? {}).filter(
          (id) => !articles[id]
        ).length,
        bookmarkPreviews: Object.keys(bookmarkResult.bookmarks).length,
        bookmarkImages: Object.values(bookmarkResult.bookmarks).filter(
          (preview) => preview.image
        ).length,
        fetchedBookmarks: bookmarkResult.fetched,
        reusedBookmarks: bookmarkResult.reused,
        availableTweets: Object.values(tweets).filter(
          (tweet) => tweet.status === 'available'
        ).length,
        apiRequests: api.requests,
        blocks: normalizer.blockCounts,
        ...importer.stats,
        ...storage.stats
      },
      null,
      2
    )
  )
  if (recoverableErrors) process.exitCode = 1
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
