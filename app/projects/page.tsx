import type { Metadata } from 'next'
import { ProjectIndex } from '@/components/project-index'
import { content, projects } from '@/lib/content/load'
import { websiteMetadata } from '@/lib/metadata'
import { JsonLd } from '@/components/json-ld'
import { pageJsonLd } from '@/lib/content/metadata'

export const dynamic = 'force-static'
export const revalidate = 86400
const description =
  'Projects by Travis Fischer. Software, open source, and creative experiments.'
export const metadata: Metadata = websiteMetadata(
  'Projects',
  description,
  '/projects'
)

export default function ProjectsPage() {
  return (
    <main id='main' className='home projects-page'>
      <JsonLd
        data={pageJsonLd(
          'Projects',
          description,
          '/projects',
          projects.map((entry) => ({
            title: entry.title,
            path: '/projects/' + entry.slug
          }))
        )}
      />
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
