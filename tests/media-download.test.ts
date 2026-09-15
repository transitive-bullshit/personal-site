import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@/lib/content/load', () => ({
  content: {
    media: {
      sample: {
        original: {
          key: 'personal-site/media/example.gif',
          url: 'https://assets.cultural-alignment.com/personal-site/media/example.gif',
          mime: 'image/gif'
        }
      }
    }
  }
}))

import { GET } from '../app/api/media-download/[filename]/route'

afterEach(() => vi.unstubAllGlobals())
const get = (filename: string) =>
  GET(new Request('https://example.com'), {
    params: Promise.resolve({ filename })
  })

it('streams the unchanged original as an attachment', async () => {
  const bytes = new Uint8Array([71, 73, 70, 56, 57, 97])
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(new Response(bytes))
  vi.stubGlobal('fetch', fetch)
  const response = await get('example.gif')
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('image/gif')
  expect(response.headers.get('content-disposition')).toBe(
    'attachment; filename="example.gif"'
  )
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  expect(fetch).toHaveBeenCalledWith(
    'https://assets.cultural-alignment.com/personal-site/media/example.gif',
    expect.objectContaining({ redirect: 'error' })
  )
})

it('rejects unknown names and arbitrary URLs without fetching', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
  vi.stubGlobal('fetch', fetch)
  for (const name of [
    'missing.png',
    '../example.gif',
    'https://example.com/image'
  ]) {
    expect((await get(name)).status).toBe(404)
  }
  expect(fetch).not.toHaveBeenCalled()
})

it('does not cache upstream failures as downloadable images', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('Unavailable', { status: 403 }))
  )
  const response = await get('example.gif')
  expect(response.status).toBe(502)
  expect(response.headers.get('cache-control')).toBeNull()
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('Timeout'))
  )
  expect((await get('example.gif')).status).toBe(502)
})
