import type { Metadata } from 'next'
import { ProjectIndex } from '@/components/project-index'
import { content, projects } from '@/lib/content/load'
import { site } from '@/lib/site'

export const dynamic = 'force-static'
export const revalidate = 86400
const description =
  'Projects by Travis Fischer. Software, open source, and creative experiments.'
export const metadata: Metadata = {
  title: 'Projects',
  description,
  alternates: { canonical: '/projects' },
  openGraph: {
    type: 'website',
    title: 'Projects',
    description,
    url: site.origin + '/projects',
    siteName: site.name
  }
}

export default function ProjectsPage() {
  return (
    <main id='main' className='home projects-page'>
      <h1>Projects</h1>
      <p className='home-intro'>
        Software, open source, and creative experiments.
      </p>
      <ProjectIndex
        projects={projects}
        snapshot={content}
        label='All projects'
      />
    </main>
  )
}
