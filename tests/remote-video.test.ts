import { readFile } from 'node:fs/promises'
import { expect, it, vi } from 'vitest'
import { MediaImporter } from '../scripts/media/process'
import { MediaStorage, type StorageTransport } from '../scripts/media/storage'
import {
  inspectRemoteVideo,
  isHotlinkedVideo
} from '../scripts/media/remote-video'
import { mediaSchema } from '../lib/content/schema'

const url =
  'https://assets.cultural-alignment.com/sometimes-i-think-slow/dbaeec4dc994878587b0a3cd42e5837560504bc8229161a049931f10103d22f9.mp4'
const source = {
  key: '913473a974c447bca9d065b2f2e2623f',
  kind: 'external' as const,
  edited: '2026-09-28',
  url
}
const storage = () =>
  new MediaStorage(
    {
      bucket: 'test',
      publicOrigin: 'https://assets.cultural-alignment.com',
      client: {
        endpoint: 'https://example.com',
        region: 'auto',
        credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
        maxAttempts: 1
      }
    },
    { send: vi.fn<StorageTransport['send']>().mockResolvedValue({}) }
  )

async function rangeFetcher(fixture = 'video.mp4') {
  const data = await readFile(new URL(`./fixtures/${fixture}`, import.meta.url))
  return vi.fn<typeof fetch>(async (_url, options) => {
    expect(options?.redirect).toBe('error')
    if (options?.method === 'HEAD')
      return new Response(null, {
        headers: {
          'content-type': 'video/mp4',
          'content-length': String(data.length)
        }
      })
    const range = new Headers(options?.headers).get('range')!
    const [, first, last] = /^bytes=(\d+)-(\d+)$/.exec(range)!
    const start = Number(first),
      end = Number(last)
    return new Response(data.subarray(start, end + 1), {
      status: 206,
      headers: { 'content-range': `bytes ${start}-${end}/${data.length}` }
    })
  })
}

it('hotlinks only stable videos on explicitly owned origins', () => {
  expect(isHotlinkedVideo(url)).toBe(true)
  for (const other of [
    url.replace('https:', 'http:'),
    url.replace('.com/', '.com.evil.test/'),
    url + '?token=secret',
    url.replace('.mp4', '.jpg'),
    'https://another-tenant.r2.dev/video.mp4',
    url.replace('https://', 'https://user:pass@')
  ])
    expect(isHotlinkedVideo(other)).toBe(false)
})

it('preserves the original URL, publishes only a poster, and reuses metadata', async () => {
  const target = storage()
  const publish = vi.spyOn(target, 'publish')
  const fetcher = await rangeFetcher()
  const importer = new MediaImporter(
    target,
    {},
    { force: false, dryRun: false }
  )
  await importer.import(source, url, undefined, fetcher)
  const saved = mediaSchema.parse(importer.media[source.key])
  expect(saved.original).toMatchObject({
    remote: true,
    url,
    width: 160,
    height: 90
  })
  expect(saved.original).not.toHaveProperty('hash')
  expect(publish).toHaveBeenCalledTimes(1)
  expect(publish.mock.calls[0]?.[1]).toBe('image/webp')
  expect(importer.stats.downloaded).toBe(0)
  expect(importer.stats.hotlinked).toBe(1)
  fetcher.mockClear()
  const retry = new MediaImporter(target, importer.media, {
    force: false,
    dryRun: false
  })
  await retry.import(source, url, undefined, fetcher)
  expect(fetcher).not.toHaveBeenCalled()
  const dry = new MediaImporter(target, {}, { force: true, dryRun: true })
  await dry.import(source, url, undefined, fetcher)
  expect(fetcher).not.toHaveBeenCalled()
  expect(publish).toHaveBeenCalledTimes(1)
})

it('rejects servers that ignore ranges without reading their full response', async () => {
  const fetcher = await rangeFetcher()
  const cancel = vi.fn<() => void>()
  fetcher.mockImplementation(async (_url, options) =>
    options?.method === 'HEAD'
      ? new Response(null, {
          headers: {
            'content-type': 'video/mp4',
            'content-length': '900000000'
          }
        })
      : new Response(new ReadableStream({ cancel }), { status: 200 })
  )
  await expect(inspectRemoteVideo(url, fetcher)).rejects.toThrow(
    'must honor byte ranges'
  )
  expect(cancel).toHaveBeenCalled()
})

it.each(['video-rotated.mp4', 'video-anamorphic.mp4'])(
  'retains display dimensions for %s',
  async (fixture) => {
    const inspected = await inspectRemoteVideo(url, await rangeFetcher(fixture))
    expect(inspected.width).toBeGreaterThan(0)
    expect(inspected.height).toBeGreaterThan(0)
  }
)
