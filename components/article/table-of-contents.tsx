'use client'

import { useEffect, useRef, useState } from 'react'
import { activeHeading } from '@/lib/content/active-heading'
import type { Heading } from '@/lib/content/headings'

function transitionDuration(velocity: number, sectionDistance: number) {
  if (sectionDistance > 1) return 125
  if (velocity >= 2) return 125
  if (velocity >= 0.75) return 160
  return 250
}

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
    const headingIndexes = new Map(
      elements.map((element, index) => [element.id, index])
    )
    let frame = 0
    let lastScrollY = window.scrollY
    let lastUpdate = performance.now()

    const moveIndicator = (id: string | undefined, duration: number) => {
      const indicator = indicatorRef.current
      const list = listRef.current
      const link = id ? linkRefs.current.get(id) : undefined
      if (!indicator || !list || !link) return

      const listRect = list.getBoundingClientRect()
      const linkRect = link.getBoundingClientRect()
      const top = linkRect.top - listRect.top
      const bottom = list.scrollHeight - top - linkRect.height
      const clipPath = `inset(${top}px 0 ${Math.max(0, bottom)}px 0)`
      const ready = indicator.dataset.ready === 'true'

      indicator.style.setProperty(
        '--toc-transition-duration',
        `${ready ? duration : 0}ms`
      )
      if (indicator.style.clipPath !== clipPath)
        indicator.style.clipPath = clipPath
      indicator.dataset.ready = 'true'
    }

    const update = () => {
      const now = performance.now()
      const elapsed = Math.min(now - lastUpdate, 50)
      const velocity =
        Math.abs(window.scrollY - lastScrollY) / Math.max(elapsed, 1)
      lastScrollY = window.scrollY
      lastUpdate = now
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
      const currentIndex = activeRef.current
        ? headingIndexes.get(activeRef.current)
        : undefined
      const nextIndex = next ? headingIndexes.get(next) : undefined
      const sectionDistance =
        currentIndex === undefined || nextIndex === undefined
          ? 0
          : Math.abs(nextIndex - currentIndex)
      moveIndicator(next, transitionDuration(velocity, sectionDistance))
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
