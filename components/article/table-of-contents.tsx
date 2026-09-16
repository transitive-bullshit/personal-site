'use client'

import { useEffect, useRef, useState } from 'react'
import { activeHeading } from '@/lib/content/active-heading'
import type { Heading } from '@/lib/content/headings'

export function TableOfContents({
  headings,
  title = true
}: {
  headings: Heading[]
  title?: boolean
}) {
  const [active, setActive] = useState(headings[0]?.id)
  const activeRef = useRef(active)
  const listRef = useRef<HTMLOListElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>())

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((item): item is HTMLElement => Boolean(item))
    let frame = 0
    let motionFrame = 0
    let lastTime = 0
    let position: { top: number; bottom: number } | undefined
    let target = { top: 0, bottom: 0 }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const paint = () => {
      if (indicatorRef.current && position)
        indicatorRef.current.style.clipPath = `inset(${position.top}px 0 ${position.bottom}px 0)`
    }
    const animate = (now: number) => {
      const elapsed = Math.min(now - lastTime, 64)
      lastTime = now
      if (!position) return
      // Frame-rate-independent following: retarget without restarting the motion.
      const amount = 1 - Math.exp(-elapsed / 125)
      position.top += (target.top - position.top) * amount
      position.bottom += (target.bottom - position.bottom) * amount
      const settled =
        Math.max(
          Math.abs(target.top - position.top),
          Math.abs(target.bottom - position.bottom)
        ) < 0.1
      if (settled || reducedMotion.matches) position = { ...target }
      paint()
      motionFrame =
        settled || reducedMotion.matches ? 0 : requestAnimationFrame(animate)
    }
    const moveIndicator = (id: string | undefined) => {
      const list = listRef.current
      const link = id ? linkRefs.current.get(id) : undefined
      if (!list || !link) return
      const listRect = list.getBoundingClientRect()
      const linkRect = link.getBoundingClientRect()
      const top = linkRect.top - listRect.top
      target = {
        top,
        bottom: Math.max(0, list.scrollHeight - top - linkRect.height)
      }
      if (!position || reducedMotion.matches) {
        position = { ...target }
        paint()
      } else if (!motionFrame) {
        lastTime = performance.now()
        motionFrame = requestAnimationFrame(animate)
      }
    }

    const update = () => {
      const article = elements[0]
        ?.closest('article')
        ?.querySelector('.article-body')
      const next = activeHeading(
        elements.map((element) => ({
          id: element.id,
          top: element.getBoundingClientRect().top
        })),
        {
          articleBottom: article?.getBoundingClientRect().bottom ?? Infinity,
          documentBottom:
            document.documentElement.scrollHeight - window.scrollY,
          height: window.innerHeight,
          scrollY: window.scrollY
        }
      )
      moveIndicator(next)
      if (next !== activeRef.current) {
        activeRef.current = next
        setActive(next)
      }
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    const observer = new IntersectionObserver(schedule, {
      rootMargin: '-80px 0px -65% 0px'
    })
    elements.forEach((element) => observer.observe(element))
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const resizeObserver = new ResizeObserver(schedule)
    const article = elements[0]?.closest('article')
    if (article) resizeObserver.observe(article)
    update()
    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(motionFrame)
    }
  }, [headings])
  if (!headings.length) return null
  return (
    <nav className='toc' aria-label='On this page'>
      {title ? <div className='toc-title'>On this page</div> : null}
      <div className='toc-list'>
        <span ref={indicatorRef} className='toc-indicator' aria-hidden='true' />
        <ol ref={listRef}>
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                ref={(node) => {
                  if (node) linkRefs.current.set(heading.id, node)
                  else linkRefs.current.delete(heading.id)
                }}
                href={'#' + heading.id}
                style={{ paddingLeft: 14 + heading.depth * 12 }}
                aria-current={active === heading.id ? 'location' : undefined}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  )
}
