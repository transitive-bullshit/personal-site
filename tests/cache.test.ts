import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MediaCache } from '../scripts/media/cache'
import { MediaImporter } from '../scripts/media/process'
import { MediaStorage, type StorageTransport } from '../scripts/media/storage'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

afterEach(() => vi.unstubAllGlobals())

it('resumes completed uploads after an unpublished run and keeps dry runs read-only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'personal-site-cache-'))
  const path = join(dir, 'cache.json')
  const objects = new Map<string, Uint8Array>()
  const send = vi.fn<StorageTransport['send']>(async (command) => {
    if (command instanceof HeadObjectCommand) {
      if (!objects.has(command.input.Key!))
        throw Object.assign(new Error('Missing'), {
          $metadata: { httpStatusCode: 404 }
        })
      return {}
    }
    if (!(command instanceof PutObjectCommand))
      throw new Error('Unexpected command')
    objects.set(command.input.Key!, command.input.Body as Uint8Array)
    return {}
  })
  const storage = new MediaStorage(
    {
      bucket: 'fixture',
      publicOrigin: 'https://assets.example.com',
      client: {
        endpoint: 'https://storage.example.com',
        region: 'auto',
        credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
        maxAttempts: 1
      }
    },
    { send }
  )
  const source = { key: 'file', kind: 'file' as const, edited: '2026-09-15' }
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response('cached attachment', {
      headers: { 'content-type': 'text/plain' }
    })
  )
  vi.stubGlobal('fetch', fetchMock)
  try {
    const first = new MediaImporter(
      storage,
      {},
      { force: false, dryRun: false },
      await MediaCache.open(path)
    )
    await first.import(source, 'https://example.com/original')
    expect(storage.stats.uploaded).toBe(1)
    expect(objects.size).toBe(1)
    expect(Buffer.from([...objects.values()][0]!)).toEqual(
      Buffer.from('cached attachment')
    )
    const before = await readFile(path, 'utf8')
    expect(before).not.toContain('https://example.com/original')
    fetchMock.mockClear()
    send.mockClear()
    const retry = new MediaImporter(
      storage,
      {},
      { force: false, dryRun: false },
      await MediaCache.open(path)
    )
    await retry.import(source, 'https://example.com/refreshed')
    expect(retry.media).toEqual(first.media)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    const dry = new MediaImporter(
      storage,
      {},
      { force: true, dryRun: true },
      await MediaCache.open(path)
    )
    await dry.import(
      { ...source, edited: 'changed' },
      'https://example.com/changed'
    )
    expect(await readFile(path, 'utf8')).toBe(before)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
