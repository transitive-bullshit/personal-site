import type { Block, Snapshot } from '@/lib/content/schema'
import { isExternalSiteLink, site } from '@/lib/site'
import Image from 'next/image'
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
  const external = isExternalSiteLink(block.url)
  return (
    <figure id={block.id} className='bookmark'>
      <a
        className='bookmark-card'
        href={block.url}
        data-link-preview='false'
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        <span className='bookmark-copy'>
          <span className='bookmark-title'>
            {preview?.title || block.url.replace(/^https?:\/\//, '')}
          </span>
          {preview?.description ? (
            <span className='bookmark-description'>{preview.description}</span>
          ) : null}
          <span className='bookmark-host'>
            {new URL(block.url, site.origin).hostname}
          </span>
        </span>
        {preview?.image ? (
          <MediaImage
            media={preview.image}
            alt=''
            className='bookmark-image'
            sizes='(max-width: 600px) 100px, 180px'
          />
        ) : preview?.screenshot ? (
          <Image
            src={preview.screenshot.url}
            width={preview.screenshot.width}
            height={preview.screenshot.height}
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
