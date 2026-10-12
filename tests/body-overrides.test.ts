import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article, Snapshot } from '../lib/content/schema'
import {
  cyberSwarmArticleId,
  getBodyOverride
} from '../lib/content/body-overrides'
import { entryMarkdown } from '../lib/content/markdown'
import { buildSearchIndex } from '../lib/content/search-index'
import { searchDocuments } from '../lib/search'
import { resolveRoute } from '../lib/content/routes'
import { sourceContract } from '../lib/site'
import { sources } from '../lib/content/essays/cyber-swarm/content'
import {
  sourceOrder,
  sourceNumber
} from '../lib/content/essays/cyber-swarm/citation-labels'
import {
  essayOpening,
  essayParts,
  capabilityAside,
  releaseAside,
  finalPredictions,
  finalForecastPremise,
  finalClosing,
  furtherReading
} from '../lib/content/essays/cyber-swarm/essay-content'
import { expertQuotes } from '../lib/content/essays/cyber-swarm/quotes'
import {
  dnsEvents,
  defenderWindowDescription
} from '../lib/content/essays/cyber-swarm/evidence'

vi.mock('../components/article/tweet', () => ({ ArticleTweet: () => null }))

const routeState = vi.hoisted(() => ({
  current: undefined as Snapshot | undefined
}))
vi.mock('@/lib/content/load', () => ({
  get content() {
    return routeState.current!
  }
}))

import { ArticlePage } from '../components/article/article'
import Page from '../app/[slug]/page'
import { GET as markdownRoute } from '../app/markdown/[...path]/route'

const article: Article = {
  id: cyberSwarmArticleId,
  title: 'AI is turning cybersecurity into drone swarm warfare',
  slug: 'ai-cyberswarm-warfare',
  description: 'The description from Notion',
  author: 'Travis Fischer',
  published: '2026-10-12',
  modified: '2026-10-12T03:56:00.000Z',
  tags: ['AI', 'Research'],
  featured: false,
  blocks: []
}

function snapshot(entry = article): Snapshot {
  return {
    schemaVersion: 1,
    importerVersion: 1,
    source: { ...sourceContract, apiVersion: '2026-03-11', propertyIds: {} },
    articles: { [entry.id]: entry },
    routes: { [entry.id]: { slug: entry.slug, aliases: [], active: true } },
    media: {},
    tweets: {}
  }
}

beforeEach(() => {
  routeState.current = snapshot()
})

function cited(text: string) {
  return text.replace(
    /\[(\d+)\]/g,
    (_, id: string) => `[^${sourceNumber(Number(id))}]`
  )
}

function render(entry = article) {
  return load(
    renderToStaticMarkup(
      createElement(ArticlePage, { article: entry, snapshot: snapshot(entry) })
    )
  )
}

