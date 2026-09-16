import type { Article, Project, Snapshot } from '@/lib/content/schema'
import { getHeadings } from '@/lib/content/headings'
import { Blocks } from './blocks'
import { ZoomableImage } from './media'
import { TableOfContents } from './table-of-contents'

export function ContentBody({
  entry,
  snapshot
}: {
  entry: Article | Project
  snapshot: Snapshot
}) {
  const headings = getHeadings(entry.blocks)
  return (
    <div className='article-grid'>
      <div className='article-body' data-link-preview-scope='article'>
        {entry.cover ? (
          <figure className='article-cover'>
            <ZoomableImage
              media={snapshot.media[entry.cover]!}
              alt={entry.title}
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
        <Blocks blocks={entry.blocks} snapshot={snapshot} />
      </div>
      {headings.length ? (
        <aside className='desktop-toc'>
          <TableOfContents headings={headings} />
        </aside>
      ) : null}
    </div>
  )
}
