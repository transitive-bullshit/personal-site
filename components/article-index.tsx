import Link from 'next/link'
import type { Article } from '@/lib/content/schema'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

export function ArticleIndex({
  articles,
  label
}: {
  articles: readonly Article[]
  label: string
}) {
  return (
    <ol className='article-index' aria-label={label}>
      {articles.map((article) => (
        <li key={article.id}>
          <time dateTime={article.published}>
            {dateFormatter.format(new Date(article.published))}
          </time>
          <Link href={'/' + article.slug}>{article.title}</Link>
        </li>
      ))}
    </ol>
  )
}
