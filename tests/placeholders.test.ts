import { expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backfillPlaceholders } from '../scripts/media/placeholders'
import { MediaCache } from '../scripts/media/cache'
import type { Media } from '../lib/content/schema'

function fixture(key: string): Media {
  return {
    source: { key, kind: 'file', edited: '2026-09-15' },
    pipelineVersion: 1,
    original: {
      url:
        'https://assets.cultural-alignment.com/personal-site/media/' +
        'a'.repeat(64) +
        '.png',
      key: 'personal-site/media/' + 'a'.repeat(64) + '.png',
      hash: 'a'.repeat(64),
      mime: 'image/png',
      bytes: 100,
      width: 100,
      height: 50
    },
    variants: []
  }
}

it('backfills shared article and bookmark images once and reuses saved placeholders', async () => {
  const bytes = await sharp({
    create: { width: 100, height: 50, channels: 3, background: '#446688' }
  })
    .png()
    .toBuffer()
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(new Uint8Array(bytes)))
  const snapshot = {
    media: { cover: fixture('cover') },
    bookmarks: {
      'https://example.com': {
        title: 'Link',
        description: '',
        image: fixture('bookmark')
      }
    }
  }
  const original = structuredClone(snapshot.media.cover.original)
  expect(await backfillPlaceholders(snapshot, { dryRun: false, fetcher })).toBe(
    2
  )
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0]![0]).toBe(original.url)
  expect(snapshot.media.cover.original).toEqual(original)
  expect(snapshot.media.cover.blurDataURL).toBe(
    snapshot.bookmarks['https://example.com'].image.blurDataURL
  )
  expect(await backfillPlaceholders(snapshot, { dryRun: false, fetcher })).toBe(
    0
  )
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('keeps dry runs read-only and does not publish a failed image preview', async () => {
  const snapshot = { media: { cover: fixture('cover') } }
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('bad image'))
  expect(await backfillPlaceholders(snapshot, { dryRun: true, fetcher })).toBe(
    0
  )
  expect(fetcher).not.toHaveBeenCalled()
  expect(snapshot.media.cover.blurDataURL).toBeUndefined()
  await expect(
    backfillPlaceholders(snapshot, { dryRun: false, fetcher })
  ).rejects.toThrow()
  expect(snapshot.media.cover.blurDataURL).toBeUndefined()
})

it('resumes completed placeholders by content hash without fetching and rejects stale cache entries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'personal-site-blur-'))
  try {
    const cache = await MediaCache.open(join(dir, 'media.json'))
    const saved = {
      ...fixture('cover'),
      blurDataURL: 'data:image/webp;base64,AAAA'
    }
    await cache.save(saved)
    const snapshot = { media: { cover: fixture('cover') } }
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('bad image'))
    await backfillPlaceholders(snapshot, { dryRun: false, cache, fetcher })
    expect(snapshot.media.cover.blurDataURL).toBe(saved.blurDataURL)
    expect(fetcher).not.toHaveBeenCalled()
    const changed = { media: { cover: fixture('cover') } }
    changed.media.cover.original.hash = 'b'.repeat(64)
    await expect(
      backfillPlaceholders(changed, { dryRun: false, cache, fetcher })
    ).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(changed.media.cover.blurDataURL).toBeUndefined()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
