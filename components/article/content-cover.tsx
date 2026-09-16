import type { Article, Project, Snapshot } from '@/lib/content/schema'
import { ZoomableImage } from './media'

export function ContentCover({
  entry,
  snapshot
}: {
  entry: Article | Project
  snapshot: Snapshot
}) {
  if (!entry.cover) return null

  return (
    <figure className='article-cover'>
      <ZoomableImage
        media={snapshot.media[entry.cover]!}
        alt={entry.title}
        priority
      />
    </figure>
  )
}
