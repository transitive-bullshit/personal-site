import { describe, expect, it, vi } from 'vitest'
import { activeHeading } from '../lib/content/active-heading'
import {
  parseBookmark,
  syncBookmarks,
  fetchBookmark
} from '../scripts/bookmarks'
import { isPublicAddress } from '../scripts/public-fetch'
import type { Media } from '../lib/content/schema'

describe('active table of contents heading', () => {
  const headings = [
    { id: 'first', top: -200 },
    { id: 'second', top: 160 },
    { id: 'last', top: 340 }
  ]
  it('selects the final heading when short final sections reach the article bottom', () => {
    expect(
      activeHeading(headings, {
        articleBottom: 700,
        documentBottom: 950,
        height: 800,
        scrollY: 3000
      })
    ).toBe('last')
  })
  it('selects the final heading at document bottom even with rounding', () => {
    expect(
      activeHeading(headings, {
        articleBottom: 900,
        documentBottom: 801,
        height: 800,
        scrollY: 3000
      })
    ).toBe('last')
  })
  it('restores normal heading tracking when scrolling back up or resizing shorter', () => {
    expect(
      activeHeading(headings, {
        articleBottom: 700,
        documentBottom: 950,
        height: 500,
        scrollY: 2500
      })
    ).toBe('first')
    expect(
      activeHeading([], {
        articleBottom: 0,
        documentBottom: 0,
        height: 800,
        scrollY: 0
      })
    ).toBeUndefined()
  })
})

describe('cached bookmark previews', () => {
  it('reads social metadata regardless of attribute order, decodes entities, and resolves relative images', () => {
    const result = parseBookmark(
      '<head><meta content="A &amp; B" property="og:title"><meta name="description" content="A description"><meta content="../share.png?x=1&amp;y=2" property="og:image"><meta name="twitter:image" content="//cdn.example.com/fallback.png"></head>',
      'https://example.com/posts/one'
    )
    expect(result).toEqual({
      title: 'A & B',
      description: 'A description',
      images: [
        'https://example.com/share.png?x=1&y=2',
        'https://cdn.example.com/fallback.png'
      ]
    })
  })
  it('falls back to the document title and rejects non-web image URLs', () => {
    expect(
      parseBookmark(
        '<title>Fallback</title><meta property="og:image" content="javascript:bad">',
        'https://example.com'
      )
    ).toEqual({ title: 'Fallback', description: '', images: [] })
  })
  it('deduplicates discovery and caches remote images before publishing preview metadata', async () => {
    const image = { original: { mime: 'image/png' } } as Media
    const saveImage = vi
      .fn<(key: string, url: string) => Promise<Media>>()
      .mockResolvedValue(image)
    const fetchPreview = vi.fn<typeof fetchBookmark>().mockResolvedValue({
      title: 'Page',
      description: 'Details',
      images: ['https://example.com/share.png']
    })
    const result = await syncBookmarks({
      urls: ['https://example.com', 'https://example.com'],
      previous: {},
      force: false,
      dryRun: false,
      fetchPreview,
      saveImage,
      warn: () => {}
    })
    expect(fetchPreview).toHaveBeenCalledTimes(1)
    expect(saveImage).toHaveBeenCalledTimes(1)
    expect(result.bookmarks['https://example.com']?.image).toBe(image)
    fetchPreview.mockClear()
    saveImage.mockClear()
    const repeated = await syncBookmarks({
      urls: ['https://example.com'],
      previous: result.bookmarks,
      force: false,
      dryRun: false,
      fetchPreview,
      saveImage,
      warn: () => {}
    })
    expect(repeated.bookmarks).toEqual(result.bookmarks)
    expect(fetchPreview).not.toHaveBeenCalled()
    expect(saveImage).not.toHaveBeenCalled()
  })
  it('does no network work in dry-run and retains saved data on a failed force refresh', async () => {
    const previous = {
      'https://example.com': {
        title: 'Saved',
        description: 'Saved description'
      }
    }
    const fetchPreview = vi
      .fn<typeof fetchBookmark>()
      .mockRejectedValue(new Error('Timeout'))
    const saveImage = vi.fn<(key: string, url: string) => Promise<Media>>()
    const options = {
      urls: ['https://example.com'],
      previous,
      force: true,
      dryRun: true,
      fetchPreview,
      saveImage,
      warn: () => {}
    }
    expect((await syncBookmarks(options)).bookmarks).toEqual(previous)
    expect(fetchPreview).not.toHaveBeenCalled()
    expect(saveImage).not.toHaveBeenCalled()
    expect(
      (await syncBookmarks({ ...options, dryRun: false })).bookmarks
    ).toEqual(previous)
  })
  it('refreshes bookmark text without syncing images in fast mode', async () => {
    const image = { original: { mime: 'image/png' } } as Media
    const saveImage = vi.fn<(key: string, url: string) => Promise<Media>>()
    const fetchPreview = vi.fn<typeof fetchBookmark>().mockResolvedValue({
      title: 'Refreshed',
      description: 'New description',
      images: ['https://example.com/new.png']
    })
    const result = await syncBookmarks({
      urls: ['https://example.com'],
      previous: {
        'https://example.com': {
          title: 'Saved',
          description: 'Old description',
          image
        }
      },
      force: true,
      dryRun: false,
      skipImages: true,
      fetchPreview,
      saveImage,
      warn: () => {}
    })

    expect(result.bookmarks['https://example.com']).toEqual({
      title: 'Refreshed',
      description: 'New description',
      needsImageSync: true,
      image
    })
    expect(fetchPreview).toHaveBeenCalledTimes(1)
    expect(saveImage).not.toHaveBeenCalled()

    fetchPreview.mockClear()
    saveImage.mockResolvedValue(image)
    const completed = await syncBookmarks({
      urls: ['https://example.com'],
      previous: result.bookmarks,
      force: false,
      dryRun: false,
      fetchPreview,
      saveImage,
      warn: () => {}
    })
    expect(fetchPreview).toHaveBeenCalledTimes(1)
    expect(saveImage).toHaveBeenCalledTimes(1)
    expect(
      completed.bookmarks['https://example.com']?.needsImageSync
    ).toBeUndefined()
  })
  it('excludes local network destinations including IPv4-mapped IPv6', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '::1',
      'fc00::1',
      '::ffff:127.0.0.1'
    ])
      expect(isPublicAddress(ip)).toBe(false)
    expect(isPublicAddress('1.1.1.1')).toBe(true)
  })
})
