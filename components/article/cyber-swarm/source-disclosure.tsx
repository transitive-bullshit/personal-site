'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export function SourceDisclosure({
  children,
  count
}: {
  children: ReactNode
  count: number
}) {
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const reveal = (hash: string) => {
      if (!/^#source-\d+$/.test(hash)) return undefined
      const target = document.getElementById(hash.slice(1))
      const details = ref.current
      if (!target || !details?.contains(target) || details.open)
        return undefined
      details.open = true
      return target
    }
    const revealHash = () => {
      const target = reveal(window.location.hash)
      if (target) {
        target.scrollIntoView({ block: 'start' })
        target.focus({ preventScroll: true })
      }
    }
    const revealLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const anchor =
        event.target instanceof Element ? event.target.closest('a') : null
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href)
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        // Reveal before the browser performs its normal fragment navigation.
        reveal(url.hash)
    }
    revealHash()
    document.addEventListener('click', revealLink)
    window.addEventListener('hashchange', revealHash)
    return () => {
      document.removeEventListener('click', revealLink)
      window.removeEventListener('hashchange', revealHash)
    }
  }, [])

  return (
    <details ref={ref} className='sources-disclosure'>
      <summary>
        <span className='sources-show'>Show {count} more sources</span>
        <span className='sources-hide'>Hide additional sources</span>
      </summary>
      {children}
    </details>
  )
}
