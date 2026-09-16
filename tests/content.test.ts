import { describe, expect, it } from 'vitest'
import { getHeadings } from '../lib/content/headings'
import { internalPageId } from '../lib/content/references'
import {
  normalizeTitle,
  reconcileRoutes,
  resolveRoute,
  rewriteLink,
  validateRoutes
} from '../lib/content/routes'
import { serializeJsonLd } from '../lib/content/metadata'
import { sourceContract } from '../lib/site'
import { plainSpan } from '../scripts/notion/normalize'
import type { Block, RouteRecord } from '../lib/content/schema'

const a = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const b = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const routes: Record<string, RouteRecord> = {
  [a]: { slug: 'original-title', aliases: ['old-title'], active: true }
}
const page = { id: a, title: 'New Title', slug: '', public: true }

describe('publication and pathname lifecycle', () => {
  it('retains a path when the title or explicit slug changes', () => {
    const result = reconcileRoutes([page], routes)
    expect(result.routes[a]?.slug).toBe('original-title')
    expect(result.warnings).toHaveLength(1)
    expect(
      reconcileRoutes([{ ...page, slug: 'explicit' }], routes).routes[a]?.slug
    ).toBe('original-title')
  })
  it('accepts a rename explicitly and redirects every former path directly', () => {
    const result = reconcileRoutes([page], routes, {
      acceptSlugChanges: true
    }).routes
    expect(resolveRoute('old-title', result)).toEqual({
      id: a,
      slug: 'new-title',
      redirect: true
    })
    expect(resolveRoute('original-title', result)?.slug).toBe('new-title')
  })
  it('retains missing pages until pruning but unpublishes explicit Public=false', () => {
    expect(reconcileRoutes([], routes).routes[a]?.active).toBe(true)
    expect(reconcileRoutes([], routes, { prune: true }).routes[a]?.active).toBe(
      false
    )
    const unpublished = reconcileRoutes(
      [{ ...page, public: false }],
      routes
    ).routes
    expect(resolveRoute('old-title', unpublished)).toBeUndefined()
    expect(resolveRoute(a, unpublished)).toBeUndefined()
    expect(unpublished[a]?.slug).toBe('original-title')
  })
  it('does not reassign a tombstone or let aliases collide', () => {
    expect(() =>
      reconcileRoutes(
        [{ id: b, title: 'Original Title', slug: '', public: true }],
        { [a]: { ...routes[a]!, active: false } }
      )
    ).toThrow('collision')
    expect(() =>
      validateRoutes({
        ...routes,
        [b]: { slug: 'other', aliases: ['old-title'], active: true }
      })
    ).toThrow('collision')
  })
  it('rejects explicit invalid/reserved paths rather than rewriting them', () => {
    for (const slug of [
      'a/b',
      'about',
      'llms.txt',
      'search-index.json',
      'writing',
      'a%2fb',
      'a?b',
      'a b',
      '..'
    ]) {
      expect(() => reconcileRoutes([{ ...page, slug }], {})).toThrow()
    }
  })
  it('preserves the legacy normalization edge cases', () => {
    expect(normalizeTitle('Developer + X = Entrepreneur')).toBe(
      'developer-x-entrepreneur'
    )
    expect(normalizeTitle("Saasify's Approach to OSS")).toBe(
      'saasifys-approach-to-oss'
    )
    expect(normalizeTitle('Next.js Notion Starter Kit')).toBe(
      'nextjs-notion-starter-kit'
    )
    expect(normalizeTitle('Hello 世界')).toBe('hello-世界')
    expect(normalizeTitle('A    B')).toBe('a--b')
    expect(
      reconcileRoutes([{ ...page, title: '✨' }], {}).routes[a]?.slug
    ).toBe(a)
  })
  it('resolves only published compact/hyphenated IDs and title-plus-ID aliases', () => {
    expect(resolveRoute('anything-' + a, routes)?.slug).toBe('original-title')
    expect(
      resolveRoute('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', routes)?.id
    ).toBe(a)
    expect(resolveRoute(b, routes)).toBeUndefined()
  })
  it('rewrites known Notion article links and block fragments without publishing others', () => {
    const blockId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    expect(
      rewriteLink(
        'https://www.notion.so/' + a + '#' + blockId,
        routes,
        sourceContract.rootPageId
      )
    ).toBe('/original-title#' + b)
    expect(
      rewriteLink('/' + a + '#' + blockId, routes, sourceContract.rootPageId)
    ).toBe('/original-title#' + b)
    expect(
      rewriteLink('/anything-' + a, routes, sourceContract.rootPageId)
    ).toBe('/original-title')
    expect(rewriteLink('/', routes, sourceContract.rootPageId)).toBe('/')
    const unknown = 'https://www.notion.so/' + b
    expect(rewriteLink(unknown, routes, sourceContract.rootPageId)).toBe(
      unknown
    )
  })
  it('identifies ID-shaped internal paths without rejecting ID fragments', () => {
    expect(internalPageId('/' + a)).toBe(a)
    expect(internalPageId('/anything-' + a)).toBe(a)
    expect(internalPageId('https://transitivebullsh.it/' + a)).toBe(a)
    expect(internalPageId('/original-title#' + b)).toBeUndefined()
    expect(internalPageId('https://www.notion.so/' + a)).toBeUndefined()
  })
})

