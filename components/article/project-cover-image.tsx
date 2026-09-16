'use client'

import Image, { type ImageProps } from 'next/image'
import { useState, useSyncExternalStore } from 'react'

// Browser-only observations, not image bytes. Keep the exact responsive URL
// that has finished decoding so a larger rendition can replace it progressively.
const loaded = new Map<string, { url: string; width: number }>()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const serverSnapshot = () => undefined

export function ProjectCoverImage(props: ImageProps & { src: string }) {
  const previous = useSyncExternalStore(
    subscribe,
    () => loaded.get(props.src)?.url,
    serverSnapshot
  )
  const [ready, setReady] = useState(false)

  return (
    <Image
      {...props}
      placeholder={previous ? 'empty' : props.placeholder}
      style={
        previous && !ready
          ? {
              ...props.style,
              backgroundImage: `url(${JSON.stringify(previous)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }
          : props.style
      }
      onLoad={(event) => {
        const image = event.currentTarget
        if (image.naturalWidth > 0 && image.currentSrc) {
          const existing = loaded.get(props.src)
          if (!existing || image.naturalWidth >= existing.width) {
            loaded.delete(props.src)
            loaded.set(props.src, {
              url: image.currentSrc,
              width: image.naturalWidth
            })
            if (loaded.size > 64) loaded.delete(loaded.keys().next().value!)
            for (const listener of listeners) listener()
          }
          setReady(true)
        }
        props.onLoad?.(event)
      }}
    />
  )
}
