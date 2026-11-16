'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FacesPortrait } from '@/lib/faces/faces-stage'

// WebGPU and the compute simulation only exist in the browser.
const FacesCanvas = dynamic(() => import('./faces-canvas'), { ssr: false })

type GpuNavigator = Navigator & {
  gpu?: { requestAdapter(): Promise<unknown> }
}

/** `?portrait=slug` swaps in another prepared portrait from `/faces/slug`. */
function portraitOverride(portrait: FacesPortrait): FacesPortrait {
  const slug = new URLSearchParams(window.location.search).get('portrait')
  return slug && /^[a-z0-9-]+$/.test(slug)
    ? { ...portrait, directory: `/faces/${slug}` }
    : portrait
}

export function FacesExperience({ portrait }: { portrait: FacesPortrait }) {
  const captionRef = useRef<HTMLParagraphElement>(null)
  const [support, setSupport] = useState<
    'checking' | 'supported' | 'unsupported'
  >('checking')
  const [activePortrait, setActivePortrait] = useState(portrait)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const gpu = (navigator as GpuNavigator).gpu
    Promise.resolve(gpu ? gpu.requestAdapter() : null)
      .then((adapter) => {
        if (cancelled) return
        setActivePortrait(portraitOverride(portrait))
        setSupport(adapter ? 'supported' : 'unsupported')
      })
      .catch(() => {
        if (!cancelled) setSupport('unsupported')
      })
    return () => {
      cancelled = true
    }
  }, [portrait])

  const onError = useCallback((message: string) => setError(message), [])

  return (
    <main id='main' className='faces-experience'>
      {support === 'supported' && !error ? (
        <FacesCanvas
          portrait={activePortrait}
          captionRef={captionRef}
          onError={onError}
        />
      ) : null}
      <p
        ref={captionRef}
        className='faces-caption'
        role='status'
        aria-live='polite'
        aria-atomic='true'
      />
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
