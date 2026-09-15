import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { ArticleIndex } from '@/components/article-index'
import { featuredArticles } from '@/lib/content/load'

export default function HomePage() {
  return (
    <main id='main' className='home'>
      <h1>
        Building things.
        <br />
        Sharing what I learn.
      </h1>
      <p className='home-intro'>
        Travis Fischer. Software, open source, and the occasional detour.
      </p>
      <ArticleIndex articles={featuredArticles} label='Featured articles' />
      <Link className='all-writing-link' href='/writing'>
        View all writing
        <ArrowRightIcon aria-hidden='true' />
      </Link>
    </main>
  )
}
