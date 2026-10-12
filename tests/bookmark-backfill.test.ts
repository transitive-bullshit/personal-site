import { expect, it, vi } from 'vitest'
import { backfillBookmarkScreenshots } from '../scripts/backfill-bookmark-screenshots'
import { contentFixture } from './fixtures/content'

type Options = Parameters<typeof backfillBookmarkScreenshots>[0]

const url = 'https://example.com/missing'
const screenshot = {
  url: '/bookmarks/' + 'a'.repeat(64) + '.webp',
  width: 640,
  height: 480
}
it('persists capture failures, skips saved failures, and clears them on explicit recovery', async () => {
  const snapshot = contentFixture()
  snapshot.bookmarks = {
    [url]: { title: 'Saved', description: 'Details', needsImageSync: true }
  }
  const capture = vi
    .fn<NonNullable<Options['capture']>>()
    .mockRejectedValue(new Error('HTTP 404'))
  const publish = vi
    .fn<NonNullable<Options['publish']>>()
    .mockResolvedValue(true)
  const warn = vi.fn<NonNullable<Options['warn']>>()
  const log = vi.fn<NonNullable<Options['log']>>()
  const options = { snapshot, capture, publish, warn, log }
  await backfillBookmarkScreenshots(options)
  expect(snapshot.bookmarks[url]?.failure).toEqual({
    stage: 'image',
    reason: 'HTTP 404'
  })
  expect(snapshot.bookmarks[url]?.needsImageSync).toBeUndefined()
  expect(publish).toHaveBeenCalledOnce()
  await backfillBookmarkScreenshots(options)
  expect(capture).toHaveBeenCalledOnce()
  capture.mockResolvedValue(screenshot)
  await backfillBookmarkScreenshots({ ...options, force: true })
  expect(snapshot.bookmarks[url]?.screenshot).toEqual(screenshot)
  expect(snapshot.bookmarks[url]?.failure).toBeUndefined()
})
it('propagates publication errors instead of treating them as acceptable capture failures', async () => {
  const snapshot = contentFixture()
  snapshot.bookmarks = { [url]: { title: 'Saved', description: 'Details' } }
  await expect(
    backfillBookmarkScreenshots({
      snapshot,
      capture: async () => screenshot,
      publish: async () => {
        throw new Error('Disk full')
      },
      log: () => {}
    })
  ).rejects.toThrow('Disk full')
  expect(snapshot.bookmarks[url]?.failure).toBeUndefined()
})
