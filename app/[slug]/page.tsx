import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { ArticlePage } from '@/components/article/article'
import { content } from '@/lib/content/load'
import { resolveRoute } from '@/lib/content/routes'
import { site } from '@/lib/site'

export const dynamic = 'force-static'
export const dynamicParams = true

export function generateStaticParams() {
  return Object.values(content.articles).map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const route = resolveRoute(slug, content.routes)
  if (!route) return {}
  const article = content.articles[route.id]!
  const image = article.cover
    ? content.media[article.cover]?.original
    : undefined
  const images = image
    ? [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: article.title
        }
      ]
    : []
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: '/' + article.slug },
    authors: [{ name: article.author }],
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      url: site.origin + '/' + article.slug,
      siteName: site.name,
      publishedTime: article.published,
      modifiedTime: article.modified,
      authors: [article.author],
      tags: article.tags,
      images
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
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
  if (slug === 'transitivebullshit') permanentRedirect('/')
  const route = resolveRoute(slug, content.routes)
  if (!route) notFound()
  if (route.redirect) permanentRedirect('/' + route.slug)
  return (
    <ArticlePage article={content.articles[route.id]!} snapshot={content} />
  )
}
