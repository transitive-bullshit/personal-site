import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import config from '../next.config'
import { legacyRedirects } from '../lib/content/legacy-redirects'
import { resolveRoute, validateSlug } from '../lib/content/routes'
import type { Snapshot } from '../lib/content/schema'

describe('legacy redirects', () => {
  it('target published pages in the committed snapshot', async () => {
    const snapshot: Snapshot = JSON.parse(
      await readFile('content/snapshot.json', 'utf8')
    )
    for (const destination of new Set(Object.values(legacyRedirects))) {
      if (destination === '/') continue
      const [, collection, slug] =
        destination.match(/^\/(?:(projects)\/)?([^/]+)$/) ?? []
      const routes =
        collection === 'projects' ? snapshot.projectRoutes! : snapshot.routes
      expect({ destination, route: resolveRoute(slug!, routes) }).toMatchObject(
        { destination, route: { slug, redirect: false } }
      )
    }
  })

  it('reserve their slugs so content cannot be shadowed', () => {
    for (const slug of [...Object.keys(legacyRedirects), 'tags'])
      expect(() => validateSlug(slug)).toThrow(slug)
  })

  it('are permanent', async () => {
    const redirects = await config.redirects!()
    expect(redirects).toContainEqual({
      source: '/about',
      destination: '/',
      permanent: true
    })
    expect(redirects.every((redirect) => redirect.permanent)).toBe(true)
  })
})
