import Image from 'next/image'
import { ImageLightbox } from '../image-lightbox'

export function EssayImage({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false
}: {
  src: `/essays/cyber-swarm/${string}`
  alt: string
  width: number
  height: number
  sizes?: string
  priority?: boolean
}) {
  return (
    <ImageLightbox
      src={src}
      original={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized={false}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding='async'
      />
    </ImageLightbox>
  )
}
