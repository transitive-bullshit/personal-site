import { afterEach, expect, it, vi } from 'vitest'
import { download, processMedia } from '../scripts/media/process'
import { MediaStorage, type StorageTransport } from '../scripts/media/storage'
import { setTimeout as delay } from 'node:timers/promises'

// Keep real fetch/Response/reader failures; only the irrelevant backoff clock is replaced.
vi.mock('node:timers/promises', () => ({
  setTimeout: vi
    .fn<typeof import('node:timers/promises').setTimeout>()
    .mockResolvedValue(undefined)
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.mocked(delay).mockClear()
})

it('retries a transient network error while downloading required media', async () => {
  const signal = new AbortController().signal
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal)
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError('fetch failed'))
    .mockResolvedValueOnce(
      new Response('image-bytes', { headers: { 'content-type': 'image/png' } })
    )
  vi.stubGlobal('fetch', fetchMock)
  const result = await download('https://example.com/image.png')
  expect(result.bytes.toString()).toBe('image-bytes')
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(timeout.mock.calls).toEqual([[30 * 60 * 1000], [30 * 60 * 1000]])
  expect(fetchMock.mock.calls.map(([, options]) => options?.signal)).toEqual([
    signal,
    signal
  ])
  expect(delay).toHaveBeenCalledWith(1000)
})

it('retries a connection lost halfway through the response body', async () => {
  let pulls = 0
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          pull(controller) {
            if (pulls++ === 0)
              controller.enqueue(new TextEncoder().encode('partial'))
            else controller.error(new TypeError('terminated'))
          }
        })
      )
    )
    .mockResolvedValueOnce(new Response('complete'))
  vi.stubGlobal('fetch', fetchMock)
  expect((await download('https://example.com/file')).bytes.toString()).toBe(
    'complete'
  )
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(pulls).toBe(2)
})

it('rejects a stale media URL that returns a webpage without uploading it', async () => {
  const send = vi.fn<StorageTransport['send']>()
  const storage = new MediaStorage(
    {
      bucket: 'fixture',
      publicOrigin: 'https://assets.example.com',
      client: {
        endpoint: 'https://storage.example.com',
        region: 'auto',
        credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
        maxAttempts: 1
      }
    },
    { send }
  )
  await expect(
    processMedia(
      Buffer.from('<html>Unrelated site</html>'),
      'text/html',
      storage
    )
  ).rejects.toThrow('document instead of a media file')
  expect(send).not.toHaveBeenCalled()
})

it.each([401, 403])(
  'refreshes a signed URL after HTTP %s before retrying',
  async (status) => {
    const cancel = vi.fn<() => void>()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(new ReadableStream({ cancel }), { status })
      )
      .mockResolvedValueOnce(new Response('refreshed'))
    const refresh = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue('https://example.com/new')
    expect(
      (
        await download('https://example.com/old', refresh, fetcher)
      ).bytes.toString()
    ).toBe('refreshed')
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://example.com/old',
      'https://example.com/new'
    ])
    expect(cancel).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
  }
)

it('caps HTTP backoff and stops after three failed attempts', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () =>
        new Response('busy', { status: 429, headers: { 'retry-after': '60' } })
    )
  await expect(
    download('https://example.com/file', undefined, fetcher)
  ).rejects.toThrow('HTTP 429')
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(
    vi.mocked(delay).mock.calls.map(([milliseconds]) => milliseconds)
  ).toEqual([10_000, 10_000])
})

it('recovers from HTTP 500 with the complete replacement body', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('busy', { status: 500 }))
    .mockResolvedValueOnce(new Response('complete'))
  expect(
    (
      await download('https://example.com/file', undefined, fetcher)
    ).bytes.toString()
  ).toBe('complete')
})

it('rejects an oversized declared body before reading and cancels it', async () => {
  const cancel = vi.fn<() => void>()
  const oversized = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      },
      cancel
    }),
    {
      headers: { 'content-length': String(512 * 1024 * 1024 + 1) }
    }
  )
  const reader = vi.spyOn(oversized.body!, 'getReader')
  await expect(
    download(
      'https://example.com/file',
      undefined,
      vi.fn<typeof fetch>().mockResolvedValue(oversized)
    )
  ).rejects.toThrow('512 MiB')
  expect(cancel).toHaveBeenCalledOnce()
  expect(reader).not.toHaveBeenCalled()
})

it('stops streaming bodies at the received-byte limit and cancels the reader', async () => {
  const cancel = vi.fn<() => void>()
  const chunk = new Uint8Array(1024 * 1024)
  let pulls = 0
  const response = new Response(
    new ReadableStream(
      {
        pull(controller) {
          pulls++
          if (pulls > 513) {
            controller.error(new Error('Received-byte limit was not enforced'))
            return
          }
          controller.enqueue(chunk)
        },
        cancel
      },
      { highWaterMark: 0 }
    )
  )
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
  await expect(
    download('https://example.com/file', undefined, fetcher)
  ).rejects.toThrow('512 MiB')
  expect(pulls).toBe(513)
  expect(cancel).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledOnce()
})
