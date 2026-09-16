import { content } from '@/lib/content/load'
import { compactId, resolveRoute } from '@/lib/content/routes'
import { socialImagePath } from '@/lib/social-image'

// Preserve links shared by the former Notion site without redirecting unknown
// or unpublished IDs to unrelated images.
export function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  const route = id && resolveRoute(compactId(id), content.routes)
  if (!route) return new Response('Article not found', { status: 404 })
  return new Response(null, {
    status: 308,
    headers: {
      Location: socialImagePath(content.articles[route.id]!, content)
    }
  })
}
