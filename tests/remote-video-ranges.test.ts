import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { inspectRemoteVideo } from '../scripts/media/remote-video'
import { inspectVideo } from '../scripts/media/video'

// The inspector's seeks are controlled here; remote-video.test.ts retains real FFmpeg decoding.
vi.mock('../scripts/media/video', () => ({
  inspectVideo: vi.fn<typeof import('../scripts/media/video').inspectVideo>()
}))
const url = 'https://assets.cultural-alignment.com/fixture/video.mp4'
const inspected: Awaited<ReturnType<typeof inspectVideo>> = {
  width: 160,
  height: 90,
  poster: {
    data: Buffer.from('poster'),
    info: {
      width: 160,
      height: 90,
      channels: 3,
      format: 'webp',
      size: 6,
      premultiplied: false,
      hasAlpha: false
    }
  }
}
beforeEach(() => {
  vi.mocked(inspectVideo).mockReset()
})
afterEach(() => vi.restoreAllMocks())

function localUrl(value: Buffer | URL) {
  if (!(value instanceof URL)) throw new Error('Expected local range URL')
  return value
}

function remote(bytes: number, body?: (size: number) => Uint8Array) {
  return vi.fn<typeof fetch>(async (_url, options) => {
    options?.signal?.throwIfAborted()
    if (options?.method === 'HEAD')
      return new Response(null, {
        headers: {
          'content-type': 'video/mp4',
          'content-length': String(bytes)
        }
      })
    const range = new Headers(options?.headers).get('range')!
    const [, first, last] = /^bytes=(\d+)-(\d+)$/.exec(range)!
    const size = Number(last) - Number(first) + 1
    return new Response(
      new Uint8Array(body ? body(size) : new Uint8Array(size)),
      {
        status: 206,
        headers: { 'content-range': `bytes ${first}-${last}/${bytes}` }
      }
    )
  })
}

it.each([
  ['Oversized', 5],
  ['Incomplete', 3]
])('rejects an %s range body', async (message, length) => {
  const fetcher = remote(4, () => new Uint8Array(length))
  vi.mocked(inspectVideo).mockImplementation(async (local) => {
    await fetch(localUrl(local))
    return inspected
  })
  await expect(inspectRemoteVideo(url, fetcher)).rejects.toThrow(
    message + ' video range'
  )
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('rejects mismatched content ranges and cancels the upstream body', async () => {
  const cancel = vi.fn<() => void>()
  const fetcher = remote(4)
  fetcher
    .mockResolvedValueOnce(
      new Response(null, {
        headers: { 'content-type': 'video/mp4', 'content-length': '4' }
      })
    )
    .mockResolvedValueOnce(
      new Response(new ReadableStream({ cancel }), {
        status: 206,
        headers: { 'content-range': 'bytes 1-3/4' }
      })
    )
  vi.mocked(inspectVideo).mockImplementation(async (local) => {
    await fetch(localUrl(local))
    return inspected
  })
  await expect(inspectRemoteVideo(url, fetcher)).rejects.toThrow(
    'must honor byte ranges'
  )
  expect(cancel).toHaveBeenCalledOnce()
})

it('limits each upstream range to 1 MiB and all seeks to 32 MiB', async () => {
  const fetcher = remote(100 * 1024 * 1024)
  vi.mocked(inspectVideo).mockImplementation(async (local) => {
    for (let index = 0; index <= 32; index++) {
      const response = await fetch(localUrl(local), {
        headers: { Range: `bytes=${index * 1024 * 1024}-` }
      })
      await response.arrayBuffer()
      if (!response.ok) break
    }
    return inspected
  })
  await expect(inspectRemoteVideo(url, fetcher)).rejects.toThrow('range budget')
  const ranges = fetcher.mock.calls
    .slice(1)
    .map(([, options]) => new Headers(options?.headers).get('range'))
  expect(ranges).toEqual(
    Array.from(
      { length: 32 },
      (_, index) =>
        `bytes=${index * 1024 * 1024}-${(index + 1) * 1024 * 1024 - 1}`
    )
  )
})

it('rejects invalid inspection ranges before requesting upstream data', async () => {
  const fetcher = remote(4)
  vi.mocked(inspectVideo).mockImplementation(async (local) => {
    await fetch(localUrl(local), { headers: { Range: 'bytes=invalid' } })
    return inspected
  })
  await expect(inspectRemoteVideo(url, fetcher)).rejects.toThrow(
    'Invalid video inspection range'
  )
  expect(fetcher).toHaveBeenCalledOnce()
})

it('passes the 60-second deadline through HEAD and range requests and propagates expiry', async () => {
  const controller = new AbortController()
  const timeout = vi
    .spyOn(AbortSignal, 'timeout')
    .mockReturnValue(controller.signal)
  const fetcher = remote(4)
  vi.mocked(inspectVideo).mockImplementation(async (local) => {
    controller.abort(new DOMException('Inspection expired', 'TimeoutError'))
    // A separate signal lets the local probe reach the bridge after upstream expiry.
    await fetch(localUrl(local), { signal: new AbortController().signal })
    return inspected
  })
  await expect(inspectRemoteVideo(url, fetcher)).rejects.toThrow(
    'Inspection expired'
  )
  expect(timeout).toHaveBeenCalledWith(60_000)
  expect(fetcher.mock.calls.map(([, options]) => options?.signal)).toEqual([
    controller.signal,
    controller.signal
  ])
})
