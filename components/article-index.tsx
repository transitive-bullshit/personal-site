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
    <ol
      className='article-index'
      aria-label={label}
      data-link-preview-scope='internal'
    >
      {articles.map((article) => (
        <li key={article.id}>
          <Link href={'/' + article.slug}>
            <time dateTime={article.published}>
              {dateFormatter.format(new Date(article.published))}
            </time>
            <span className='article-index-title'>{article.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
