import { articles, content, projects } from '@/lib/content/load'
import { entryMarkdown, indexMarkdown } from '@/lib/content/markdown'
import { markdownPath } from '@/lib/content/markdown-path'
import { resolveRoute } from '@/lib/content/routes'
import { site } from '@/lib/site'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return [
    { path: ['index'] },
    { path: ['projects'] },
    { path: ['writing'] },
    ...articles.map(({ slug }) => ({ path: [slug] })),
    ...projects.map(({ slug }) => ({ path: ['projects', slug] }))
  ]
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const headers = { 'Content-Type': 'text/markdown; charset=utf-8' }
  const name = path.join('/')
  if (['index', 'writing', 'projects'].includes(name)) {
    const canonical =
      name === 'index' ? '/' : (('/' + name) as '/writing' | '/projects')
    return new Response(indexMarkdown(canonical, articles, projects), {
      headers: {
        ...headers,
        Link: `<${site.origin}${canonical}>; rel="canonical"`
      }
    })
  }
  const project = path.length === 2 && path[0] === 'projects'
  const route =
    (path.length === 1 || project) &&
    resolveRoute(
      path.at(-1)!,
      project ? (content.projectRoutes ?? {}) : content.routes
    )
  const entry =
    route &&
    (project ? content.projects?.[route.id] : content.articles[route.id])
  if (!route || !entry) {
    return new Response(
      `# Page not found\n\nTry [Projects](${site.origin}/projects.md), [Writing](${site.origin}/writing.md), or the [agent guide](${site.origin}/llms.txt).\n`,
      {
        status: 404,
        headers: {
          ...headers,
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex'
        }
      }
    )
  }
  const canonical = (project ? '/projects/' : '/') + route.slug
  if (route.redirect)
    return new Response(null, {
      status: 308,
      headers: { Location: markdownPath(canonical) }
    })
  return new Response(entryMarkdown(entry, content), {
    headers: {
      ...headers,
      Link: `<${site.origin}${canonical}>; rel="canonical"`
    }
  })
}
