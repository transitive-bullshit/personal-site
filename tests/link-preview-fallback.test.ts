import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fallbackLinkPreview } from '../lib/link-preview'

vi.mock('../scripts/bookmarks', () => ({
  fetchBookmarkPage:
    vi.fn<typeof import('../scripts/bookmarks').fetchBookmarkPage>()
}))
const dns = vi.hoisted(() => ({
  lookup:
    vi.fn<
      (
        hostname: string,
        options: { all: true }
      ) => Promise<{ address: string; family: number }[]>
    >()
}))
vi.mock('node:dns/promises', () => dns)
const lookup = dns.lookup
import { fetchBookmarkPage } from '../scripts/bookmarks'
import { GET } from '../app/api/link-preview/route'
import { GET as image } from '../app/api/link-preview/fallback/route'

const request = (url: string) =>
  new Request(
    'https://example.com/api/link-preview?url=' + encodeURIComponent(url)
  )

beforeEach(() => {
  vi.mocked(fetchBookmarkPage).mockReset()
  vi.mocked(lookup).mockReset()
  vi.mocked(lookup).mockResolvedValue([{ address: '1.1.1.1', family: 4 }])
})
afterEach(() => vi.unstubAllGlobals())

describe('external preview fallbacks', () => {
  it('infers a PDF title while retaining supplied metadata for text-only pages', () => {
    expect(
      fallbackLinkPreview('https://example.com/reports/security-review.pdf')
        ?.title
    ).toBe('security review')
    expect(
      fallbackLinkPreview('https://example.com/', { title: 'Published title' })
        ?.title
    ).toBe('Published title')
    expect(
      fallbackLinkPreview('https://example.com/%broken')?.image
    ).toBeTruthy()
    expect(fallbackLinkPreview('javascript:alert(1)')).toBeUndefined()
  })

  it('adds an image to a successful text-only preview', async () => {
    vi.mocked(fetchBookmarkPage).mockResolvedValue({
      url: 'https://example.com/paper',
      title: 'Research title',
      description: 'Published description',
      images: []
    })
    const data = await (await GET(request('https://example.com/paper'))).json()
    expect(data.title).toBe('Research title')
    expect(data.description).toBe('Published description')
    expect(data.image).toMatch(/^\/api\/link-preview\/fallback\?/)
  })

  it('returns a rendered fallback for a blocked public page and preserves private URL rejection', async () => {
    vi.mocked(fetchBookmarkPage).mockRejectedValue(new Error('HTTP 403'))
    const response = await GET(request('https://example.com/blocked-page'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const data = await response.json()
    expect(data.fallback).toBe(true)
    expect(data.image).toMatch(/^\/api\/link-preview\/fallback\?/)
    vi.mocked(lookup).mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    expect((await GET(request('https://private.example/'))).status).toBe(422)
    expect((await GET(request('file:///tmp/private'))).status).toBe(422)
    expect(
      (await GET(request('https://user:password@example.com/'))).status
    ).toBe(422)
  })

  it('renders a 1200×630 WebP without fetching the destination', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const preview = fallbackLinkPreview('https://example.com/report.pdf', {
      title: 'Example report'
    })!
    const response = await image(
      new Request('https://example.com' + preview.image)
    )
    expect(response.headers.get('content-type')).toContain('image/webp')
    const dimensions = await sharp(
      Buffer.from(await response.arrayBuffer())
    ).metadata()
    expect([dimensions.width, dimensions.height]).toEqual([1200, 630])
    expect(fetcher).not.toHaveBeenCalled()
    expect(
      (
        await image(
          new Request(
            'https://example.com/api/link-preview/fallback?url=file:///tmp/private'
          )
        )
      ).status
    ).toBe(400)
  })
})
