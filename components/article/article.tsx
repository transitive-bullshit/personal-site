import type { Article, Snapshot } from '@/lib/content/schema'
import { articleJsonLd, serializeJsonLd } from '@/lib/content/metadata'
import { ContentBody } from './content-body'

export function ArticlePage({
  article,
  snapshot
}: {
  article: Article
  snapshot: Snapshot
}) {
  return (
    <main id='main'>
      <article>
        <header className='article-header'>
          <h1>{article.title}</h1>
          {article.description ? (
            <p className='article-description'>{article.description}</p>
          ) : null}
          <div className='article-meta'>
            <span>{article.author}</span>
            <time dateTime={article.published}>
              {new Date(article.published).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC'
              })}
            </time>
          </div>
        </header>
        <ContentBody entry={article} snapshot={snapshot} />
      </article>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(articleJsonLd(article, snapshot))
        }}
      />
    </main>
  )
}