describe('CMS article body overrides', () => {
  it('selects the React essay by stable ID and retains CMS header metadata', () => {
    const entry = {
      ...article,
      description:
        'AI is turning cybersecurity into drone swarm warfare, and this will lead to increasingly consequential cyberattacks over the next 18 months.',
      author: 'CMS author'
    }
    const $ = render(entry)
    expect($('.article-header h1').text()).toBe(entry.title)
    expect($('.article-header h1 s, .article-header h1 del').text()).toBe(
      'drone'
    )
    expect($('.article-description').text()).toBe(entry.description)
    expect($('.article-description s').text()).toBe('drone')
    expect($('.defender-window-source a').attr('href')).toBe(
      'https://openai.com/the-defense-factory/'
    )
    for (const link of $(
      '.defender-window-source a, .state-ai-source a, .essay-margin > a, .margin-quote a, .original-photo figcaption a'
    ).toArray()) {
      expect($(link).attr('href')).toMatch(/^https:\/\//)
      expect($(link).hasClass('link')).toBe(true)
    }
    expect($('#capability-margin > a').attr('href')).toBe(
      'https://www.anthropic.com/threat-intelligence-report-september-2026'
    )
    const footnotes = $('.article-body a[href^="#source-"]')
    expect(footnotes.length).toBeGreaterThan(0)
    for (const link of footnotes.toArray())
      expect($(link).parent().is('sup')).toBe(true)
    expect(
      JSON.parse($('script[type="application/ld+json"]').text()).description
    ).toBe(entry.description)
    expect($('.article-meta').text()).toContain(entry.author)
    expect($('.article-meta time').attr('datetime')).toBe(entry.published)
    expect($('#protection-paths').length).toBe(0)
    expect($('#accident-margin > a').length).toBe(0)
    expect($('#opening').length).toBe(1)
    expect($('#sources > ol > li').length).toBe(10)
    expect($('#sources details').attr('open')).toBeUndefined()
    expect($('#sources details ol').attr('start')).toBe('11')
    expect($('#sources li').length).toBe(
      sourceOrder.length + furtherReading.length
    )
    expect($('#defenders-0 a[href="#source-33"]').length).toBe(1)
    expect($('#source-33 a').attr('href')).toBe(
      'https://www.axios.com/2026/10/09/ai-companies-day-after-major-attack'
    )
    const video = $('#policy-video iframe')
    expect(video.attr('src')).toBe(
      'https://www.youtube-nocookie.com/embed/B8oXVMYXlfM'
    )
    expect(video.attr('title')).toBe(
      'Will it take a disaster to force AI regulation? | The Economist'
    )
    expect(video.attr('loading')).toBe('lazy')
    expect(video.closest('section').attr('id')).toBe('coverage')
    expect($('#coverage-5').next('#policy-video').length).toBe(1)
    expect($('#prediction-catastrophe').hasClass('forecast-boldest')).toBe(true)
    expect($('.article-body').length).toBe(1)
    for (const heading of getBodyOverride(entry.id)!.headings)
      expect($('#' + heading.id).length).toBe(1)
    expect($('article').text()).toContain(finalPredictions[3]!.body)
    expect($('a[href="https://openai.com/daybreak/"]').length).toBeGreaterThan(
      0
    )
  })

  it('retains the body after a CMS slug/title edit and does not match another article by slug', () => {
    const renamed = {
      ...article,
      slug: 'renamed-in-notion',
      title: 'A new CMS title'
    }
    expect(render(renamed)('.article-header h1').text()).toBe(renamed.title)
    expect(render(renamed)('.article-description').text()).toBe(
      renamed.description
    )
    expect(render(renamed)('.article-description s').length).toBe(0)
    expect(render(renamed)('#opening').length).toBe(1)
    expect(entryMarkdown(renamed, snapshot(renamed))).toContain(
      'https://www.transitivebullsh.it/renamed-in-notion'
    )
    expect(getBodyOverride('a'.repeat(32))).toBeUndefined()
  })

  it('keeps the regular Notion renderer and Markdown for ordinary articles', () => {
    const ordinary: Article = {
      ...article,
      id: 'a'.repeat(32),
      description: 'Ordinary drone swarm description',
      blocks: [
        {
          id: 'b'.repeat(32),
          type: 'paragraph',
          richText: [
            {
              text: 'Standard Notion body',
              bold: false,
              italic: false,
              underline: false,
              strike: false,
              code: false,
              color: 'default'
            }
          ],
          color: 'default',
          children: []
        }
      ]
    }
    expect(render(ordinary)('.article-body').text()).toContain(
      'Standard Notion body'
    )
    expect(render(ordinary)('.article-description').text()).toBe(
      ordinary.description
    )
    expect(render(ordinary)('.article-description s').length).toBe(0)
    expect(render(ordinary)('#opening').length).toBe(0)
    expect(entryMarkdown(ordinary, snapshot(ordinary))).toContain(
      'Standard Notion body'
    )
    expect(entryMarkdown(ordinary, snapshot(ordinary))).not.toContain(
      finalForecastPremise
    )
  })

  it('exports all canonical prose, prediction criteria, margins, sources and quotes', () => {
    const body = entryMarkdown(article, snapshot())
    for (const text of [
      ...essayOpening,
      ...essayParts.flatMap((part) => part.paragraphs),
      capabilityAside,
      releaseAside,
      finalForecastPremise,
      ...finalPredictions.flatMap((prediction) => [
        prediction.body,
        prediction.test
      ]),
      ...finalClosing
    ])
      expect(body).toContain(cited(text))
    for (const part of essayParts) expect(body).toContain(part.margin.body)
    for (const quote of Object.values(expertQuotes)) {
      expect(body.split(quote.text)).toHaveLength(2)
      expect(body).toContain(quote.url)
    }
    for (const id of sourceOrder) {
      const source = sources.find((candidate) => candidate.id === id)!
      expect(body).toContain(
        `[^${sourceNumber(id)}]: [${source.title}](${source.url})`
      )
      expect(body).not.toContain(source.note)
    }
    for (const source of furtherReading) {
      expect(body).toContain(source.url)
      expect(body).not.toContain(source.note)
    }
    const definitions = [...body.matchAll(/^\[\^(\d+)\]:/gm)].map(
      (match) => match[1]
    )
    const references = [
      ...body.replace(/^\[\^\d+\]:.*$/gm, '').matchAll(/\[\^(\d+)\]/g)
    ].map((match) => match[1])
    expect(definitions).toHaveLength(sourceOrder.length)
    expect(new Set(definitions).size).toBe(sourceOrder.length)
    expect(references.every((number) => definitions.includes(number))).toBe(
      true
    )
    expect(body).not.toMatch(
      /\/Users\/|localhost|127\.0\.0\.1|#\/review|#\/evidence/
    )
  })

  it('keeps chart evidence accessible in the portable body', () => {
    const body = getBodyOverride(article.id)!.markdown
    expect(body).toContain('| 2025 | 6–10 months |')
    expect(body).toContain('| 2026 | 4–7 months |')
    expect(body).toContain('| Fastest working exploit | Under 1 hour |')
    expect(body).toContain(
      '| Public source fix to Firefox 148 release | 18 days |'
    )
    for (const event of dnsEvents)
      expect(body).toContain(`| ${event.time} | ${event.label} |`)
    expect(body).not.toContain(
      'Explore why the same finding leads to different protection'
    )
    expect(body).toContain(defenderWindowDescription)
    expect(body).toContain('/essays/cyber-swarm/iron-dome-original.jpg')
    expect(body).toContain('/essays/cyber-swarm/swarm.webp')
    expect(body).toContain('https://www.youtube.com/watch?v=B8oXVMYXlfM')
    expect(body).toContain(
      'https://www.axios.com/2026/10/09/ai-companies-day-after-major-attack'
    )
    expect(body).toContain(`**${finalPredictions[3]!.body}**`)
  })

  it('indexes rendered headings and authored captions without expanding the TOC or search scope', () => {
    const index = buildSearchIndex(snapshot())
    const document = index.documents.find((entry) => entry.kind === 'article')!
    expect(document.href).toBe('/' + article.slug)
    expect(document.title).toBe(article.title)
    expect(document.bodyTerms).toContain('coverage')
    expect(document.bodyTerms).toContain('mobilizing')
    for (const query of [
      'catastrophe',
      'commodity',
      'unauthorized',
      'detected stopped',
      'hours release',
      'battlefield'
    ])
      expect(
        searchDocuments(index.documents, query).map((entry) => entry.href)
      ).toContain('/' + article.slug)
    expect(
      getBodyOverride(article.id)!.headings.map((heading) => heading.id)
    ).not.toContain('prediction-catastrophe')
    expect(document.bodyTerms).not.toContain('agi')
    expect(document.bodyTerms).not.toContain('spidermonkey')
    expect(document.bodyTerms).not.toContain('forensics')
    expect(JSON.stringify(document)).not.toContain(finalForecastPremise)
    expect(searchDocuments(index.documents, 'agi')).toEqual([])
    expect(searchDocuments(index.documents, 'spidermonkey')).toEqual([])
  })

  it('keeps publication gates and aliases ahead of both custom representations', async () => {
    const inactive = snapshot()
    inactive.routes[article.id]!.active = false
    routeState.current = inactive
    expect(resolveRoute(article.slug, inactive.routes)).toBeUndefined()
    expect(
      buildSearchIndex(inactive).documents.some(
        (entry) => entry.kind === 'article'
      )
    ).toBe(false)
    await expect(
      Page({ params: Promise.resolve({ slug: article.slug }) })
    ).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    const hiddenMarkdown = await markdownRoute(
      new Request('https://www.transitivebullsh.it/' + article.slug + '.md'),
      { params: Promise.resolve({ path: [article.slug] }) }
    )
    expect(hiddenMarkdown.status).toBe(404)
    routeState.current = snapshot({ ...article, slug: 'renamed-in-notion' })
    routeState.current.routes[article.id]!.aliases = [article.slug]
    await expect(
      Page({ params: Promise.resolve({ slug: article.slug }) })
    ).rejects.toThrow('NEXT_REDIRECT')
    const alias = await markdownRoute(
      new Request('https://www.transitivebullsh.it/' + article.slug + '.md'),
      { params: Promise.resolve({ path: [article.slug] }) }
    )
    expect(alias.status).toBe(308)
    expect(alias.headers.get('Location')).toBe('/renamed-in-notion.md')
  })
})
