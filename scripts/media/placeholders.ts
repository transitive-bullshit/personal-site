import type { Snapshot } from '../../lib/content/schema'
import type { MediaCache } from './cache'
import { createBlurDataURL, download } from './process'
import { publicFetch } from '../public-fetch'

// Upgrade older snapshots from immutable cached assets, never expiring Notion
// URLs. Completed previews can resume after a failed sync without new uploads.
export async function backfillPlaceholders(
  snapshot: Pick<Snapshot, 'media' | 'bookmarks'>,
  options: { dryRun: boolean; cache?: MediaCache; fetcher?: typeof fetch }
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
  async function worker() {
    while (cursor < images.length) {
      const media = images[cursor++]!
      const cached = options.cache?.entries[media.source.key]
      if (cached?.original.hash === media.original.hash && cached.blurDataURL) {
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
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, images.length) }, worker))
  return images.length
}
