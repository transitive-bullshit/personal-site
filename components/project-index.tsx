import Link from 'next/link'
import type { Project, Snapshot } from '@/lib/content/schema'
import { MediaImage, NotionIcon } from './article/media'

export function ProjectIndex({
  projects,
  snapshot,
  label,
  headingLevel = 2
}: {
  projects: readonly Project[]
  snapshot: Snapshot
  label: string
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <ul className='project-index' aria-label={label}>
      {projects.map((project) => (
        <li key={project.id}>
          <Link className='project-card' href={'/project/' + project.slug}>
            <div className='project-card-preview'>
              {project.cover ? (
                <MediaImage
                  media={snapshot.media[project.cover]!}
                  alt=''
                  className='project-card-image'
                  sizes='(max-width: 600px) calc(100vw - 44px), (max-width: 800px) calc((100vw - 88px) / 2), 348px'
                />
              ) : (
                <div className='project-card-fallback' aria-hidden='true'>
                  {project.icon ? (
                    <NotionIcon icon={project.icon} snapshot={snapshot} />
                  ) : (
                    project.title.slice(0, 1)
                  )}
                </div>
              )}
            </div>
            <div className='project-card-heading'>
              <Heading>{project.title}</Heading>
            </div>
            {project.description ? <p>{project.description}</p> : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
