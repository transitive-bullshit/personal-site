import Image from 'next/image'
import { ImageLightbox } from './image-lightbox'
import type { Media, Snapshot, Article } from '@/lib/content/schema'

export function MediaImage({
  media,
  alt,
  priority = false,
  sizes = '(max-width: 800px) calc(100vw - 44px), 740px',
  className = 'article-image'
}: {
  media: Media
  alt: string
  priority?: boolean
  sizes?: string
  className?: string
}) {
  const display = media.variants.at(-1) ?? media.original
  return (
    <Image
      src={display.url}
      sizes={sizes}
      placeholder={media.blurDataURL ? 'blur' : 'empty'}
      blurDataURL={media.blurDataURL}
      unoptimized={!media.variants.length}
      width={display.width}
      height={display.height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding='async'
      fetchPriority={priority ? 'high' : undefined}
      className={className}
    />
  )
}

export function NotionIcon({
  icon,
  snapshot
}: {
  icon: Article['icon']
  snapshot: Snapshot
}) {
  if (!icon) return null
  if (icon.type === 'emoji')
    return (
      <span className='notion-icon' aria-hidden='true'>
        {icon.value}
      </span>
    )
  return (
    <MediaImage
      media={snapshot.media[icon.media]!}
      alt=''
      className='notion-icon'
      sizes='32px'
    />
  )
}

export function ZoomableImage({
  media,
  alt,
  caption,
  priority = false
}: {
  media: Media
  alt: string
  caption?: string
  priority?: boolean
}) {
  return (
    <ImageLightbox
      src={(media.variants.at(-1) ?? media.original).url}
      original={media.original.url}
      blurDataURL={media.blurDataURL}
      unoptimized={!media.variants.length}
      width={(media.variants.at(-1) ?? media.original).width}
      height={(media.variants.at(-1) ?? media.original).height}
      alt={alt}
      caption={caption}
    >
      <MediaImage media={media} alt={alt} priority={priority} />
    </ImageLightbox>
  )
}
