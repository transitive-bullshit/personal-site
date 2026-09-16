import type { Metadata } from 'next'
import { ArticleIndex } from '@/components/article-index'
import { articles } from '@/lib/content/load'
import { site } from '@/lib/site'

const description = 'All writing by Travis Fischer.'

export const dynamic = 'force-static'
export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Writing',
  description,
  alternates: { canonical: '/writing' },
  openGraph: {
    type: 'website',
    title: 'Writing',
    description,
    url: site.origin + '/writing',
    siteName: site.name
  }
}

export default function WritingPage() {
  return (
    <main id='main' className='home'>
      <h1>Writing</h1>
      <p className='home-intro'>
        Software, open source, and the occasional detour.
      </p>
      <ArticleIndex articles={articles} label='All articles' />
    </main>
  )
}
