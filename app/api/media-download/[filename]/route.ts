import { content } from '@/lib/content/load'

// Only synced originals are downloadable; this is not an arbitrary URL proxy.
const originals = new Map(
  Object.values(content.media).map(({ original }) => [
    original.key.split('/').at(-1),
    original
  ])
)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const asset = originals.get(filename)
  if (!asset) return new Response('Image not found', { status: 404 })
  try {
    const response = await fetch(asset.url, {
      signal: AbortSignal.timeout(30_000),
      redirect: 'error'
    })
    if (!response.ok || !response.body) throw new Error('Image unavailable')
    return new Response(response.body, {
      headers: {
        'Content-Type': asset.mime,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch {
    return new Response('Image unavailable', { status: 502 })
  }
}
