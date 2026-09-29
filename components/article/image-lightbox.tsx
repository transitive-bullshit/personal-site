'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

const motion = { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

type LightboxImage = {
  src: string
  original: string
  alt: string
  width?: number
  height?: number
  blurDataURL?: string
  unoptimized: boolean
}

type GalleryImage = LightboxImage & { trigger: HTMLButtonElement }

// Resolve mounted images in article DOM order, including covers and nested blocks.
const images = new WeakMap<HTMLButtonElement, LightboxImage>()

export function ImageLightbox({
  children,
  ...image
}: LightboxImage & { children: ReactNode }) {
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [index, setIndex] = useState(0)
  const { src, original, alt, width, height, unoptimized } =
    gallery[index] ?? image
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(image.src)
  const [ready, setReady] = useState(false)
  const [download, setDownload] = useState<
    'idle' | 'loading' | 'done' | 'error'
  >('idle')
  const trigger = useRef<HTMLButtonElement>(null)
  const frame = useRef<HTMLButtonElement | null>(null)
  const origin = useRef<DOMRect | null>(null)
  const animation = useRef<Animation | null>(null)
  const closing = useRef(false)
  const downloading = useRef(false)
  const downloadVersion = useRef(0)
  const dismissedWithEscape = useRef(false)

  const transformFrom = (target: DOMRect, source: DOMRect) =>
    `translate(${source.x - target.x}px, ${source.y - target.y}px) scale(${source.width / target.width}, ${source.height / target.height})`

  const mountFrame = useCallback((node: HTMLButtonElement | null) => {
    frame.current = node
    if (!node || !origin.current || reducedMotion()) return
    animation.current = node.animate(
      [
        {
          transform: transformFrom(node.getBoundingClientRect(), origin.current)
        },
        { transform: 'none' }
      ],
      motion
    )
    return () => {
      animation.current?.cancel()
    }
  }, [])

  function changeOpen(next: boolean) {
    if (next) {
      const buttons = trigger.current
        ?.closest('article')
        ?.querySelectorAll<HTMLButtonElement>('.image-lightbox-trigger')
      const entries = Array.from(buttons ?? []).flatMap((button) => {
        const data = images.get(button)
        return data ? [{ ...data, trigger: button }] : []
      })
      setGallery(entries)
      setIndex(
        Math.max(
          0,
          entries.findIndex((entry) => entry.trigger === trigger.current)
        )
      )
      const inline = trigger.current?.querySelector('img')
      origin.current = inline?.getBoundingClientRect() ?? null
      setPreview(inline?.currentSrc || image.blurDataURL || image.src)
      setReady(false)
      resetDownload()
      dismissedWithEscape.current = false
      closing.current = false
      setOpen(true)
    } else if (!closing.current) {
      closing.current = true
      const node = frame.current
      const destination = (gallery[index]?.trigger ?? trigger.current)
        ?.querySelector('img')
        ?.getBoundingClientRect()
      if (
        node &&
        destination &&
        destination.bottom > 0 &&
        destination.top < window.innerHeight &&
        !reducedMotion()
      ) {
        const current = getComputedStyle(node).transform
        animation.current?.cancel()
        const end = transformFrom(node.getBoundingClientRect(), destination)
        animation.current = node.animate(
          [{ transform: current }, { transform: end }],
          { ...motion, fill: 'forwards' }
        )
        void animation.current.finished.then(
          () => setOpen(false),
          () => setOpen(false)
        )
      } else setOpen(false)
    }
  }

  function resetDownload() {
    downloadVersion.current++
    downloading.current = false
    setDownload('idle')
  }

  function navigate(direction: number) {
    if (closing.current || gallery.length < 2) return
    const next = index + direction
    const entry = gallery[next]
    if (!entry) return
    animation.current?.cancel()
    setPreview(
      entry.trigger.querySelector('img')?.currentSrc ||
        entry.blurDataURL ||
        entry.src
    )
    setReady(false)
    resetDownload()
    setIndex(next)
  }

  async function downloadImage() {
    if (downloading.current) return
    downloading.current = true
    const version = downloadVersion.current
    setDownload('loading')
    try {
      const filename = new URL(original).pathname.split('/').at(-1)!
      const response = await fetch(`/api/media-download/${filename}`, {
        signal: AbortSignal.timeout(60_000)
      })
      if (!response.ok) throw new Error('Download failed')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `${
        alt
          .replace(/[^a-zA-Z0-9 _-]/g, '')
          .trim()
          .slice(0, 80) || 'image'
      }.${filename.split('.').at(-1)}`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      if (version === downloadVersion.current) setDownload('done')
    } catch {
      if (version === downloadVersion.current) setDownload('error')
    } finally {
      if (version === downloadVersion.current) downloading.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button
          ref={(node) => {
            trigger.current = node
            if (node) images.set(node, image)
          }}
          type='button'
          className='image-lightbox-trigger'
          aria-label={
            image.alt ? 'Enlarge image: ' + image.alt : 'Enlarge image'
          }
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent
        className='image-lightbox'
        overlayClassName='image-lightbox-overlay'
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            navigate(event.key === 'ArrowLeft' ? -1 : 1)
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) changeOpen(false)
        }}
        onEscapeKeyDown={() => {
          dismissedWithEscape.current = true
        }}
        onCloseAutoFocus={(event) => {
          if (dismissedWithEscape.current) {
            event.preventDefault()
            trigger.current?.blur()
          }
        }}
      >
        <DialogTitle className='sr-only'>{alt || 'Image preview'}</DialogTitle>
        <button
          ref={mountFrame}
          type='button'
          className='lightbox-frame'
          aria-label={alt ? 'Zoom out image: ' + alt : 'Zoom out image'}
          onClick={() => changeOpen(false)}
          style={
            { '--image-ratio': (width || 1) / (height || 1) } as CSSProperties
          }
        >
          {/* Reuse the browser's decoded inline resource while the larger image loads. */}
          <img
            src={preview}
            alt={ready ? '' : alt}
            aria-hidden={ready}
            className='lightbox-image lightbox-preview'
          />
          <Image
            key={`${index}:${src}`}
            aria-hidden={!ready}
            src={src}
            alt={alt}
            fill
            sizes='(max-width: 600px) calc(100vw - 24px), (max-width: 1488px) calc(100vw - 48px), 1440px'
            loading='eager'
            unoptimized={unoptimized}
            onLoad={() => setReady(true)}
            className='lightbox-image lightbox-full'
            style={{
              opacity: ready ? 1 : 0,
              pointerEvents: ready ? 'auto' : 'none'
            }}
          />
        </button>
        <DialogDescription className='sr-only'>
          Enlarged article image.
          {gallery.length > 1
            ? ' Use the left and right arrow keys to navigate images.'
            : ''}
        </DialogDescription>
        <div className='lightbox-actions'>
          {gallery.length > 1 && (
            <>
              <button
                type='button'
                className='lightbox-navigation'
                aria-label='Previous image'
                disabled={index === 0}
                onClick={() => navigate(-1)}
              >
                <ChevronLeft size={20} aria-hidden='true' />
              </button>
              <span
                className='lightbox-position'
                aria-live='polite'
                aria-atomic='true'
              >
                {index + 1} / {gallery.length}
              </span>
              <button
                type='button'
                className='lightbox-navigation'
                aria-label='Next image'
                disabled={index === gallery.length - 1}
                onClick={() => navigate(1)}
              >
                <ChevronRight size={20} aria-hidden='true' />
              </button>
            </>
          )}
          <button
            type='button'
            className='lightbox-download'
            onClick={() => void downloadImage()}
            disabled={download === 'loading'}
            data-state={download}
          >
            <span className='lightbox-download-icon' key={download}>
              {download === 'done' ? (
                <Check size={16} />
              ) : download === 'loading' ? (
                <LoaderCircle size={16} />
              ) : (
                <Download size={16} />
              )}
            </span>
            <span aria-live='polite'>
              {download === 'loading'
                ? 'Downloading…'
                : download === 'done'
                  ? 'Download started'
                  : download === 'error'
                    ? 'Retry download'
                    : 'Download image'}
            </span>
          </button>
        </div>
        {download === 'error' && (
          <p className='lightbox-download-error' role='alert'>
            Download failed. Please try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
