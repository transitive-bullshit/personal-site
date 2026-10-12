import { parseArgs } from 'node:util'
import { readSnapshot, publishSnapshot } from './io'
import { captureBookmarkScreenshot } from './bookmark-screenshots'

const { values } = parseArgs({
  options: {
    url: { type: 'string', multiple: true },
    help: { type: 'boolean' }
  }
})
if (values.help) {
  console.log(
    'pnpm content:bookmark-images [--url URL ...]\nCapture missing bookmark images from the saved snapshot without fetching Notion. Existing images and screenshots are reused.'
  )
} else {
  const snapshot = await readSnapshot()
  if (!snapshot) throw new Error('Missing content snapshot')
  const urls = values.url ?? Object.keys(snapshot.bookmarks ?? {}).sort()
  let failures = 0
  for (const url of urls) {
    const preview = snapshot.bookmarks?.[url]
    if (!preview) throw new Error('Not a saved bookmark: ' + url)
    if (preview.image || preview.screenshot) continue
    try {
      preview.screenshot = await captureBookmarkScreenshot(url)
      delete preview.needsImageSync
      await publishSnapshot(snapshot)
      console.log('Captured ' + url + ' → ' + preview.screenshot.url)
    } catch (err) {
      failures++
      console.error(
        'Screenshot unavailable: ' +
          url +
          ' (' +
          (err instanceof Error ? err.message : String(err)) +
          ')'
      )
    }
  }
  process.exitCode = failures ? 1 : 0
}
