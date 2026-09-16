import type { MetadataRoute } from 'next'
import { articles, projects } from '@/lib/content/load'
import { site } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.origin },
    { url: site.origin + '/writing' },
    { url: site.origin + '/projects' },
    ...projects.map((project) => ({
      url: site.origin + '/project/' + project.slug,
      lastModified: project.modified
    })),
    ...articles.map((article) => ({
      url: site.origin + '/' + article.slug,
      lastModified: article.modified
    }))
  ]
}
