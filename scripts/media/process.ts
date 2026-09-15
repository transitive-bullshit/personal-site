import sharp from 'sharp'
import type { MediaCache } from './cache'
import { setTimeout as delay } from 'node:timers/promises'
import type { Media, MediaSource } from '../../lib/content/schema'
import { MediaStorage, hashBytes } from './storage'

export const MEDIA_PIPELINE_VERSION = 1
const MAX_BYTES = 256 * 1024 * 1024

export function canReuseMedia(
  previous: Media | undefined,
  source: MediaSource,
  force: boolean
) {
  return (
    !force &&
    previous?.pipelineVersion === MEDIA_PIPELINE_VERSION &&
    previous.source.key === source.key &&
    previous.source.kind === source.kind &&
    previous.source.edited === source.edited &&
    previous.source.url === source.url
  )
}

export async function download(
  url: string,
  refresh?: () => Promise<string>,
  fetcher: typeof fetch = fetch
) {
  let current = url
  for (let attempt = 0; attempt < 3; attempt++) {
    const parsed = new URL(current)
    if (
      !['https:', 'http:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error('Unsupported media URL')
    try {
      const response = await fetcher(current, {
        signal: AbortSignal.timeout(300_000)
      })
      if (
        (response.status === 403 || response.status === 401) &&
        refresh &&
        attempt === 0
      ) {
        await response.body?.cancel()
        current = await refresh()
        continue
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel()
        await delay(
          Math.min(
            10_000,
            Number(response.headers.get('retry-after') ?? 2) * 1000 || 2000
          )
        )
        continue
      }
      if (!response.ok)
        throw new Error(
          'Media download returned HTTP ' +
            response.status +
            ' from ' +
            parsed.hostname
        )
      const declared = Number(response.headers.get('content-length') ?? 0)
      if (declared > MAX_BYTES) {
        await response.body?.cancel()
        throw new Error('Media exceeds 256 MiB limit')
      }
      if (!response.body) throw new Error('Empty media response')
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        for (;;) {
          const item = await reader.read()
          if (item.done) break
          size += item.value.byteLength
          if (size > MAX_BYTES) throw new Error('Media exceeds 256 MiB limit')
          chunks.push(item.value)
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      if (!size) throw new Error('Empty media file')
      return {
        bytes: Buffer.concat(chunks),
        mime: (response.headers.get('content-type') ?? '')
          .split(';')[0]!
          .toLowerCase()
      }
    } catch (err) {
      const retryable =
        err instanceof TypeError ||
        (err instanceof Error &&
          ['TimeoutError', 'AbortError'].includes(err.name))
      if (!retryable || attempt === 2) throw err
      await delay(1000 * (attempt + 1))
    }
  }
  throw new Error('Media download retries exhausted')
}

const imageFormats = {
  jpeg: ['image/jpeg', 'jpg'],
  png: ['image/png', 'png'],
  gif: ['image/gif', 'gif'],
  webp: ['image/webp', 'webp'],
  avif: ['image/avif', 'avif'],
  svg: ['image/svg+xml', 'svg'],
  tiff: ['image/tiff', 'tiff'],
  heif: ['image/heif', 'heif']
} satisfies Record<string, [string, string]>
const extensions = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'text/plain': 'txt'
} satisfies Record<string, string>

// Next.js applies the visual blur. Store only an 8px preview, including the
// first frame of animated images; the original animation is never rewritten.
export async function createBlurDataURL(bytes: Buffer) {
  const preview = await sharp(bytes, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: 8, height: 8, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 40 })
    .toBuffer()
  return 'data:image/webp;base64,' + preview.toString('base64')
}

export async function processMedia(
  bytes: Buffer,
  reportedMime: string,
  storage: MediaStorage
) {
  const metadata = await sharp(bytes, { limitInputPixels: 100_000_000 })
    .metadata()
    .catch(() => undefined)
  if (reportedMime.startsWith('image/') && !metadata)
    throw new Error('Image could not be decoded')
  const format = metadata?.format
  const [mime, extension] =
    format && Object.hasOwn(imageFormats, format)
      ? imageFormats[format as keyof typeof imageFormats]
      : [
          reportedMime || 'application/octet-stream',
          Object.hasOwn(extensions, reportedMime)
            ? extensions[reportedMime as keyof typeof extensions]
            : 'bin'
        ]
  if (mime === 'text/html' || mime === 'application/json')
    throw new Error('Media URL returned a document instead of a media file')
  const original = await storage.publish(
    bytes,
    mime,
    extension,
    metadata?.width && metadata.height
      ? {
          width: metadata.width,
          height: metadata.pageHeight ?? metadata.height
        }
      : {}
  )
  const variants = []
  if (
    metadata &&
    format !== 'gif' &&
    format !== 'svg' &&
    (metadata.pages ?? 1) === 1 &&
    metadata.width
  ) {
    const widths = [
      ...new Set([
        Math.min(960, metadata.width),
        Math.min(1920, metadata.width)
      ])
    ]
    for (const width of widths) {
      const output = await sharp(bytes)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: width <= 960 ? 82 : 90 })
        .toBuffer({ resolveWithObject: true })
      variants.push(
        await storage.publish(output.data, 'image/webp', 'webp', {
          width: output.info.width,
          height: output.info.height
        })
      )
    }
  }
  const blurDataURL = metadata ? await createBlurDataURL(bytes) : undefined
  return { original, variants, blurDataURL }
}

export class MediaImporter {
  readonly media: Record<string, Media> = {}
  readonly stats = {
    reusedSources: 0,
    downloaded: 0,
    downloadedBytes: 0,
    planned: 0
  }
  constructor(
    readonly storage: MediaStorage,
    readonly previous: Record<string, Media>,
    readonly options: { force: boolean; dryRun: boolean },
    readonly cache?: MediaCache
  ) {}

  async import(
    source: MediaSource,
    url: string,
    refresh?: () => Promise<string>,
    fetcher?: typeof fetch
  ): Promise<string> {
    const published = this.previous[source.key]
    const old = canReuseMedia(published, source, this.options.force)
      ? published
      : this.cache?.entries[source.key]
    if (canReuseMedia(old, source, this.options.force)) {
      this.media[source.key] = old!
      this.stats.reusedSources++
      return source.key
    }
    if (this.options.dryRun) {
      const hash = hashBytes(Buffer.from(JSON.stringify(source)))
      this.media[source.key] = old ?? {
        source,
        pipelineVersion: MEDIA_PIPELINE_VERSION,
        original: {
          url:
            'https://assets.cultural-alignment.com/personal-site/media/' +
            hash +
            '.bin',
          key: 'personal-site/media/' + hash + '.bin',
          hash,
          mime: 'application/octet-stream',
          bytes: 0
        },
        variants: []
      }
      this.stats.planned++
      return source.key
    }
    const { bytes, mime } = await download(url, refresh, fetcher)
    this.stats.downloaded++
    this.stats.downloadedBytes += bytes.byteLength
    const processed = await processMedia(bytes, mime, this.storage)
    this.media[source.key] = {
      source,
      pipelineVersion: MEDIA_PIPELINE_VERSION,
      ...processed
    }
    await this.cache?.save(this.media[source.key]!)
    return source.key
  }
}
