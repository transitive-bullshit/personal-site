import type { ReactNode } from 'react'
import type { RichText as Span } from '@/lib/content/schema'

export function safeHref(href: string): string | undefined {
  if (/^(?:\/(?!\/)|#)/.test(href)) return href
  try {
    const url = new URL(href)
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol))
      return href
  } catch {}
  return undefined
}

export function RichText({ spans }: { spans: Span[] }) {
  return spans.map((span, index) => {
    let node: ReactNode = span.text
    if (span.equation) node = <span className='inline-equation'>{node}</span>
    if (span.code) node = <code>{node}</code>
    if (span.bold) node = <strong>{node}</strong>
    if (span.italic) node = <em>{node}</em>
    if (span.underline) node = <u>{node}</u>
    if (span.strike) node = <s>{node}</s>
    const href = span.href && safeHref(span.href)
    if (href) node = <a href={href}>{node}</a>
    return (
      <span
        key={index}
        className='rich-text'
        data-notion-color={span.color === 'default' ? undefined : span.color}
      >
        {node}
      </span>
    )
  })
}
