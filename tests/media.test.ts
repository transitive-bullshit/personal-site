import { describe, expect, it } from 'vitest'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import type { Media, MediaSource } from '../lib/content/schema'
import {
  MediaStorage,
  hashBytes,
  type StorageTransport
} from '../scripts/media/storage'
import {
  canReuseMedia,
  processMedia,
  MEDIA_PIPELINE_VERSION
} from '../scripts/media/process'

const config = {
  bucket: 'test',
  publicOrigin: 'https://assets.example.com',
  client: {
    endpoint: 'https://storage.example.com',
    region: 'auto',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    maxAttempts: 3
  }
}
const missing = () =>
  Object.assign(new Error('Not found'), { $metadata: { httpStatusCode: 404 } })

function transport() {
  const objects = new Map<string, Uint8Array>()
  const calls: string[] = []
  const api: StorageTransport = {
    async send(command) {
      if (command instanceof HeadObjectCommand) {
        calls.push('HEAD')
        if (!objects.has(command.input.Key!)) throw missing()
        return {}
      }
      calls.push('PUT')
      objects.set(command.input.Key!, command.input.Body as Uint8Array)
      return {}
    }
  }
  return { api, objects, calls }
}

describe('immutable media publication', () => {
  it('uses HEAD before PUT and uploads identical bytes once', async () => {
    const mock = transport()
    const storage = new MediaStorage(config, mock.api)
    const bytes = Buffer.from('an asset')
    const first = await storage.publish(
      bytes,
      'application/octet-stream',
      'bin'
    )
    expect(mock.calls).toEqual(['HEAD', 'PUT'])
    const second = await storage.publish(
      bytes,
      'application/octet-stream',
      'bin'
    )
    expect(first).toEqual(second)
    expect(mock.objects.size).toBe(1)
    expect(first.key).toContain(hashBytes(bytes))
    expect(storage.stats.uploaded).toBe(1)
  })
  it('does not mistake authorization or service errors for missing objects', async () => {
    for (const status of [403, 500]) {
      const mock: StorageTransport = {
        async send() {
          throw Object.assign(new Error('failure'), {
            $metadata: { httpStatusCode: status }
          })
        }
      }
      await expect(
        new MediaStorage(config, mock).publish(
          Buffer.from('x'),
          'text/plain',
          'txt'
        )
      ).rejects.toThrow('failure')
    }
  })
  it('handles a conditional-write race without overwriting', async () => {
    const api: StorageTransport = {
      async send(command) {
        if (command instanceof HeadObjectCommand) throw missing()
        expect(command.input.IfNoneMatch).toBe('*')
        throw Object.assign(new Error('Exists'), {
          $metadata: { httpStatusCode: 412 }
        })
      }
    }
    const storage = new MediaStorage(config, api)
    await storage.publish(Buffer.from('x'), 'text/plain', 'txt')
    expect(storage.stats.reused).toBe(1)
    expect(storage.stats.uploaded).toBe(0)
  })
  it('retains original still bytes and makes responsive non-upscaled variants', async () => {
    const source = await sharp({
      create: { width: 1100, height: 600, channels: 3, background: '#446688' }
    })
      .png()
      .toBuffer()
    const mock = transport()
    const result = await processMedia(
      source,
      'image/png',
      new MediaStorage(config, mock.api)
    )
    expect(Buffer.from(mock.objects.get(result.original.key)!)).toEqual(source)
    const blur = await sharp(
      Buffer.from(result.blurDataURL!.split(',')[1]!, 'base64')
    ).metadata()
    expect(blur.width).toBe(8)
    expect(blur.height).toBeLessThanOrEqual(8)
    expect(result.blurDataURL!.length).toBeLessThan(2048)
    expect(result.variants.map((item) => item.width)).toEqual([960, 1100])
    expect(result.variants.every((item) => item.mime === 'image/webp')).toBe(
      true
    )
  })
  it('never converts a GIF, even a single-frame GIF', async () => {
    const source = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#abcdef' }
    })
      .gif()
      .toBuffer()
    const mock = transport()
    const result = await processMedia(
      source,
      'image/gif',
      new MediaStorage(config, mock.api)
    )
    expect(result.variants).toEqual([])
    expect(result.blurDataURL).toMatch(/^data:image\/webp;base64,/)
    expect(Buffer.from(mock.objects.get(result.original.key)!)).toEqual(source)
  })
  it('keeps direct video bytes unchanged', async () => {
    const source = Buffer.from('fixture video bytes')
    const mock = transport()
    const result = await processMedia(
      source,
      'video/mp4',
      new MediaStorage(config, mock.api)
    )
    expect(result.variants).toEqual([])
    expect(result.blurDataURL).toBeUndefined()
    expect(Buffer.from(mock.objects.get(result.original.key)!)).toEqual(source)
  })
  it('invalidates reuse for source changes, pipeline changes, and force', () => {
    const source: MediaSource = {
      key: 'block',
      kind: 'file',
      edited: '2026-01-01'
    }
    const previous = {
      source,
      pipelineVersion: MEDIA_PIPELINE_VERSION
    } as Media
    expect(canReuseMedia(previous, { ...source }, false)).toBe(true)
    expect(canReuseMedia(previous, { ...source, url: undefined }, false)).toBe(
      true
    )
    expect(
      canReuseMedia(previous, { ...source, edited: '2026-01-02' }, false)
    ).toBe(false)
    expect(
      canReuseMedia({ ...previous, pipelineVersion: 0 }, source, false)
    ).toBe(false)
    expect(canReuseMedia(previous, source, true)).toBe(false)
  })
})
