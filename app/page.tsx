import Link from 'next/link'
import { articles } from '@/lib/content/load'

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
      <ol className='article-index' aria-label='Articles'>
        {articles.map((article) => (
          <li key={article.id}>
            <time dateTime={article.published}>
              {new Date(article.published).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC'
              })}
            </time>
            <Link href={'/' + article.slug} prefetch={false}>
              {article.title}
            </Link>
          </li>
        ))}
      </ol>
    </main>
  )
}
