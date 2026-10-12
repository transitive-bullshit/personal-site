import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { expect, it, vi } from 'vitest'
import { syncBookmarks } from '../scripts/bookmarks'
import { saveBookmarkScreenshot } from '../scripts/bookmark-screenshots'
import { bookmarkScreenshotSchema } from '../lib/content/schema'
import { load } from 'cheerio'
import {
  rebaseScreenshotHtml,
  rebaseScreenshotCss
} from '../scripts/bookmark-screenshot-resources'

const url = 'https://example.com/article'
const screenshot = {
  url: '/bookmarks/' + 'a'.repeat(64) + '.webp',
  width: 640,
  height: 480
}
const previous = { [url]: { title: 'Saved', description: 'Description' } }
type Options = Parameters<typeof syncBookmarks>[0]
const options = () => ({
  urls: [url],
  previous,
  force: false,
  dryRun: false,
  fetchPreview: vi
    .fn<NonNullable<Options['fetchPreview']>>()
    .mockResolvedValue({ title: 'Page', description: 'Details', images: [] }),
  saveImage: vi.fn<Options['saveImage']>(),
  saveScreenshot: vi
    .fn<NonNullable<Options['saveScreenshot']>>()
    .mockResolvedValue(screenshot),
  warn: vi.fn<Options['warn']>()
})

it('preserves authored base URLs and resolves them against the final document URL', () => {
  const $ = load(
    rebaseScreenshotHtml(
      '<head><base href="../assets/"></head><body>Article</body>',
      'https://example.com/docs/page/'
    )
  )
  expect($('base').length).toBe(1)
  expect($('base').attr('href')).toBe('https://example.com/docs/assets/')
  const plain = load(
    rebaseScreenshotHtml('<h1>Article</h1>', 'https://example.com/final/')
  )
  expect(plain('base').attr('href')).toBe('https://example.com/final/')
})

it('resolves CSS imports, fonts and backgrounds against redirected stylesheet URLs', () => {
  const css = rebaseScreenshotCss(
    '@import "theme.css" screen; @import url(../shared.css); @font-face { src: url("./font.woff2") } p { background: url(../bg.png); content: "url(no.png)"; mask: url(#mask); border-image: url(data:image/png;base64,abc) }',
    'https://cdn.example.com/styles/v2/main.css'
  )
  expect(css).toContain('"https://cdn.example.com/styles/v2/theme.css" screen')
  expect(css).toContain('url("https://cdn.example.com/styles/shared.css")')
  expect(css).toContain('url("https://cdn.example.com/styles/v2/font.woff2")')
  expect(css).toContain('url("https://cdn.example.com/styles/bg.png")')
  expect(css).toContain('content: "url(no.png)"')
  expect(css).toContain('url("#mask")')
  expect(css).toContain('url("data:image/png;base64,abc")')
})

it('normalizes legacy HTML and stylesheet encoding while retaining readable text', () => {
  const $ = load(
    rebaseScreenshotHtml(
      Buffer.from('<meta charset="iso-8859-1"><p>caf\xe9</p>', 'latin1'),
      url,
      'text/html; charset=iso-8859-1'
    )
  )
  expect($('p').text()).toBe('café')
  expect(
    $('meta[charset]')
      .toArray()
      .every((element) => $(element).attr('charset') === 'utf-8')
  ).toBe(true)
  const css = rebaseScreenshotCss(
    Buffer.from('@charset "iso-8859-1"; p{content:"caf\xe9"}', 'latin1'),
    url
  )
  expect(css).toContain('content:"café"')
  expect(css).toContain('@charset "UTF-8"')
})

it('resolves image-set strings without rewriting ordinary declaration strings', () => {
  const css = rebaseScreenshotCss(
    'p{background:image-set("photo.webp" 1x, url(hi.webp) 2x); mask:-webkit-image-set("mask.webp" 1x);content:"photo.webp"}',
    'https://cdn.example.com/styles/main.css'
  )
  expect(css).toContain(
    'image-set("https://cdn.example.com/styles/photo.webp" 1x, url("https://cdn.example.com/styles/hi.webp") 2x)'
  )
  expect(css).toContain(
    '-webkit-image-set("https://cdn.example.com/styles/mask.webp" 1x)'
  )
  expect(css).toContain('content:"photo.webp"')
})

