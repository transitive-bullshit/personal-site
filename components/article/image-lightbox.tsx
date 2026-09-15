'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

export function ImageLightbox({
  children,
  src,
  original,
  alt,
  caption = '',
  width,
  height,
  blurDataURL,
  unoptimized
}: {
  children: ReactNode
  src: string
  original: string
  alt: string
  caption?: string
  width?: number
  height?: number
  blurDataURL?: string
  unoptimized: boolean
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type='button'
          className='image-lightbox-trigger'
          aria-label={alt ? 'Enlarge image: ' + alt : 'Enlarge image'}
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className='image-lightbox'>
        <DialogTitle className='sr-only'>{alt || 'Image preview'}</DialogTitle>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes='(max-width: 1472px) calc(100vw - 80px), 1392px'
          loading='eager'
          placeholder={blurDataURL ? 'blur' : 'empty'}
          blurDataURL={blurDataURL}
          unoptimized={unoptimized}
          className='lightbox-image'
        />
        <DialogDescription className={caption ? 'lightbox-caption' : 'sr-only'}>
          {caption || 'Enlarged article image'}
        </DialogDescription>
        <a
          href={original}
          target='_blank'
          rel='noreferrer'
          className='lightbox-original'
        >
          Open original image
        </a>
      </DialogContent>
    </Dialog>
  )
}
