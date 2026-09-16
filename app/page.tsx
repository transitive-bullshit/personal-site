import { JsonLd } from '@/components/json-ld'
import { pageJsonLd } from '@/lib/content/metadata'
import { site } from '@/lib/site'
import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'
import { ArticleIndex } from '@/components/article-index'
import { ProjectIndex } from '@/components/project-index'
import { content, featuredProjects, featuredArticles } from '@/lib/content/load'

export const dynamic = 'force-static'
export const revalidate = 86400

export default function HomePage() {
  return (
    <main id='main' className='home'>
      <JsonLd data={pageJsonLd(site.name, site.description, '/')} />
      <h1>
        Building things.
        <br />
        Sharing what I learn.
      </h1>
      <p className='home-intro'>
        Travis Fischer. Software, open source, and the occasional detour.
      </p>
      <section className='home-section' aria-labelledby='featured-projects'>
        <h2 id='featured-projects'>Featured projects</h2>
        <ProjectIndex
          headingLevel={3}
          projects={featuredProjects}
          snapshot={content}
          label='Featured projects'
        />
        <Link className='all-writing-link' href='/projects'>
          View all projects <ArrowRightIcon aria-hidden='true' />
        </Link>
      </section>
      <section className='home-section' aria-labelledby='featured-writing'>
        <h2 id='featured-writing'>Featured writing</h2>
        <ArticleIndex articles={featuredArticles} label='Featured articles' />
        <Link className='all-writing-link' href='/writing'>
          View all writing <ArrowRightIcon aria-hidden='true' />
        </Link>
      </section>
    </main>
  )
}
