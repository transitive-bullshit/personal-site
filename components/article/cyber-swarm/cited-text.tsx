import type { ReactNode } from 'react'
import { sources } from '@/lib/content/essays/cyber-swarm/content'
import { sourceNumber } from '@/lib/content/essays/cyber-swarm/citation-labels'

export function CitedText({ text, anchor }: { text: string; anchor?: string }) {
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(
    /\[(\d+)\]|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  )) {
    nodes.push(text.slice(cursor, match.index))
    if (match[1]) {
      const id = Number(match[1])
      const source = sources.find((source) => source.id === id)
      nodes.push(
        <sup
          key={match.index}
          id={anchor ? `${anchor}-ref-${id}-${match.index}` : undefined}
        >
          <a
            href={`#source-${id}`}
            aria-label={`Source ${sourceNumber(id)}: ${source?.title ?? 'reference'}`}
          >
            {sourceNumber(id)}
          </a>
        </sup>
      )
    } else {
      nodes.push(
        <a key={match.index} href={match[3]}>
          {match[2]}
        </a>
      )
    }
    cursor = match.index! + match[0].length
  }
  nodes.push(text.slice(cursor))
  return <>{nodes}</>
}

export function EssayText({
  text,
  id,
  className,
  as = 'p',
  plain = false
}: {
  text: string
  id?: string
  className?: string
  as?: 'p' | 'h2' | 'h3' | 'span'
  plain?: boolean
}) {
  const Tag = as
  return (
    <Tag id={id} className={className}>
      {plain ? text : <CitedText text={text} anchor={id} />}
    </Tag>
  )
}
