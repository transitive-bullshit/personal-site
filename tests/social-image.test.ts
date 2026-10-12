import { afterEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import {
  articleSocialImage,
  socialImageData,
  socialImageUrl
} from '../lib/social-image'
import {
  allowedSocialImageUrl,
  renderSocialImage
} from '../lib/render-social-image'
import { articleJsonLd } from '../lib/content/metadata'
import { contentFixture, articleId, storedMedia } from './fixtures/content'
import { site } from '../lib/site'
import {
  cyberSwarmArticleId,
  getBodyOverride
} from '../lib/content/body-overrides'
import { readFile } from 'node:fs/promises'

const snapshot = contentFixture()
snapshot.media.cover = storedMedia()
const article = { ...snapshot.articles[articleId]!, cover: 'cover' }
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('uses the current Learn in Public hero directly, including after slug or cover changes', () => {
  const essay = {
    ...article,
    id: '3f7edb27f12481ad887ee8617d554ab2',
    slug: 'renamed-learn-in-public'
  }
  const cover = snapshot.media.cover!.variants.at(-1)!
  expect(articleSocialImage(essay, snapshot)).toEqual({
    url: cover.url,
    width: cover.width,
    height: cover.height,
    alt: essay.title,
    type: cover.mime
  })
  expect(articleJsonLd(essay, snapshot).image[0]).toBe(cover.url)
  const replacement = {
    ...snapshot,
    media: { cover: storedMedia('cover', '2'.repeat(64), '4'.repeat(64)) }
  }
  expect(socialImageUrl(essay, replacement)).toBe(
    replacement.media.cover.variants.at(-1)!.url
  )
  expect(socialImageUrl({ ...essay, cover: undefined }, snapshot)).toContain(
    '/api/social-image/renamed-learn-in-public?v='
  )
})

it('uses the essay illustration for sharing even after its CMS slug changes', async () => {
  const essay = { ...article, id: cyberSwarmArticleId, slug: 'renamed-draft' }
  const path = getBodyOverride(essay.id)!.socialImagePath!
  const url = socialImageUrl(essay, snapshot)
  expect(new URL(url).pathname).toBe(path)
  expect(articleJsonLd(essay, snapshot).image[0]).toBe(url)
  const bytes = await readFile('public' + path)
  expect(await sharp(bytes).metadata()).toMatchObject({
    width: 1200,
    height: 630,
    format: 'webp'
  })
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
  const replacement = {
    ...snapshot,
    media: { cover: storedMedia('cover', '2'.repeat(64), '4'.repeat(64)) }
  }
  expect(socialImageUrl(article, replacement)).not.toBe(url)
  expect(socialImageData(article, snapshot).cover).toBe(
    'https://assets.cultural-alignment.com/personal-site/media/' +
      '3'.repeat(64) +
      '.webp'
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
  expect(response.headers.get('cache-control')).toBe(
    'public, max-age=0, must-revalidate'
  )
  expect(response.headers.get('cdn-cache-control')).toBe(
    'public, max-age=86400, stale-while-revalidate=604800'
  )
  expect(response.headers.get('vercel-cdn-cache-control')).toBe(
    'public, max-age=31536000, immutable'
  )
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

it('renders without remote requests and keeps CDN caching when a cover fails', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('Not found', { status: 404 }))
  vi.stubGlobal('fetch', fetcher)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const data = socialImageData(article, snapshot)
  const plain = await renderSocialImage({ ...data, cover: undefined })
  expect(
    await sharp(Buffer.from(await plain.arrayBuffer())).metadata()
  ).toMatchObject({ width: 1200, height: 630, format: 'webp' })
  expect(fetcher).not.toHaveBeenCalled()
  const fallback = await renderSocialImage(data)
  expect(fallback.headers.get('cache-control')).toBe(
    'public, max-age=0, must-revalidate'
  )
  expect(fallback.headers.get('cdn-cache-control')).toBe(
    'public, max-age=86400, stale-while-revalidate=604800'
  )
  expect(fallback.headers.get('vercel-cdn-cache-control')).toBe(
    'public, max-age=31536000, immutable'
  )
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0]![0]).toBe(data.cover)
  expect(
    await sharp(Buffer.from(await fallback.arrayBuffer())).metadata()
  ).toMatchObject({ width: 1200, height: 630, format: 'webp' })
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

it.each(['preview', 'production'])(
  'uses the current Vercel deployment for social assets in %s while keeping article canonicals stable',
  (environment) => {
    vi.stubEnv('VERCEL_ENV', environment)
    vi.stubEnv('VERCEL_URL', 'personal-site-build-123.vercel.app')
    vi.stubEnv(
      'VERCEL_PROJECT_PRODUCTION_URL',
      'personal-site-nu-nine-53.vercel.app'
    )
    vi.stubEnv(
      'VERCEL_BRANCH_URL',
      'personal-site-git-feature-saasify.vercel.app'
    )
    const url = socialImageUrl(article, snapshot)
    expect(new URL(url).origin).toBe(
      environment === 'production'
        ? 'https://personal-site-nu-nine-53.vercel.app'
        : 'https://personal-site-git-feature-saasify.vercel.app'
    )
    expect(new URL(url).pathname).toBe('/api/social-image/' + article.slug)
    const jsonLd = articleJsonLd(article, snapshot)
    expect(jsonLd.image[0]).toBe(url)
    expect(jsonLd.url).toBe(site.origin + '/' + article.slug)
    expect(jsonLd.mainEntityOfPage).toBe(jsonLd.url)
  }
)

it('falls back to the canonical origin outside Vercel', () => {
  vi.stubEnv('VERCEL_URL', undefined)
  vi.stubEnv('VERCEL_BRANCH_URL', undefined)
  vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', undefined)
  expect(new URL(socialImageUrl(article, snapshot)).origin).toBe(site.origin)
})

it('uses the deployment URL as a preview fallback when there is no branch alias', () => {
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('VERCEL_BRANCH_URL', undefined)
  vi.stubEnv('VERCEL_URL', 'personal-site-preview.vercel.app')
  vi.stubEnv(
    'VERCEL_PROJECT_PRODUCTION_URL',
    'personal-site-nu-nine-53.vercel.app'
  )
  expect(new URL(socialImageUrl(article, snapshot)).origin).toBe(
    'https://personal-site-preview.vercel.app'
  )
})
