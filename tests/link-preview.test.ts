import { describe, expect, it } from 'vitest'
import { resolveLinkPreviewTarget } from '../lib/link-preview'

const internal = new Set(['/article', '/another-article'])
const origin = 'https://transitivebullsh.it'
const page = origin + '/article'

describe('link preview targeting', () => {
  it('allows article links in internal-only scopes and strips fragments', () => {
    expect(
      resolveLinkPreviewTarget(
        '/another-article#section',
        page,
        'internal',
        internal
      )
    ).toEqual({
      cacheKey: '/another-article',
      href: '/another-article',
      internal: true
    })
  })

  it('excludes footnotes and every form of same-page navigation', () => {
    for (const href of [
      '#source-1',
      '?mode=reading',
      '/article',
      '/article#source-1',
      '/article?mode=reading#source-1',
      '/article/#source-1',
      new URL('#source-1', page).href
    ])
      expect(
        resolveLinkPreviewTarget(href, page, 'article', internal)
      ).toBeUndefined()
  })

  it('recognizes canonical self-links and other site pages while on a preview', () => {
    const previewPage = 'https://preview.vercel.app/article'
    for (const siteOrigin of [origin, 'https://www.transitivebullsh.it']) {
      expect(
        resolveLinkPreviewTarget(
          siteOrigin + '/article#source-1',
          previewPage,
          'article',
          internal
        )
      ).toBeUndefined()
      expect(
        resolveLinkPreviewTarget(
          siteOrigin + '/another-article#section',
          previewPage,
          'article',
          internal
        )
      ).toEqual({
        cacheKey: '/another-article',
        href: '/another-article',
        internal: true
      })
    }
    expect(
      resolveLinkPreviewTarget(
        'https://example.com/article#section',
        previewPage,
        'article',
        internal
      )
    ).toEqual({
      cacheKey: 'https://example.com/article',
      href: 'https://example.com/article',
      internal: false
    })
  })

  it('allows external web links only in article scopes', () => {
    expect(
      resolveLinkPreviewTarget(
        'https://example.com/post#details',
        origin,
        'article',
        internal
      )
    ).toEqual({
      cacheKey: 'https://example.com/post',
      href: 'https://example.com/post',
      internal: false
    })
    expect(
      resolveLinkPreviewTarget(
        'https://example.com/post',
        origin,
        'internal',
        internal
      )
    ).toBeUndefined()
  })

  it('rejects fragments, non-article site routes, credentials, and non-web links', () => {
    for (const href of [
      '#section',
      '/writing',
      'mailto:hello@example.com',
      'https://user:secret@example.com'
    ])
      expect(
        resolveLinkPreviewTarget(href, origin, 'article', internal)
      ).toBeUndefined()
  })
})
