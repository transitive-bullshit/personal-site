import { afterEach, expect, it, vi } from 'vitest'
import { download, processMedia } from '../scripts/media/process'
import { MediaStorage, type StorageTransport } from '../scripts/media/storage'

afterEach(() => vi.unstubAllGlobals())

it('retries a transient network error while downloading required media', async () => {
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
})

it('retries a connection lost halfway through the response body', async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new TypeError('terminated'))
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
