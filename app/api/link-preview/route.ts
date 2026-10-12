import { fetchBookmarkPage } from '@/scripts/bookmarks'
import type { LinkPreviewData } from '@/lib/link-preview'
import { getSavedLinkPreview } from '@/lib/saved-link-previews'
import { fallbackLinkPreview } from '@/lib/link-preview'
import { validatePublicUrl } from '@/scripts/public-fetch'

export const runtime = 'nodejs'

const cacheHeaders = {
  'Cache-Control':
    'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('url')
  if (!requested || requested.length > 2048)
    return Response.json({ error: 'Invalid URL' }, { status: 400 })

  const saved = getSavedLinkPreview(requested)
  if (saved) return Response.json(saved, { headers: cacheHeaders })

  try {
    const preview = await fetchBookmarkPage(requested)
    const imageUrl = preview.images.find(
      (candidate) => candidate.length <= 2048
    )
    const data: LinkPreviewData = {
      url: preview.url,
      title: preview.title.slice(0, 300) || new URL(preview.url).hostname,
      description: preview.description.slice(0, 600) || undefined,
      image: imageUrl
        ? '/api/link-preview/image?url=' + encodeURIComponent(imageUrl)
        : fallbackLinkPreview(preview.url, preview)?.image
    }
    return Response.json(data, { headers: cacheHeaders })
  } catch {
    try {
      await validatePublicUrl(new URL(requested))
      const fallback = fallbackLinkPreview(requested)
      if (fallback)
        return Response.json(fallback, {
          headers: { 'Cache-Control': 'private, no-store' }
        })
    } catch {
      // Keep private addresses and unsupported URLs outside the fetch boundary.
    }
    return Response.json(
      { error: 'Preview unavailable' },
      { status: 422, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}
