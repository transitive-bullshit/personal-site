import Link from 'next/link'
import { ArrowLeftIcon, ArrowUpRightIcon, CodeIcon } from 'lucide-react'
import SiX from '@icons-pack/react-simple-icons/icons/SiX'
import type { Project, Snapshot } from '@/lib/content/schema'
import { ProjectTransition } from './project-transition'
import { ContentBody } from './article/content-body'
import { Button } from './ui/button'

export function ProjectPage({
  project,
  snapshot
}: {
  project: Project
  snapshot: Snapshot
}) {
  return (
    <main id='main'>
      <article>
        <header className='article-header project-header'>
          <Link className='project-back' href='/projects' prefetch={true}>
            <ArrowLeftIcon aria-hidden='true' />
            All projects
          </Link>
          <ProjectTransition projectId={project.id} part='title'>
            <h1>{project.title}</h1>
          </ProjectTransition>
          {project.description ? (
            <ProjectTransition projectId={project.id} part='description'>
              <p className='article-description'>{project.description}</p>
            </ProjectTransition>
          ) : null}
          <div className='project-actions'>
            {project.website ? (
              <Button asChild>
                <a href={project.website}>
                  View project
                  <ArrowUpRightIcon aria-hidden='true' data-icon='inline-end' />
                </a>
              </Button>
            ) : null}
            {project.source ? (
              <Button variant='outline' asChild>
                <a href={project.source}>
                  <CodeIcon aria-hidden='true' data-icon='inline-start' />
                  View source
                </a>
              </Button>
            ) : null}
            {project.tweet ? (
              <Button variant='outline' asChild>
                <a href={project.tweet}>
                  <SiX aria-hidden='true' title='' data-icon='inline-start' />
                  View on X
                </a>
              </Button>
            ) : null}
          </div>
        </header>
        <ContentBody
          entry={project}
          snapshot={snapshot}
          projectTransitionId={project.id}
        />
      </article>
    </main>
  )
}
