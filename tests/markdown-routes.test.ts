import { afterEach, expect, it, vi } from 'vitest'
import { site } from '../lib/site'

vi.mock('@/lib/content/load', async () => {
  const { contentFixture, projectId } = await import('./fixtures/content')
  const content = contentFixture()
  content.projects![projectId]!.blocks.push({
    id: 'e'.repeat(32),
    type: 'embed',
    url: 'https://x.com/fixture/status/123',
    tweetId: '123',
    caption: [],
    children: []
  })
  content.tweets['123'] = {
    status: 'available',
    data: {
      __typename: 'Tweet',
      id_str: '123',
      text: 'Saved tweet body',
      lang: 'en',
      created_at: '2026-01-01',
      display_text_range: [0, 16],
      user: {
        name: 'Fixture author',
        screen_name: 'fixture',
        profile_image_url_https: 'https://example.com/avatar.png'
      },
      favorite_count: 0,
      conversation_count: 0,
      edit_control: {},
      isEdited: false,
      isStaleEdit: false
    }
  }
  return {
    content,
    articles: Object.values(content.articles),
    projects: Object.values(content.projects!)
  }
})
import { GET } from '../app/markdown/[...path]/route'

const request = (path: string[]) =>
  GET(new Request(site.origin), { params: Promise.resolve({ path }) })
afterEach(() => vi.unstubAllGlobals())

it('serves the correct article and project bodies, canonical headers, and saved tweet text', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error('Unexpected runtime fetch'))
  vi.stubGlobal('fetch', fetcher)
  for (const [path, title, body, other] of [
    [
      ['fixture-article'],
      'Fixture article',
      'Distinct article body',
      'Distinct project body'
    ],
    [
      ['projects', 'fixture-project'],
      'Fixture project',
      'Distinct project body',
      'Distinct article body'
    ]
  ] as const) {
    const response = await request([...path])
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8'
    )
    expect(response.headers.get('link')).toBe(
      `<${site.origin}/${path.join('/')}>; rel="canonical"`
    )
    const markdown = await response.text()
    expect(markdown.startsWith('# ' + title + '\n')).toBe(true)
    expect(markdown).toContain(body)
    expect(markdown).not.toContain(other)
  }
  const markdown = await (await request(['projects', 'fixture-project'])).text()
  expect(markdown).toContain('Fixture author (@fixture):\n\n> Saved tweet body')
  expect(markdown).toContain(
    '[View original post](<https://x.com/fixture/status/123>)'
  )
  expect(fetcher).not.toHaveBeenCalled()
})

it('redirects IDs and aliases and returns recoverable 404 responses for unknown paths', async () => {
  for (const path of [['a'.repeat(32)], ['old-article']]) {
    const redirect = await request(path)
    expect(redirect.status).toBe(308)
    expect(redirect.headers.get('location')).toBe('/fixture-article.md')
  }
  for (const path of [
    ['not-a-page'],
    ['projects', 'not-a-page'],
    ['projects', 'fixture-project', 'extra']
  ]) {
    const response = await request(path)
    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(await response.text()).toContain('/llms.txt')
  }
})
