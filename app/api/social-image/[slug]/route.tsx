import { content } from '@/lib/content/load'
import { resolveRoute } from '@/lib/content/routes'
import { socialImageData } from '@/lib/social-image'
import { renderSocialImage } from '@/lib/render-social-image'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const route = resolveRoute(slug, content.routes)
  if (!route) return new Response('Article not found', { status: 404 })
  return renderSocialImage(
    socialImageData(content.articles[route.id]!, content)
  )
}
