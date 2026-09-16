import type { Article, Snapshot } from '@/lib/content/schema'
import { getHeadings } from '@/lib/content/headings'
import { articleJsonLd, serializeJsonLd } from '@/lib/content/metadata'
import { Blocks } from './blocks'
import { ZoomableImage } from './media'
import { TableOfContents } from './table-of-contents'

export function ArticlePage({
  article,
  snapshot
}: {
  article: Article
  snapshot: Snapshot
}) {
  const headings = getHeadings(article.blocks)
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
        <div className='article-grid'>
          <div className='article-body' data-link-preview-scope='article'>
            {article.cover ? (
              <figure className='article-cover'>
                <ZoomableImage
                  media={snapshot.media[article.cover]!}
                  alt={article.title}
                  priority
                />
              </figure>
            ) : null}
            {headings.length ? (
              <details className='mobile-toc'>
                <summary>On this page</summary>
                <TableOfContents headings={headings} title={false} />
              </details>
            ) : null}
            <Blocks blocks={article.blocks} snapshot={snapshot} />
          </div>
          {headings.length ? (
            <aside className='desktop-toc'>
              <TableOfContents headings={headings} />
            </aside>
          ) : null}
        </div>
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
