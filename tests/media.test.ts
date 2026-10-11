import { describe, expect, it } from 'vitest'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
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
      if (!(command instanceof PutObjectCommand))
        throw new Error('Unexpected command')
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
    const bytes = Buffer.from('abc')
    // Published SHA-256 test vector, independent of the storage implementation.
    const digest =
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    expect(hashBytes(bytes)).toBe(digest)
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
    expect(first.key).toBe('personal-site/media/' + digest + '.bin')
    expect(storage.stats.uploaded).toBe(1)
    const different = await storage.publish(
      Buffer.from('different'),
      'application/octet-stream',
      'bin'
    )
    expect(different.key).not.toBe(first.key)
    expect(mock.objects.size).toBe(2)
    expect(Buffer.from(mock.objects.get(first.key)!)).toEqual(bytes)
    expect(Buffer.from(mock.objects.get(different.key)!)).toEqual(
      Buffer.from('different')
    )
    expect(mock.calls).toEqual(['HEAD', 'PUT', 'HEAD', 'PUT'])
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
        if (!(command instanceof PutObjectCommand))
          throw new Error('Unexpected command')
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
    const source = await readFile(
      new URL('./fixtures/video.mp4', import.meta.url)
    )
    const mock = transport()
    const result = await processMedia(
      source,
      'video/mp4',
      new MediaStorage(config, mock.api)
    )
    expect(result.variants).toEqual([])
    expect(result.original).toMatchObject({
      width: 160,
      height: 90,
      mime: 'video/mp4'
    })
    expect(result.poster).toMatchObject({
      width: 160,
      height: 90,
      mime: 'image/webp'
    })
    const poster = await sharp(mock.objects.get(result.poster!.key)!).metadata()
    expect(poster).toMatchObject({ width: 160, height: 90, format: 'webp' })
    expect(result.blurDataURL).toBeUndefined()
    expect(Buffer.from(mock.objects.get(result.original.key)!)).toEqual(source)
  })
  it.each([
    ['video-rotated.mp4', 90, 160],
    ['video-anamorphic.mp4', 320, 90]
  ])('uses display dimensions for %s', async (file, width, height) => {
    const bytes = await readFile(new URL('./fixtures/' + file, import.meta.url))
    const result = await processMedia(
      bytes,
      'video/mp4',
      new MediaStorage(config, transport().api)
    )
    expect(result.original).toMatchObject({ width, height })
    expect(result.poster).toMatchObject({ width, height })
  })
  it('rejects invalid video without publishing incomplete assets', async () => {
    const mock = transport()
    await expect(
      processMedia(
        Buffer.from('invalid'),
        'video/mp4',
        new MediaStorage(config, mock.api)
      )
    ).rejects.toThrow('Unable to inspect video')
    expect(mock.objects.size).toBe(0)
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
    expect(canReuseMedia(previous, { ...source, key: 'other' }, false)).toBe(
      false
    )
    expect(
      canReuseMedia(previous, { ...source, kind: 'external' }, false)
    ).toBe(false)
    const external = {
      ...source,
      kind: 'external' as const,
      url: 'https://example.com/one'
    }
    const savedExternal = { ...previous, source: external }
    expect(canReuseMedia(savedExternal, { ...external }, false)).toBe(true)
    expect(
      canReuseMedia(
        savedExternal,
        { ...external, url: 'https://example.com/two' },
        false
      )
    ).toBe(false)
    expect(
      canReuseMedia(previous, { ...source, edited: '2026-01-02' }, false)
    ).toBe(false)
    expect(
      canReuseMedia({ ...previous, pipelineVersion: 0 }, source, false)
    ).toBe(false)
    expect(canReuseMedia(previous, source, true)).toBe(false)
  })
})
