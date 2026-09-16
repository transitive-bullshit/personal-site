import { publicFetch } from '@/scripts/public-fetch'

export const runtime = 'nodejs'

const maxImageBytes = 4 * 1024 * 1024
const allowedTypes = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
])

async function readBounded(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty image')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.length
      if (length > maxImageBytes) throw new Error('Image too large')
      chunks.push(chunk.value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.length
  }
  return body
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('url')
  if (!requested || requested.length > 2048)
    return new Response('Invalid URL', { status: 400 })

  try {
    const response = await publicFetch(requested, {
      signal: AbortSignal.timeout(15_000)
    })
    const type = response.headers.get('content-type')?.split(';')[0]?.trim()
    const declaredLength = Number(response.headers.get('content-length'))
    if (
      !response.ok ||
      !type ||
      !allowedTypes.has(type) ||
      (Number.isFinite(declaredLength) && declaredLength > maxImageBytes)
    ) {
      await response.body?.cancel()
      return new Response('Image unavailable', { status: 422 })
    }
    const body = await readBounded(response)
    return new Response(body, {
      headers: {
        'Cache-Control':
          'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
        'Content-Length': String(body.length),
        'Content-Type': type,
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch {
    return new Response('Image unavailable', {
      status: 422,
      headers: { 'Cache-Control': 'private, no-store' }
    })
  }
}
