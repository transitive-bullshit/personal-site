import { load } from 'cheerio'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { ProjectPage } from '../components/project'
import { projectJsonLd } from '../lib/content/metadata'
import { entryMarkdown } from '../lib/content/markdown'
import type { Project, Snapshot } from '../lib/content/schema'
import SiGithub from '@icons-pack/react-simple-icons/icons/SiGithub'
import SiYoutube from '@icons-pack/react-simple-icons/icons/SiYoutube'

vi.mock('../components/article/content-body', () => ({
  ContentBody: () => null
}))
vi.mock('../components/article/content-cover', () => ({
  ContentCover: () => null
}))
vi.mock('../components/article/blocks', () => ({ Blocks: () => null }))
vi.mock('../components/project-hero-video', () => ({
  ProjectHeroVideo: () => null
}))

const project: Project = {
  id: 'a'.repeat(32),
  title: 'Candy Paint',
  slug: 'candy-paint',
  description: '',
  modified: '2026-10-03',
  type: 'Video',
  authors: [],
  tags: [],
  featured: true,
  blocks: [],
  website: 'https://candy-paint.vercel.app',
  youtube: 'https://youtu.be/e-R5cXF3bzE',
  source: 'https://github.com/transitive-bullshit/candy-paint'
}
const snapshot = { media: {} } as Snapshot
const render = (entry: Project) =>
  load(
    renderToStaticMarkup(<ProjectPage project={entry} snapshot={snapshot} />)
  )
const githubPath = load(renderToStaticMarkup(<SiGithub />))('path').attr('d')
const youtubePath = load(renderToStaticMarkup(<SiYoutube />))('path').attr('d')

it('shows independent website, YouTube, source, and X actions with their icons', () => {
  const $ = render({ ...project, tweet: 'https://x.com/user/status/123' })
  const actions = $('.project-actions a')
  expect(actions.map((_, action) => $(action).text()).get()).toEqual([
    'View project',
    'View on YouTube',
    'View source',
    'View on X'
  ])
  expect(actions.map((_, action) => $(action).attr('href')).get()).toEqual([
    project.website,
    project.youtube,
    project.source,
    'https://x.com/user/status/123'
  ])
  expect(actions.eq(1).find('svg path').attr('d')).toBe(youtubePath)
  expect(actions.eq(2).find('svg path').attr('d')).toBe(githubPath)
  expect(actions.eq(2).find('svg').attr('aria-hidden')).toBe('true')
  expect(actions.eq(1).attr('data-variant')).toBe('outline')
})

it('shows YouTube without a website and omits empty links and non-video YouTube actions', () => {
  const $ = render({ ...project, website: undefined, source: undefined })
  expect($('.project-actions a').text()).toBe('View on YouTube')
  expect($('.project-actions a').attr('data-variant')).toBe('default')
  expect(
    render({ ...project, type: 'Webapp' })('.project-actions').text()
  ).not.toContain('YouTube')
  expect(
    render({ ...project, youtube: undefined })('.project-actions').text()
  ).not.toContain('YouTube')
})

it.each(['https://github.com', 'https://www.github.com/owner/repo'])(
  'uses a GitHub icon for %s',
  (source) => {
    const $ = render({ ...project, source })
    expect($(`a[href="${source}"] svg path`).attr('d')).toBe(githubPath)
  }
)

it.each([
  'https://example.com/chat',
  'https://github.com.example.com/owner/repo',
  'https://example.com/github.com'
])('retains the code icon for %s', (source) => {
  const $ = render({ ...project, source })
  expect($(`a[href="${source}"] svg`).attr('class')).toContain('lucide-code')
})

it('exposes separate website and video links in Markdown and structured metadata', () => {
  const body = entryMarkdown(project, snapshot)
  expect(body).toContain(`[Website](<${project.website}>)`)
  expect(body).toContain(`[YouTube](<${project.youtube}>)`)
  expect(projectJsonLd(project, snapshot).sameAs).toEqual([
    project.website,
    project.youtube
  ])
  expect(entryMarkdown({ ...project, type: 'Webapp' }, snapshot)).not.toContain(
    '[YouTube]'
  )
  expect(
    projectJsonLd({ ...project, website: undefined }, snapshot).sameAs
  ).toEqual([project.youtube])
})
