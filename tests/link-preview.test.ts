import { describe, expect, it } from 'vitest'
import { resolveLinkPreviewTarget } from '../lib/link-preview'

const internal = new Set(['/article', '/another-article'])
const origin = 'https://transitivebullsh.it'

describe('link preview targeting', () => {
  it('allows article links in internal-only scopes and strips fragments', () => {
    expect(
      resolveLinkPreviewTarget('/article#section', origin, 'internal', internal)
    ).toEqual({
      cacheKey: '/article',
      href: '/article',
      internal: true
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
