import type { MetadataRoute } from 'next'
import { articles } from '@/lib/content/load'
import { site } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.origin },
    ...articles.map((article) => ({
      url: site.origin + '/' + article.slug,
      lastModified: article.modified
    }))
  ]
}
