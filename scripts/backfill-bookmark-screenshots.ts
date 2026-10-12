import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import type { BookmarkScreenshot, Snapshot } from '../lib/content/schema'
import { readSnapshot, publishSnapshot } from './io'
import { captureBookmarkScreenshot } from './bookmark-screenshots'
import { bookmarkFailure } from './bookmarks'

export async function backfillBookmarkScreenshots(options: {
  snapshot: Snapshot
  urls?: string[]
  force?: boolean
  capture?: (url: string) => Promise<BookmarkScreenshot>
  publish?: typeof publishSnapshot
  log?: (message: string) => void
  warn?: (message: string) => void
}) {
  const { snapshot } = options
  const log = options.log ?? console.log
  const warn = options.warn ?? console.warn
  for (const url of options.urls ??
    Object.keys(snapshot.bookmarks ?? {}).sort()) {
    const preview = snapshot.bookmarks?.[url]
    if (!preview) throw new Error('Not a saved bookmark: ' + url)
    if (
      preview.image ||
      preview.screenshot ||
      (preview.failure && !options.force)
    )
      continue
    try {
      preview.screenshot = await (options.capture ?? captureBookmarkScreenshot)(
        url
      )
      if (preview.failure?.stage === 'image') delete preview.failure
    } catch (err) {
      const failure = bookmarkFailure('image', err)
      if (preview.failure?.stage !== 'metadata') preview.failure = failure
      warn('Screenshot unavailable: ' + url + ' (' + failure.reason + ')')
    }
    if (preview.screenshot)
      log('Captured ' + url + ' → ' + preview.screenshot.url)
    delete preview.needsImageSync
    // Publication failures remain errors; unavailable previews are acceptable.
    await (options.publish ?? publishSnapshot)(snapshot)
  }
}

export async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', multiple: true },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean' }
    }
  })
  if (values.help) {
    console.log(
      'pnpm content:bookmark-images [--url URL ...] [--force]\nCapture missing bookmark images. Saved images and failures are reused; --force retries failed previews.'
    )
    return
  }
  const snapshot = await readSnapshot()
  if (!snapshot) throw new Error('Missing content snapshot')
  await backfillBookmarkScreenshots({
    snapshot,
    urls: values.url,
    force: values.force
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main()
