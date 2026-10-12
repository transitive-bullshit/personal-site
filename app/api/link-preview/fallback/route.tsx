import { fallbackLinkPreview, linkPreviewKind } from '@/lib/link-preview'
import { renderSocialImage } from '@/lib/render-social-image'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const url = params.get('url')
  const title = params.get('title') ?? undefined
  if (!url || url.length > 2048 || (title?.length ?? 0) > 300)
    return new Response('Invalid preview', { status: 400 })
  const preview = fallbackLinkPreview(url, { title })
  if (!preview) return new Response('Invalid preview', { status: 400 })
  // This renderer never fetches the URL or a cover. It draws only local text.
  return renderSocialImage({
    title:
      preview.title.length > 140
        ? preview.title.slice(0, 137) + '…'
        : preview.title,
    description: '',
    siteName: preview.siteName!,
    author: linkPreviewKind(url),
    published: '',
    domain: new URL(url).hostname,
    cover: undefined
  })
}
