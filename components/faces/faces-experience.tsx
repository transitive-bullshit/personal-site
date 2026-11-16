'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FacesPortrait } from '@/lib/faces/faces-stage'

// WebGPU and the compute simulation only exist in the browser.
const FacesCanvas = dynamic(() => import('./faces-canvas'), { ssr: false })

type GpuNavigator = Navigator & {
  gpu?: { requestAdapter(): Promise<unknown> }
}

/** `?portrait=slug` shows only the prepared portrait in `/faces/slug`. */
function portraitOverride(
  portraits: readonly FacesPortrait[]
): readonly FacesPortrait[] {
  const slug = new URLSearchParams(window.location.search).get('portrait')
  const [first] = portraits
  return first && slug && /^[a-z0-9-]+$/.test(slug)
    ? [{ ...first, id: slug, directory: `/faces/${slug}` }]
    : portraits
}

export function FacesExperience({
  portraits,
  showDebug = false
}: {
  portraits: readonly FacesPortrait[]
  /** Label the face on screen, for reviewing portraits. */
  showDebug?: boolean
}) {
  const captionRef = useRef<HTMLParagraphElement>(null)
  const [support, setSupport] = useState<
    'checking' | 'supported' | 'unsupported'
  >('checking')
  const [activePortraits, setActivePortraits] = useState(portraits)
  const [error, setError] = useState('')
  const [shown, setShown] = useState<{
    id: string
    index: number
    pinned: boolean
  }>()

  useEffect(() => {
    let cancelled = false
    const gpu = (navigator as GpuNavigator).gpu
    Promise.resolve(gpu ? gpu.requestAdapter() : null)
      .then((adapter) => {
        if (cancelled) return
        setActivePortraits(portraitOverride(portraits))
        setSupport(adapter ? 'supported' : 'unsupported')
      })
      .catch(() => {
        if (!cancelled) setSupport('unsupported')
      })
    return () => {
      cancelled = true
    }
  }, [portraits])

  const onError = useCallback((message: string) => setError(message), [])
  const onPortraitShown = useCallback(
    (portrait: FacesPortrait, index: number, pinned: boolean) =>
      setShown({ id: portrait.id, index, pinned }),
    []
  )

  return (
    <main id='main' className='faces-experience'>
      {support === 'supported' && !error ? (
        <FacesCanvas
          portraits={activePortraits}
          captionRef={captionRef}
          onError={onError}
          onPortraitShown={showDebug ? onPortraitShown : undefined}
          shortcuts={showDebug}
        />
      ) : null}
      <p
        ref={captionRef}
        className='faces-caption'
        role='status'
        aria-live='polite'
        aria-atomic='true'
      />
      {showDebug && shown ? (
        <p className='faces-debug' aria-hidden='true'>
          {shown.id} · {shown.index + 1}/{activePortraits.length}
          {shown.pinned ? ' · pinned' : ''}
          <span className='faces-debug-hint'>← → switch · esc resume</span>
        </p>
      ) : null}
      {support === 'unsupported' ? (
        <p className='faces-status' role='status'>
          This prototype needs a browser with WebGPU.
        </p>
      ) : null}
      {error ? (
        <p className='faces-status' role='status'>
          {error} Reload to try again.
        </p>
      ) : null}
    </main>
  )
}
