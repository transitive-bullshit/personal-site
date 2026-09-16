import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { ProjectPage } from '@/components/project'
import { content, projects } from '@/lib/content/load'
import { resolveRoute } from '@/lib/content/routes'
import { site } from '@/lib/site'

export const dynamic = 'force-static'
export const dynamicParams = true
export const revalidate = 604800

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const route = resolveRoute(slug, content.projectRoutes ?? {})
  const project = route && content.projects?.[route.id]
  if (!project) return {}
  const media = project.cover ? content.media[project.cover] : undefined
  const image = media?.variants.at(-1) ?? media?.original
  const images = image
    ? [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: project.title
        }
      ]
    : []
  return {
    title: project.title,
    description: project.description,
    alternates: { canonical: '/project/' + project.slug },
    openGraph: {
      type: 'website',
      title: project.title,
      description: project.description,
      url: site.origin + '/project/' + project.slug,
      siteName: site.name,
      images
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: project.title,
      description: project.description,
      images,
      creator: '@' + site.twitter
    }
  }
}

export default async function Page({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const route = resolveRoute(slug, content.projectRoutes ?? {})
  const project = route && content.projects?.[route.id]
  if (!route || !project) notFound()
  if (route.redirect) permanentRedirect('/project/' + route.slug)
  return <ProjectPage project={project} snapshot={content} />
}
