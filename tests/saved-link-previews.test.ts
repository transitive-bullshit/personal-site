import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSavedLinkPreview,
  savedLinkPreviews
} from '../lib/saved-link-previews'

vi.mock('../scripts/bookmarks', () => ({
  fetchBookmarkPage:
    vi.fn<typeof import('../scripts/bookmarks').fetchBookmarkPage>()
}))
import { fetchBookmarkPage } from '../scripts/bookmarks'
import { GET } from '../app/api/link-preview/route'

const fetchPage = vi.mocked(fetchBookmarkPage)

beforeEach(() => {
  fetchPage.mockReset()
})

describe('saved external link previews', () => {
  it.each(savedLinkPreviews)(
    'serves $title and a local social image when upstream fetching is unavailable',
    async (preview) => {
      fetchPage.mockRejectedValue(new Error('HTTP 403'))
      const url = preview.url
      const response = await GET(
        new Request(
          'https://example.com/api/link-preview?url=' + encodeURIComponent(url)
        )
      )
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.url).toBe(url)
      expect(data.title).toBe(preview.title)
      expect(data.description).toBeTruthy()
      expect(data.image).toMatch(/^\/link-previews\/[^/]+\.webp$/)
      const bytes = readFileSync(
        new URL('../public' + data.image, import.meta.url)
      )
      const dimensions = await sharp(bytes).metadata()
      expect([dimensions.width, dimensions.height, dimensions.format]).toEqual([
        1200,
        630,
        'webp'
      ])
      expect(fetchPage).not.toHaveBeenCalled()
    }
  )

  it('matches fragments and trailing slashes without matching unrelated destinations', () => {
    expect(
      getSavedLinkPreview('https://openai.com/daybreak#details')?.title
    ).toContain('Daybreak')
    for (const url of [
      'https://openai.com/daybreak/other',
      'https://openai.com/daybreak?other=page',
      'https://example.com/daybreak/',
      'https://user:password@openai.com/daybreak/',
      'not a URL'
    ])
      expect(getSavedLinkPreview(url)).toBeUndefined()
  })

  it('uses the same saved video preview at a timestamp without matching another video', () => {
    const video = getSavedLinkPreview(
      'https://www.youtube.com/watch?v=cJsHel27Z6M&t=489s'
    )
    expect(video?.title).toBe('Building Cyber Defense for the Agentic Era')
    expect(video?.image).toMatch(/^\/link-previews\/mandia-video-/)
    expect(
      getSavedLinkPreview(
        'https://www.youtube.com/watch?v=another-video&t=489s'
      )
    ).toBeUndefined()
  })

  it('keeps live preview discovery for URLs without a saved preview', async () => {
    fetchPage.mockResolvedValue({
      url: 'https://example.com/',
      title: 'Live preview',
      description: 'Live description',
      images: []
    })
    const response = await GET(
      new Request(
        'https://example.com/api/link-preview?url=https%3A%2F%2Fexample.com%2F'
      )
    )
    expect(response.status).toBe(200)
    expect((await response.json()).title).toBe('Live preview')
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith('https://example.com/')
  })
})
