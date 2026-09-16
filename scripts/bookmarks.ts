import { load } from 'cheerio'
import { createHash } from 'node:crypto'
import type { BookmarkPreview, Media } from '../lib/content/schema'
import { publicFetch } from './public-fetch'

export function parseBookmark(html: string, pageUrl: string) {
  const $ = load(html)
  const meta = (name: string) =>
    $('meta')
      .toArray()
      .find(
        (el) =>
          ($(el).attr('property') ?? $(el).attr('name'))?.toLowerCase() === name
      )
  const value = (name: string) => $(meta(name)).attr('content')?.trim() ?? ''
  const title =
    value('og:title') ||
    value('twitter:title') ||
    $('title').first().text().trim()
  const description =
    value('og:description') ||
    value('twitter:description') ||
    value('description')
  const candidates = [
    'og:image:secure_url',
    'og:image',
    'og:image:url',
    'twitter:image',
    'twitter:image:src'
  ]
    .map(value)
    .filter(Boolean)
  const images = [
    ...new Set(
      candidates.flatMap((candidate) => {
        try {
          const url = new URL(candidate, pageUrl)
          return ['https:', 'http:'].includes(url.protocol) ? [url.href] : []
        } catch {
          return []
        }
      })
    )
  ]
  return { title, description, images }
}

export async function fetchBookmarkPage(url: string) {
  const response = await publicFetch(url, {
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('HTTP ' + response.status)
  }
  if (!(response.headers.get('content-type') ?? '').includes('html')) {
    await response.body?.cancel()
    throw new Error('Not an HTML page')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty page')
  const decoder = new TextDecoder()
  let html = ''
  let bytes = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.length
      html += decoder.decode(chunk.value, { stream: true })
      if (/<\/head\s*>/i.test(html) || bytes >= 2 * 1024 * 1024) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const finalUrl = response.url || url
  return { url: finalUrl, ...parseBookmark(html, finalUrl) }
}

export async function fetchBookmark(url: string) {
  const { url: _url, ...preview } = await fetchBookmarkPage(url)
  return preview
}

export const bookmarkKey = (url: string) =>
  'bookmark:' + createHash('sha256').update(url).digest('hex')

export async function syncBookmarks(options: {
  urls: Iterable<string>
  previous: Record<string, BookmarkPreview>
  force: boolean
  dryRun: boolean
  skipImages?: boolean
  saveImage: (key: string, imageUrl: string) => Promise<Media>
  warn: (message: string) => void
  fetchPreview?: typeof fetchBookmark
}) {
  const urls = [...new Set(options.urls)].sort()
  const bookmarks: Record<string, BookmarkPreview> = {}
  let cursor = 0
  let fetched = 0
  let reused = 0
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++]!
      const old = options.previous[url]
      if ((old && !old.needsImageSync && !options.force) || options.dryRun) {
        if (old) bookmarks[url] = old
        reused += Number(Boolean(old))
        continue
      }
      fetched++
      try {
        const preview = await (options.fetchPreview ?? fetchBookmark)(url)
        let image = options.skipImages ? old?.image : undefined
        if (!options.skipImages) {
          for (const candidate of preview.images.slice(0, 3)) {
            try {
              image = await options.saveImage(bookmarkKey(url), candidate)
              break
            } catch {
              /* Try the next advertised social image. */
            }
          }
          if (preview.images.length && !image) {
            options.warn('Bookmark image unavailable: ' + url)
            // Keep an existing good image when a refresh encounters a transient failure.
            image = old?.image
          }
        }
        bookmarks[url] = {
          title: preview.title,
          description: preview.description,
          needsImageSync:
            options.skipImages && preview.images.length ? true : undefined,
          image
        }
      } catch (err) {
        bookmarks[url] = old ?? { title: '', description: '' }
        options.warn(
          'Bookmark preview unavailable: ' +
            url +
            ' (' +
            (err instanceof Error ? err.message : String(err)) +
            ')'
        )
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker))
  return { bookmarks, fetched, reused }
}
