import type { Snapshot } from '../../lib/content/schema'
import type { MediaCache } from './cache'
import { createBlurDataURL, download } from './process'
import { publicFetch } from '../public-fetch'

// Backfill from durable assets and resume cached previews.
export async function backfillPlaceholders(
  snapshot: Pick<Snapshot, 'media' | 'bookmarks'>,
  options: {
    dryRun: boolean
    cache?: MediaCache
    fetcher?: typeof fetch
    warn?: (message: string) => void
  }
) {
  if (options.dryRun) return 0
  const images = [
    ...Object.values(snapshot.media),
    ...Object.values(snapshot.bookmarks ?? {}).flatMap((preview) =>
      preview.image ? [preview.image] : []
    )
  ].filter(
    (media) => media.original.mime.startsWith('image/') && !media.blurDataURL
  )
  const previews = new Map<string, Promise<string>>()
  let cursor = 0
  let added = 0
  async function worker() {
    while (cursor < images.length) {
      const media = images[cursor++]!
      try {
        const cached = options.cache?.entries[media.source.key]
        if (
          cached?.original.hash === media.original.hash &&
          cached.blurDataURL
        ) {
          media.blurDataURL = cached.blurDataURL
        } else {
          const asset = media.variants[0] ?? media.original
          let preview = previews.get(asset.hash)
          if (!preview) {
            preview = download(
              asset.url,
              undefined,
              options.fetcher ?? publicFetch
            ).then(({ bytes }) => createBlurDataURL(bytes))
            previews.set(asset.hash, preview)
          }
          media.blurDataURL = await preview
        }
        await options.cache?.save(media)
        added++
      } catch (err) {
        options.warn?.(
          'Image placeholder unavailable: ' +
            media.source.key +
            ' (' +
            (err instanceof Error ? err.message : String(err)) +
            ')'
        )
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, images.length) }, worker))
  return added
}
