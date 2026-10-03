import { getProjectHeroVideo } from '@/lib/content/project-hero'
import { ProjectHeroVideo } from './project-hero-video'
import { RichText } from './article/rich-text'
import { Blocks } from './article/blocks'
import { JsonLd } from './json-ld'
import { projectJsonLd } from '@/lib/content/metadata'
import Link from 'next/link'
import { ArrowLeftIcon, CodeIcon, GlobeIcon } from 'lucide-react'
import SiX from '@icons-pack/react-simple-icons/icons/SiX'
import SiGithub from '@icons-pack/react-simple-icons/icons/SiGithub'
import SiYoutube from '@icons-pack/react-simple-icons/icons/SiYoutube'
import type { Project, Snapshot } from '@/lib/content/schema'
import { ProjectTransition } from './project-transition'
import { ContentBody } from './article/content-body'
import { ContentCover } from './article/content-cover'
import { Button } from './ui/button'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

export function ProjectPage({
  project,
  snapshot
}: {
  project: Project
  snapshot: Snapshot
}) {
  const hero = getProjectHeroVideo(project, snapshot)
  const SourceIcon =
    project.source &&
    ['github.com', 'www.github.com'].includes(new URL(project.source).hostname)
      ? SiGithub
      : CodeIcon
  const body = hero
    ? {
        ...project,
        blocks: project.blocks.filter((block) => block.id !== hero.id)
      }
    : project

  return (
    <main id='main'>
      <JsonLd data={projectJsonLd(project, snapshot)} />
      <article>
        <header className='article-header project-header'>
          <Link className='project-back' href='/projects' prefetch={true}>
            <ArrowLeftIcon aria-hidden='true' />
            All projects
          </Link>
          {hero ? (
            <figure id={hero.id} className='article-cover'>
              <ProjectTransition projectId={project.id} part='image'>
                <ProjectHeroVideo
                  media={snapshot.media[hero.media!]!}
                  cover={
                    project.cover ? snapshot.media[project.cover] : undefined
                  }
                  title={project.title}
                />
              </ProjectTransition>
              {hero.caption.length ? (
                <figcaption>
                  <RichText spans={hero.caption} />
                </figcaption>
              ) : null}
              <Blocks blocks={hero.children} snapshot={snapshot} />
            </figure>
          ) : project.cover ? (
            <ProjectTransition projectId={project.id} part='image'>
              <ContentCover entry={project} snapshot={snapshot} />
            </ProjectTransition>
          ) : null}
          <ProjectTransition projectId={project.id} part='title'>
            <h1>{project.title}</h1>
          </ProjectTransition>
          {project.description ? (
            <ProjectTransition projectId={project.id} part='description'>
              <p className='article-description text-pretty'>
                {project.description}
              </p>
            </ProjectTransition>
          ) : null}
          <div className='project-actions'>
            {project.website ? (
              <Button asChild>
                <a href={project.website} target='_blank' rel='noopener'>
                  <GlobeIcon aria-hidden='true' data-icon='inline-start' />
                  View project
                </a>
              </Button>
            ) : null}
            {project.type === 'Video' && project.youtube ? (
              <Button variant={project.website ? 'outline' : 'default'} asChild>
                <a href={project.youtube} target='_blank' rel='noopener'>
                  <SiYoutube
                    aria-hidden='true'
                    title=''
                    data-icon='inline-start'
                  />
                  View on YouTube
                </a>
              </Button>
            ) : null}
            {project.source ? (
              <Button variant='outline' asChild>
                <a href={project.source} target='_blank' rel='noopener'>
                  <SourceIcon
                    aria-hidden='true'
                    title=''
                    data-icon='inline-start'
                  />
                  View source
                </a>
              </Button>
            ) : null}
            {project.tweet ? (
              <Button variant='outline' asChild>
                <a href={project.tweet} target='_blank' rel='noopener'>
                  <SiX aria-hidden='true' title='' data-icon='inline-start' />
                  View on X
                </a>
              </Button>
            ) : null}
          </div>
          {project.published ? (
            <div className='article-meta'>
              <time dateTime={project.published}>
                {dateFormatter.format(new Date(project.published))}
              </time>
            </div>
          ) : null}
        </header>
        <ContentBody entry={body} snapshot={snapshot} showCover={false} />
      </article>
    </main>
  )
}
