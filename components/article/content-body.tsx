import type { Article, Project, Snapshot } from '@/lib/content/schema'
import { getHeadings } from '@/lib/content/headings'
import { Blocks } from './blocks'
import { ContentCover } from './content-cover'
import { TableOfContents } from './table-of-contents'

export function ContentBody({
  entry,
  snapshot,
  showCover = true
}: {
  entry: Article | Project
  snapshot: Snapshot
  showCover?: boolean
}) {
  const headings = getHeadings(entry.blocks)
  return (
    <div className='article-grid'>
      <div className='article-body' data-link-preview-scope='article'>
        {showCover ? <ContentCover entry={entry} snapshot={snapshot} /> : null}
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
