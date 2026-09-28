import { createSyncProgress } from './sync-progress'
import { parseArgs } from 'node:util'
import { canonicalJson } from './io'
import { z } from 'zod'
import { sourceContract, projectSourceContract } from '../lib/site'
import {
  snapshotSchema,
  type Media,
  type Snapshot
} from '../lib/content/schema'
import {
  reconcileRoutes,
  crossCollectionSlugWarnings
} from '../lib/content/routes'
import { articleReferences, validateSnapshot } from '../lib/content/references'
import { loadEnv, publishSnapshot, readSnapshot } from './io'
import { publishSearchIndex } from './search-index'
import {
  API_VERSION,
  NotionSourceClient,
  propertyById,
  projectProperties
} from './notion/source'
import { Normalizer, plainText } from './notion/normalize'
import { importPages } from './notion/import-pages'
import { syncImageWidths } from './notion/image-widths'
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
      only: { type: 'string' },
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
      'pnpm content:sync [--only articles|projects] [--dry-run] [--force] [--fast] [--prune] [--accept-slug-changes]\n--fast skips image, video, audio, and file processing; --force re-reads every page. Recovered errors write the snapshot and exit 1.'
    )
    return
  }
  if (values.only && !['articles', 'projects'].includes(values.only))
    throw new Error('--only must be articles or projects')
  const progress = await createSyncProgress()
  try {
    const syncArticles = values.only !== 'projects'
    const syncProjects = values.only !== 'articles'
    let recoverableErrors = 0
    const warn = (message: string) => progress.warn(message)
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
    async function discover(
      contract: typeof sourceContract | typeof projectSourceContract,
      savedSource: Snapshot['source'] | undefined,
      savedRoutes: Snapshot['routes'],
      properties?: Record<string, string>
    ) {
      if (savedSource) {
        for (const [key, value] of Object.entries(contract)) {
          if (savedSource[key as keyof typeof contract] !== value)
            throw new Error('Snapshot source contract changed: ' + key)
        }
      }
      const { propertyIds } = await api.verify(
        savedSource?.propertyIds,
        contract,
        properties
      )
      const pages = await api.rows(contract.dataSourceId)
      const sourcePages = pages.map((page) => ({
        id: page.id,
        title: plainText(propertyById(page, propertyIds.Name!).title),
        slug: plainText(propertyById(page, propertyIds.Slug!).rich_text),
        public: z
          .boolean()
          .parse(propertyById(page, propertyIds.Public!).checkbox)
      }))
      const { routes, warnings } = reconcileRoutes(sourcePages, savedRoutes, {
        prune: values.prune,
        acceptSlugChanges: values['accept-slug-changes']
      })
      warnings.forEach(warn)
      const publicIds = new Set(
        sourcePages.filter((page) => page.public).map((page) => page.id)
      )
      return {
        routes,
        pages: pages.filter((page) => publicIds.has(page.id)),
        source: { ...contract, apiVersion: API_VERSION, propertyIds }
      }
    }
    // Settle both tasks before propagating failures so progress cleanup cannot
    // run while the other discovery task is still active.
    const [articleDiscovery, projectDiscovery] = await Promise.allSettled([
      syncArticles
        ? progress.run('Discover articles', () =>
            discover(sourceContract, previous?.source, previous?.routes ?? {})
          )
        : undefined,
      syncProjects
        ? progress.run('Discover projects', () =>
            discover(
              projectSourceContract,
              previous?.projectSource,
              previous?.projectRoutes ?? {},
              projectProperties
            )
          )
        : undefined
    ])
    if (articleDiscovery.status === 'rejected') throw articleDiscovery.reason
    if (projectDiscovery.status === 'rejected') throw projectDiscovery.reason
    const articleInput = articleDiscovery.value
    const projectInput = projectDiscovery.value
    const routes = articleInput?.routes ?? previous?.routes ?? {}
    const projectRoutes = projectInput?.routes ?? previous?.projectRoutes ?? {}
    const slugConflicts = crossCollectionSlugWarnings(routes, projectRoutes)
    slugConflicts.forEach(warn)
    const options = { force: values.force, dryRun: values['dry-run'] }
    const storage = new MediaStorage(config)
    // Verify R2 access without writing.
    await progress.run('Check media storage', async () => {
      try {
        await storage.exists('personal-site/.access-probe')
      } catch (err) {
        reportRecoverableError(
          'Media storage unavailable; continuing best effort (' +
            (err instanceof Error ? err.message : String(err)) +
            ')'
        )
      }
    })
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
        skipMedia: values.fast,
        reuseMedia: (key) => importer.reuse(key)
      }
    )
    const projectNormalizer = new Normalizer(
      api,
      projectRoutes,
      (source, url, refresh) => importer.import(source, url, refresh),
      {
        skipMedia: values.fast,
        reuseMedia: (key) => importer.reuse(key),
        linkRoutes: routes
      }
    )
    const importOptions = {
      force: values.force,
      fast: values.fast,
      report: (message: string) => console.log(message),
      warn: reportRecoverableError
    }
    const articles = articleInput
      ? await progress.run('Import articles', (progress) =>
          importPages({
            progress,
            ...importOptions,
            pages: articleInput.pages,
            previous: previous?.articles ?? {},
            routes,
            read: (page) =>
              normalizer.article(page, articleInput.source.propertyIds)
          })
        )
      : (previous?.articles ?? {})
    const projects = projectInput
      ? await progress.run('Import projects', (progress) =>
          importPages({
            progress,
            ...importOptions,
            kind: 'project',
            // Re-read cached projects once when adopting the Type property.
            force: values.force || !previous?.projectSource?.propertyIds.Type,
            pages: projectInput.pages,
            previous: previous?.projects ?? {},
            routes: projectRoutes,
            read: (page) =>
              projectNormalizer.project(page, projectInput.source.propertyIds)
          })
        )
      : (previous?.projects ?? {})
    normalizer.warnings.forEach(warn)
    projectNormalizer.warnings.forEach(warn)
    const entries = [...Object.values(articles), ...Object.values(projects)]
    const selectedEntries = [
      ...(syncArticles ? Object.values(articles) : []),
      ...(syncProjects ? Object.values(projects) : [])
    ]
    await progress.run('Refresh image widths', (progress) =>
      syncImageWidths(
        selectedEntries.flatMap((entry) => entry.blocks),
        {
          progress,
          previousBlocks: [
            ...Object.values(previous?.articles ?? {}),
            ...Object.values(previous?.projects ?? {})
          ].flatMap((entry) => entry.blocks),
          warn: reportRecoverableError
        }
      )
    )
    const selectedMedia = new Set(
      selectedEntries.flatMap((entry) => [...articleReferences(entry).media])
    )
    const selectedTweets = new Set(
      selectedEntries.flatMap((entry) => [...articleReferences(entry).tweets])
    )
    const bookmarkUrls = new Set<string>()
    for (const article of selectedEntries)
      walkBlocks(article.blocks, (block) => {
        if (block.type === 'bookmark') bookmarkUrls.add(block.url)
      })
    const bookmarkResult = await progress.run(
      'Sync bookmark previews',
      (progress) =>
        syncBookmarks({
          progress,
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
    )
    const media: Record<string, Media> = {}
    const tweetIds = new Set<string>()
    for (const article of entries) {
      const refs = articleReferences(article)
      for (const id of refs.media) {
        const item = importer.media[id] ?? previous?.media[id]
        if (!item) throw new Error('Media reference missing: ' + id)
        media[id] = item
      }
      for (const id of refs.tweets) tweetIds.add(id)
    }
    const tweets = await progress.run('Sync tweets', (progress) =>
      syncTweets(
        selectedTweets,
        previous?.tweets ?? {},
        { ...options, progress },
        reportRecoverableError
      )
    )
    // Keep assets referenced by the unselected collection without refreshing them.
    for (const id of tweetIds)
      tweets[id] ??= previous?.tweets[id] ?? { status: 'unavailable' }
    for (const entry of entries)
      walkBlocks(entry.blocks, (block) => {
        if (block.type === 'bookmark' && previous?.bookmarks?.[block.url])
          bookmarkResult.bookmarks[block.url] ??= previous.bookmarks[block.url]!
      })
    const snapshot: Snapshot = snapshotSchema.parse({
      schemaVersion: 1,
      importerVersion: 1,
      source: articleInput?.source ??
        previous?.source ?? {
          ...sourceContract,
          apiVersion: API_VERSION,
          propertyIds: {}
        },
      projectSource: projectInput?.source ?? previous?.projectSource,
      projects,
      projectRoutes,
      articles,
      routes,
      media,
      tweets,
      bookmarks: bookmarkResult.bookmarks
    })
    const addedPlaceholders = values.fast
      ? 0
      : await progress.run('Generate image placeholders', (progress) =>
          backfillPlaceholders(
            {
              media: Object.fromEntries(
                Object.entries(snapshot.media).filter(([id]) =>
                  selectedMedia.has(id)
                )
              ),
              bookmarks: Object.fromEntries(
                Object.entries(snapshot.bookmarks ?? {}).filter(([url]) =>
                  bookmarkUrls.has(url)
                )
              )
            },
            {
              ...options,
              cache,
              progress,
              warn: reportRecoverableError
            }
          )
        )
    await progress.run('Validate snapshot', async () =>
      validateSnapshot(snapshot)
    )
    const changed = options.dryRun
      ? false
      : await progress.run('Publish snapshot', () => publishSnapshot(snapshot))
    const searchIndexChanged = options.dryRun
      ? false
      : await progress.run('Publish search index', () =>
          publishSearchIndex(snapshot)
        )
    progress.finish()
    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          fast: values.fast,
          recoverableErrors,
          snapshotChanged: changed,
          searchIndexChanged,
          addedPlaceholders,
          articles: Object.keys(articles).length,
          projects: Object.keys(projects).length,
          selected: values.only ?? 'both',
          slugConflicts,
          projectChanges: {
            added: Object.keys(projects).filter(
              (id) => !previous?.projects?.[id]
            ).length,
            updated: Object.keys(projects).filter(
              (id) =>
                previous?.projects?.[id] &&
                canonicalJson(projects[id]) !==
                  canonicalJson(previous.projects[id])
            ).length,
            removed: Object.keys(previous?.projects ?? {}).filter(
              (id) => !projects[id]
            ).length
          },
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
          projectBlocks: projectNormalizer.blockCounts,
          ...importer.stats,
          ...storage.stats
        },
        null,
        2
      )
    )
    if (recoverableErrors) process.exitCode = 1
  } finally {
    progress.finish()
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
