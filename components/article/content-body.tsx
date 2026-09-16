import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import type { Article, Project, Snapshot } from '@/lib/content/schema'
import { getHeadings, normalizeHeadingLevels } from '@/lib/content/headings'
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
  const blocks = normalizeHeadingLevels(entry.blocks)
  const headings = getHeadings(blocks)
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
        <Blocks blocks={blocks} snapshot={snapshot} />
        <nav
          className='content-back'
          aria-label='More to explore'
          data-link-preview='false'
        >
          <Link href={'authors' in entry ? '/projects' : '/writing'}>
            <ArrowLeftIcon aria-hidden='true' size={16} />
            {'authors' in entry ? 'All projects' : 'All writing'}
          </Link>
        </nav>
      </div>
      {headings.length ? (
        <aside className='desktop-toc'>
          <TableOfContents headings={headings} />
        </aside>
      ) : null}
    </div>
  )
}
