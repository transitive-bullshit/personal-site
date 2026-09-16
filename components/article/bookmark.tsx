import type { Block, Snapshot } from '@/lib/content/schema'
import { MediaImage } from './media'
import { RichText } from './rich-text'

export function Bookmark({
  block,
  snapshot
}: {
  block: Extract<Block, { type: 'bookmark' }>
  snapshot: Snapshot
}) {
  const preview = snapshot.bookmarks?.[block.url]
  return (
    <figure id={block.id} className='bookmark'>
      <a className='bookmark-card' href={block.url} data-link-preview='false'>
        <span className='bookmark-copy'>
          <span className='bookmark-title'>
            {preview?.title || block.url.replace(/^https?:\/\//, '')}
          </span>
          {preview?.description ? (
            <span className='bookmark-description'>{preview.description}</span>
          ) : null}
          <span className='bookmark-host'>{new URL(block.url).hostname}</span>
        </span>
        {preview?.image ? (
          <MediaImage
            media={preview.image}
            alt=''
            className='bookmark-image'
            sizes='(max-width: 600px) 100px, 180px'
          />
        ) : null}
      </a>
      {block.caption.length ? (
        <figcaption>
          <RichText spans={block.caption} />
        </figcaption>
      ) : null}
    </figure>
  )
}
