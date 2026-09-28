import { createServer } from 'node:http'
import { once } from 'node:events'
import { inspectVideo } from './video'

// Explicitly owned public origins only; never trust arbitrary R2 tenants.
export const HOTLINK_VIDEO_ORIGINS = ['https://assets.cultural-alignment.com']

export function isHotlinkedVideo(url: string) {
  const parsed = new URL(url)
  return (
    HOTLINK_VIDEO_ORIGINS.includes(parsed.origin) &&
    !parsed.username &&
    !parsed.password &&
    !parsed.search &&
    !parsed.hash &&
    /\.(mp4|webm|mov)$/i.test(parsed.pathname)
  )
}

const RANGE_BYTES = 1024 * 1024
export const MAX_VIDEO_INSPECTION_BYTES = 32 * 1024 * 1024

// FFmpeg seeks through a local range bridge. Every upstream request is bounded,
// redirects are forbidden, and servers ignoring Range fail without a full read.
export async function inspectRemoteVideo(url: string, fetcher = fetch) {
  if (!isHotlinkedVideo(url)) throw new Error('Untrusted hotlinked video URL')
  const signal = AbortSignal.timeout(60_000)
  const head = await fetcher(url, { method: 'HEAD', redirect: 'error', signal })
  const bytes = Number(head.headers.get('content-length'))
  const mime = head.headers.get('content-type')?.split(';')[0]?.toLowerCase()
  if (
    !head.ok ||
    !Number.isSafeInteger(bytes) ||
    bytes <= 0 ||
    !mime?.startsWith('video/')
  )
    throw new Error(
      'Hotlinked video requires a video MIME type and content length'
    )
  let inspectedBytes = 0
  let failure: unknown
  const server = createServer(async (request, response) => {
    try {
      const match = /^bytes=(\d+)-(\d*)$/.exec(
        request.headers.range ?? 'bytes=0-'
      )
      if (!match) throw new Error('Invalid video inspection range')
      const start = Number(match[1])
      const end = Math.min(
        bytes - 1,
        start + RANGE_BYTES - 1,
        match[2] ? Number(match[2]) : Infinity
      )
      if (
        start > end ||
        inspectedBytes + end - start + 1 > MAX_VIDEO_INSPECTION_BYTES
      )
        throw new Error('Video inspection exceeds range budget')
      inspectedBytes += end - start + 1
      const upstream = await fetcher(url, {
        headers: {
          Range: `bytes=${start}-${end}`,
          'Accept-Encoding': 'identity'
        },
        redirect: 'error',
        signal
      })
      if (
        upstream.status !== 206 ||
        upstream.headers.get('content-range') !==
          `bytes ${start}-${end}/${bytes}`
      ) {
        await upstream.body?.cancel()
        throw new Error('Hotlinked video server must honor byte ranges')
      }
      if (!upstream.body) throw new Error('Empty video range')
      const reader = upstream.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0
      try {
        for (;;) {
          const chunk = await reader.read()
          if (chunk.done) break
          received += chunk.value.byteLength
          if (received > end - start + 1)
            throw new Error('Oversized video range')
          chunks.push(chunk.value)
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      if (received !== end - start + 1)
        throw new Error('Incomplete video range')
      response.writeHead(206, {
        'Content-Type': mime,
        'Content-Length': received,
        'Content-Range': `bytes ${start}-${end}/${bytes}`,
        'Accept-Ranges': 'bytes'
      })
      response.end(Buffer.concat(chunks))
    } catch (err) {
      failure = err
      response.writeHead(502).end()
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Missing inspection server address')
    const video = await inspectVideo(
      new URL(`http://127.0.0.1:${address.port}/video`)
    )
    if (failure) throw failure
    return { ...video, bytes, mime, inspectedBytes }
  } catch (err) {
    throw failure ?? err
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
