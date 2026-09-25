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
      'pnpm content:sync [--only articles|projects] [--dry-run] [--force] [--fast] [--prune] [--accept-slug-changes]\n--fast skips images; --force re-reads every page. Recovered errors write the snapshot and exit 1.'
    )
    return
  }
  if (values.only && !['articles', 'projects'].includes(values.only))
    throw new Error('--only must be articles or projects')
  const syncArticles = values.only !== 'projects'
  const syncProjects = values.only !== 'articles'
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
  const articleInput = syncArticles
    ? await discover(sourceContract, previous?.source, previous?.routes ?? {})
    : undefined
  const projectInput = syncProjects
    ? await discover(
        projectSourceContract,
        previous?.projectSource,
        previous?.projectRoutes ?? {},
        projectProperties
      )
    : undefined
  const routes = articleInput?.routes ?? previous?.routes ?? {}
  const projectRoutes = projectInput?.routes ?? previous?.projectRoutes ?? {}
  const slugConflicts = crossCollectionSlugWarnings(routes, projectRoutes)
  slugConflicts.forEach(warn)
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
  const projectNormalizer = new Normalizer(
    api,
    projectRoutes,
    (source, url, refresh) => importer.import(source, url, refresh),
    {
      skipImages: values.fast,
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
    ? await importPages({
        ...importOptions,
        pages: articleInput.pages,
        previous: previous?.articles ?? {},
        routes,
        read: (page) =>
          normalizer.article(page, articleInput.source.propertyIds)
      })
    : (previous?.articles ?? {})
  const projects = projectInput
    ? await importPages({
        ...importOptions,
        kind: 'project',
        pages: projectInput.pages,
        previous: previous?.projects ?? {},
        routes: projectRoutes,
        read: (page) =>
          projectNormalizer.project(page, projectInput.source.propertyIds)
      })
    : (previous?.projects ?? {})
  normalizer.warnings.forEach(warn)
  projectNormalizer.warnings.forEach(warn)
  const entries = [...Object.values(articles), ...Object.values(projects)]
  const selectedEntries = [
    ...(syncArticles ? Object.values(articles) : []),
    ...(syncProjects ? Object.values(projects) : [])
  ]
  await syncImageWidths(
    selectedEntries.flatMap((entry) => entry.blocks),
    {
      previousBlocks: [
        ...Object.values(previous?.articles ?? {}),
        ...Object.values(previous?.projects ?? {})
      ].flatMap((entry) => entry.blocks),
      warn: reportRecoverableError
    }
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
  for (const article of entries) {
    const refs = articleReferences(article)
    for (const id of refs.media) {
      const item = importer.media[id] ?? previous?.media[id]
      if (!item) throw new Error('Media reference missing: ' + id)
      media[id] = item
    }
    for (const id of refs.tweets) tweetIds.add(id)
  }
  const tweets = await syncTweets(
    selectedTweets,
    previous?.tweets ?? {},
    options,
    reportRecoverableError
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
    : await backfillPlaceholders(
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
          warn: reportRecoverableError
        }
      )
  validateSnapshot(snapshot)
  const changed = options.dryRun ? false : await publishSnapshot(snapshot)
  const searchIndexChanged = options.dryRun
    ? false
    : await publishSearchIndex(snapshot)
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
          added: Object.keys(projects).filter((id) => !previous?.projects?.[id])
            .length,
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
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
