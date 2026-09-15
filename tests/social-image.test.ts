import { afterEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { socialImageData, socialImageUrl } from '../lib/social-image'
import {
  allowedSocialImageUrl,
  renderSocialImage
} from '../lib/render-social-image'
import { articleJsonLd } from '../lib/content/metadata'
import { snapshotSchema } from '../lib/content/schema'

const snapshot = snapshotSchema.parse(
  JSON.parse(readFileSync('content/snapshot.json', 'utf8'))
)
const article = Object.values(snapshot.articles)[0]!
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('versions canonical social URLs when visible metadata or the cached cover changes', () => {
  const url = socialImageUrl(article, snapshot)
  expect(url).toMatch(
    new RegExp('/api/social-image/' + article.slug + '\\?v=[a-f0-9]{16}$')
  )
  expect(socialImageUrl({ ...article }, snapshot)).toBe(url)
  expect(
    socialImageUrl({ ...article, title: 'Changed title' }, snapshot)
  ).not.toBe(url)
  expect(
    socialImageUrl({ ...article, description: 'Changed description' }, snapshot)
  ).not.toBe(url)
  expect(socialImageUrl({ ...article, cover: undefined }, snapshot)).not.toBe(
    url
  )
  expect(socialImageData(article, snapshot).cover).toBe(
    snapshot.media[article.cover!]!.variants.at(-1)!.url
  )
  expect(articleJsonLd(article, snapshot).image[0]).toBe(url)
})

it('restricts renderer fetches to immutable images in the site bucket namespace', () => {
  expect(allowedSocialImageUrl(socialImageData(article, snapshot).cover!)).toBe(
    true
  )
  for (const url of [
    'http://127.0.0.1/image.png',
    'https://example.com/image.png',
    'https://assets.cultural-alignment.com/other/image.png',
    'https://assets.cultural-alignment.com/personal-site/media/' +
      'a'.repeat(64) +
      '.png?redirect=1'
  ])
    expect(allowedSocialImageUrl(url)).toBe(false)
})

it('renders a 1200×630 WebP with the cover and CDN cache headers', async () => {
  const cover = await sharp({
    create: { width: 24, height: 24, channels: 3, background: '#ff0000' }
  })
    .png()
    .toBuffer()
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(new Uint8Array(cover), {
        headers: { 'content-type': 'image/png' }
      })
  )
  vi.stubGlobal('fetch', fetcher)
  const response = await renderSocialImage(socialImageData(article, snapshot))
  expect(response.headers.get('content-type')).toBe('image/webp')
  expect(response.headers.get('cache-control')).toContain('s-maxage=86400')
  const bytes = Buffer.from(await response.arrayBuffer())
  const metadata = await sharp(bytes).metadata()
  expect([metadata.width, metadata.height, metadata.format]).toEqual([
    1200,
    630,
    'webp'
  ])
  const pixel = await sharp(bytes)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer()
  expect(pixel[0]).toBeGreaterThan(150)
  expect(pixel[1]).toBeLessThan(20)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('renders without remote requests when there is no cover, and recovers from a failed cover with a short cache', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('Not found', { status: 404 }))
  vi.stubGlobal('fetch', fetcher)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const data = socialImageData(article, snapshot)
  const plain = await renderSocialImage({ ...data, cover: undefined })
  expect((await plain.arrayBuffer()).byteLength).toBeGreaterThan(1000)
  expect(fetcher).not.toHaveBeenCalled()
  const fallback = await renderSocialImage(data)
  expect(fallback.headers.get('cache-control')).toContain('s-maxage=300')
  expect((await fallback.arrayBuffer()).byteLength).toBeGreaterThan(1000)
})

it('centers balanced short and long titles in the actual rendered pixels', async () => {
  for (const title of [
    'The Best JavaScript Dev Tools in 2022',
    'Open Sourcing Twitter’s Algorithm Part 1: How Twitter Works'
  ]) {
    const response = await renderSocialImage({
      ...socialImageData(article, snapshot),
      title,
      cover: undefined
    })
    const { data, info } = await sharp(
      Buffer.from(await response.arrayBuffer())
    )
      .extract({ left: 134, top: 160, width: 932, height: 280 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let left = info.width
    let right = 0
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        const index = (y * info.width + x) * info.channels
        if (
          data[index]! < 60 &&
          data[index + 1]! < 60 &&
          data[index + 2]! < 60
        ) {
          left = Math.min(left, x)
          right = Math.max(right, x)
        }
      }
    expect(right).toBeGreaterThan(left)
    expect(Math.abs(134 + (left + right) / 2 - 600)).toBeLessThan(3)
  }
})
