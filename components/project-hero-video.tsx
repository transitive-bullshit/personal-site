'use client'

import { useEffect, useRef, useState } from 'react'
import { PlayIcon } from 'lucide-react'
import type { Media } from '@/lib/content/schema'
import { MediaImage } from './article/media'

export function ProjectHeroVideo({
  media,
  cover,
  title,
  className = 'project-hero-video'
}: {
  media: Media
  cover?: Media
  title: string
  className?: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState<number>()
  const [started, setStarted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const poster = cover
    ? (cover.variants.at(-1) ?? cover.original).url
    : media.poster?.url

  // Metadata can finish loading before hydration attaches event handlers.
  useEffect(() => {
    if (video.current) setDuration(readDuration(video.current))
  }, [])

  return (
    <div className={className}>
      <video
        ref={video}
        controls
        tabIndex={started || error ? 0 : -1}
        playsInline
        preload='metadata'
        aria-label={title}
        width={media.original.width}
        height={media.original.height}
        style={{
          aspectRatio:
            media.original.width && media.original.height
              ? `${media.original.width} / ${media.original.height}`
              : undefined
        }}
        poster={poster}
        src={media.original.url}
        onLoadedMetadata={(event) =>
          setDuration(readDuration(event.currentTarget))
        }
        onDurationChange={(event) =>
          setDuration(readDuration(event.currentTarget))
        }
        onPlaying={() => {
          if (video.current?.parentElement?.contains(document.activeElement)) {
            video.current.focus()
          }
          setStarted(true)
          setPending(false)
        }}
        onError={() => {
          setPending(false)
          setError(true)
        }}
      >
        <a href={media.original.url}>Download video</a>
      </video>
      {!started && !error ? (
        <button
          type='button'
          className='project-hero-play'
          aria-label={
            duration
              ? `Play ${title}, ${spokenDuration(duration)}`
              : `Play ${title}`
          }
          aria-busy={pending}
          aria-disabled={pending}
          onClick={async () => {
            if (pending) return
            setPending(true)
            try {
              await video.current?.play()
            } catch {
              setPending(false)
              setError(true)
            }
          }}
        >
          {cover ? (
            <MediaImage
              media={cover}
              alt=''
              priority
              reuseLoadedImage
              className='project-hero-poster'
            />
          ) : null}
          <span className='project-hero-play-icon'>
            <PlayIcon aria-hidden='true' fill='currentColor' />
          </span>
          {duration ? (
            <span className='video-duration' aria-hidden='true'>
              {formatDuration(duration)}
            </span>
          ) : null}
        </button>
      ) : null}
      {error ? (
        <a href={media.original.url}>Unable to play video. Download video</a>
      ) : null}
    </div>
  )
}

function readDuration(video: HTMLVideoElement) {
  return Number.isFinite(video.duration) && video.duration > 0
    ? video.duration
    : undefined
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
    : `${minutes}:${secs}`
}

function spokenDuration(seconds: number) {
  const total = Math.max(1, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return [
    minutes ? `${minutes} minute${minutes === 1 ? '' : 's'}` : '',
    secs ? `${secs} second${secs === 1 ? '' : 's'}` : ''
  ]
    .filter(Boolean)
    .join(' ')
}