describe('headings and structured metadata', () => {
  it('handles skipped levels, repeated text, and returning to a parent level', () => {
    const heading = (id: string, level: 1 | 2 | 3): Block => ({
      id,
      type: 'heading',
      level,
      richText: [plainSpan('Same heading')],
      color: 'default',
      children: []
    })
    const headings = getHeadings([
      heading(a, 1),
      heading(b, 3),
      heading('cccccccccccccccccccccccccccccccc', 2)
    ])
    expect(headings.map(({ depth }) => depth)).toEqual([0, 1, 1])
    expect(new Set(headings.map(({ id }) => id)).size).toBe(3)
  })
  it('prevents script-tag termination inside JSON-LD', () => {
    const payload = serializeJsonLd({
      headline: '</script><script>alert(1)</script>'
    })
    expect(payload).not.toContain('<')
    expect(JSON.parse(payload).headline).toBe(
      '</script><script>alert(1)</script>'
    )
  })
})

describe('project link namespaces', () => {
  const projects = {
    [b]: { slug: 'original-title', aliases: ['previous-project'], active: true }
  }
  it('resolves Notion project IDs and anchors without stealing matching article slugs', () => {
    expect(
      rewriteLink(
        'https://app.notion.com/p/' + b + '#aa-bb',
        routes,
        sourceContract.rootPageId,
        projects
      )
    ).toBe('/projects/original-title#aabb')
    expect(
      rewriteLink(
        '/original-title',
        routes,
        sourceContract.rootPageId,
        projects
      )
    ).toBe('/original-title')
    expect(
      rewriteLink(
        '/projects/previous-project',
        routes,
        sourceContract.rootPageId,
        projects
      )
    ).toBe('/projects/original-title')
    expect(resolveRoute(b, projects)).toMatchObject({
      slug: 'original-title',
      redirect: true
    })
    expect(resolveRoute('previous-project', projects)).toMatchObject({
      slug: 'original-title',
      redirect: true
    })
  })
  it('leaves private project links external and does not rewrite unrelated sites', () => {
    const href = 'https://notion.so/' + b
    expect(
      rewriteLink(href, routes, sourceContract.rootPageId, {
        [b]: { ...projects[b]!, active: false }
      })
    ).toBe(href)
    const external = 'https://example.com/' + b
    expect(
      rewriteLink(external, routes, sourceContract.rootPageId, projects)
    ).toBe(external)
  })
})