it('backfills cached text-only bookmarks and reuses their captures on subsequent imports', async () => {
  const input = options()
  const first = await syncBookmarks(input)
  expect(first.bookmarks[url]?.screenshot).toEqual(screenshot)
  expect(input.saveScreenshot).toHaveBeenCalledExactlyOnceWith(url)
  input.fetchPreview.mockClear()
  input.saveScreenshot.mockClear()
  await syncBookmarks({ ...input, previous: first.bookmarks })
  expect(input.fetchPreview).not.toHaveBeenCalled()
  expect(input.saveScreenshot).not.toHaveBeenCalled()
})

it('captures when advertised images fail, but keeps an existing image instead of capturing', async () => {
  const input = options()
  input.fetchPreview.mockResolvedValue({
    title: 'Page',
    description: 'Details',
    images: ['https://example.com/broken.png']
  })
  input.saveImage.mockRejectedValue(new Error('404'))
  expect((await syncBookmarks(input)).bookmarks[url]?.screenshot).toEqual(
    screenshot
  )
  expect(input.warn).not.toHaveBeenCalled()
  input.saveScreenshot.mockClear()
  const image = {} as NonNullable<
    Awaited<ReturnType<typeof syncBookmarks>>['bookmarks'][string]['image']
  >
  const kept = await syncBookmarks({
    ...input,
    force: true,
    previous: { [url]: { ...previous[url], image } }
  })
  expect(kept.bookmarks[url]?.image).toBe(image)
  expect(input.saveScreenshot).not.toHaveBeenCalled()
})

it('prefers a saved social image over the screenshot fallback', async () => {
  const input = options()
  input.fetchPreview.mockResolvedValue({
    title: 'Page',
    description: 'Details',
    images: ['https://example.com/social.png']
  })
  const image = {} as Awaited<ReturnType<Options['saveImage']>>
  input.saveImage.mockResolvedValue(image)
  expect((await syncBookmarks(input)).bookmarks[url]?.image).toBe(image)
  expect(input.saveScreenshot).not.toHaveBeenCalled()
})

it('skips capture in dry runs and defers missing images in fast imports', async () => {
  const input = options()
  await syncBookmarks({ ...input, dryRun: true })
  expect(input.fetchPreview).not.toHaveBeenCalled()
  const fast = await syncBookmarks({ ...input, previous: {}, skipImages: true })
  expect(fast.bookmarks[url]?.needsImageSync).toBe(true)
  expect(input.saveScreenshot).not.toHaveBeenCalled()
})

it('keeps metadata and warns when capture fails, then retries on the next import', async () => {
  const input = options()
  input.saveScreenshot.mockRejectedValue(new Error('Blocked page'))
  const failed = await syncBookmarks(input)
  expect(failed.bookmarks[url]?.title).toBe('Page')
  expect(failed.bookmarks[url]?.screenshot).toBeUndefined()
  expect(input.warn).toHaveBeenCalledWith(
    expect.stringContaining('Blocked page')
  )
  input.saveScreenshot.mockResolvedValue(screenshot)
  expect(
    (await syncBookmarks({ ...input, previous: failed.bookmarks })).bookmarks[
      url
    ]?.screenshot
  ).toEqual(screenshot)
})

it('saves a bounded, content-addressed WebP with matching dimensions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bookmark-webp-'))
  try {
    const png = await sharp({
      create: { width: 1280, height: 960, channels: 3, background: '#abcdef' }
    })
      .png()
      .toBuffer()
    const result = await saveBookmarkScreenshot(png, directory)
    expect(bookmarkScreenshotSchema.parse(result)).toEqual(result)
    const bytes = await readFile(join(directory, result.url.split('/').at(-1)!))
    const info = await sharp(bytes).metadata()
    expect(info.format).toBe('webp')
    expect([info.width, info.height]).toEqual([640, 480])
    expect(bytes.length).toBeLessThan(png.length)
    expect(await saveBookmarkScreenshot(png, directory)).toEqual(result)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
