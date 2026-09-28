'use client'

import { useRef, useState } from 'react'
import { PlayIcon } from 'lucide-react'
import type { Media } from '@/lib/content/schema'
import { MediaImage } from './article/media'

export function ProjectHeroVideo({
  media,
  cover,
  title
}: {
  media: Media
  cover?: Media
  title: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const poster = cover
    ? (cover.variants.at(-1) ?? cover.original).url
    : media.poster?.url

  return (
    <div className='project-hero-video'>
      <video
        ref={video}
        controls
        tabIndex={started || error ? 0 : -1}
        playsInline
        preload='none'
        aria-label={title}
        width={media.original.width}
        height={media.original.height}
        style={{
          aspectRatio: `${media.original.width ?? 16} / ${media.original.height ?? 9}`
        }}
        poster={poster}
        src={media.original.url}
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
          aria-label={`Play ${title}`}
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
        </button>
      ) : null}
      {error ? (
        <a href={media.original.url}>Unable to play video. Download video</a>
      ) : null}
    </div>
  )
}
