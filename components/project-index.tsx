import Link from 'next/link'
import type { Project, Snapshot } from '@/lib/content/schema'
import { ProjectTransition } from './project-transition'
import { MediaImage, NotionIcon } from './article/media'

export function ProjectIndex({
  projects,
  snapshot,
  label,
  headingLevel = 2,
  prioritizeFirstImage = false
}: {
  projects: readonly Project[]
  snapshot: Snapshot
  label: string
  headingLevel?: 2 | 3
  prioritizeFirstImage?: boolean
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <ul className='project-index' aria-label={label}>
      {projects.map((project, index) => (
        <li key={project.id}>
          <Link
            className='project-card'
            href={'/projects/' + project.slug}
            prefetch={true}
          >
            <ProjectTransition
              projectId={project.cover ? project.id : undefined}
              part='image'
            >
              <div className='project-card-preview'>
                {project.cover ? (
                  <MediaImage
                    reuseLoadedImage
                    priority={prioritizeFirstImage && index === 0}
                    media={snapshot.media[project.cover]!}
                    alt=''
                    className='project-card-image'
                    sizes='(max-width: 600px) calc(100vw - 32px), (max-width: 800px) calc((100vw - 88px) / 2), 348px'
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
            </ProjectTransition>
            <div className='project-card-heading'>
              <ProjectTransition projectId={project.id} part='title'>
                <Heading>{project.title}</Heading>
              </ProjectTransition>
            </div>
            {project.description ? (
              <ProjectTransition projectId={project.id} part='description'>
                <p>{project.description}</p>
              </ProjectTransition>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
