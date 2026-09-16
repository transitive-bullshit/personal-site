import type { Metadata } from 'next'
import { ArticleIndex } from '@/components/article-index'
import { articles } from '@/lib/content/load'
import { websiteMetadata } from '@/lib/metadata'
import { JsonLd } from '@/components/json-ld'
import { pageJsonLd } from '@/lib/content/metadata'

const description = 'All writing by Travis Fischer.'

export const dynamic = 'force-static'
export const revalidate = 86400

export const metadata: Metadata = websiteMetadata(
  'Writing',
  description,
  '/writing'
)

export default function WritingPage() {
  return (
    <main id='main' className='home'>
      <JsonLd
        data={pageJsonLd(
          'Writing',
          description,
          '/writing',
          articles.map((entry) => ({
            title: entry.title,
            path: '/' + entry.slug
          }))
        )}
      />
      <h1>Writing</h1>
      <p className='home-intro'>
        Software, open source, and the occasional detour.
      </p>
      <ArticleIndex articles={articles} label='All articles' />
    </main>
  )
}
