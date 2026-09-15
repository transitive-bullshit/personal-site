'use client'

import { useEffect, useState } from 'react'
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
  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((item): item is HTMLElement => Boolean(item))
    let frame = 0
    const update = () => {
      const article = elements[0]
        ?.closest('article')
        ?.querySelector('.article-body')
      setActive(
        activeHeading(
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
      )
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
      <ol>
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={'#' + heading.id}
              style={{ paddingLeft: 14 + heading.depth * 12 }}
              aria-current={active === heading.id ? 'location' : undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
