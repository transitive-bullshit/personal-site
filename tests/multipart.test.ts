import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { MediaStorage, type StorageTransport } from '../scripts/media/storage'
import { MULTIPART_PART_SIZE } from '../scripts/media/multipart'

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
const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})
async function directory() {
  const path = await mkdtemp(join(tmpdir(), 'media-uploads-'))
  directories.push(path)
  return path
}
function remote() {
  const parts = new Map<number, Uint8Array>()
  const uploaded: number[] = []
  let creates = 0
  let object: Buffer | undefined
  let failPart = 2
  let expired = false
  let failComplete = false
  const api: StorageTransport = {
    async send(command) {
      if (command instanceof HeadObjectCommand) {
        if (!object)
          throw Object.assign(new Error('Missing'), {
            $metadata: { httpStatusCode: 404 }
          })
        return {}
      }
      if (command instanceof CreateMultipartUploadCommand) {
        expect(command.input).toMatchObject({
          ContentType: 'video/mp4',
          CacheControl: 'public,max-age=31536000,immutable'
        })
        creates++
        parts.clear()
        expired = false
        return { UploadId: String(creates) }
      }
      if (expired)
        throw Object.assign(new Error('Expired'), { name: 'NoSuchUpload' })
      if (command instanceof UploadPartCommand) {
        const number = command.input.PartNumber!
        if (number === failPart) throw new Error('Connection lost')
        const body = command.input.Body as Uint8Array
        expect(body.byteLength).toBeLessThanOrEqual(MULTIPART_PART_SIZE)
        parts.set(number, body)
        uploaded.push(number)
        return { ETag: 'etag-' + number }
      }
      if (command instanceof CompleteMultipartUploadCommand) {
        expect(command.input.MultipartUpload?.Parts).toEqual(
          [1, 2, 3].map((PartNumber) => ({
            PartNumber,
            ETag: 'etag-' + PartNumber
          }))
        )
        object = Buffer.concat([...parts.values()])
        if (failComplete) throw new Error('Completion response lost')
        return {}
      }
      throw new Error('Unexpected single upload')
    }
  }
  return {
    api,
    uploaded,
    get creates() {
      return creates
    },
    get object() {
      return object
    },
    recover() {
      failPart = 0
    },
    expire() {
      expired = true
    },
    loseCompletion() {
      failComplete = true
    }
  }
}
const bytes = Buffer.alloc(2 * MULTIPART_PART_SIZE + 123, 42)

it('resumes completed parts across storage instances and only counts completed objects', async () => {
  const path = await directory()
  const mock = remote()
  const first = new MediaStorage(config, mock.api, path)
  await expect(first.publish(bytes, 'video/mp4', 'mp4')).rejects.toThrow(
    'Connection lost'
  )
  expect(first.stats.uploaded).toBe(0)
  expect(mock.uploaded).toEqual([1])
  mock.recover()
  const next = new MediaStorage(config, mock.api, path)
  await next.publish(bytes, 'video/mp4', 'mp4')
  expect(mock.creates).toBe(1)
  expect(mock.uploaded).toEqual([1, 2, 3])
  expect(mock.object?.equals(bytes)).toBe(true)
  expect(next.stats).toMatchObject({ uploaded: 1, uploadedBytes: bytes.length })
  expect(await readdir(path)).toEqual([])
})

it('restarts an expired upload without reusing its old parts', async () => {
  const path = await directory()
  const mock = remote()
  await expect(
    new MediaStorage(config, mock.api, path).publish(bytes, 'video/mp4', 'mp4')
  ).rejects.toThrow()
  mock.recover()
  mock.expire()
  await new MediaStorage(config, mock.api, path).publish(
    bytes,
    'video/mp4',
    'mp4'
  )
  expect(mock.creates).toBe(2)
  expect(mock.uploaded).toEqual([1, 1, 2, 3])
  expect(mock.object?.equals(bytes)).toBe(true)
})

it('uses HEAD to recover a successful completion whose response was lost', async () => {
  const path = await directory()
  const mock = remote()
  mock.recover()
  mock.loseCompletion()
  await expect(
    new MediaStorage(config, mock.api, path).publish(bytes, 'video/mp4', 'mp4')
  ).rejects.toThrow('Completion response lost')
  const next = new MediaStorage(config, mock.api, path)
  await next.publish(bytes, 'video/mp4', 'mp4')
  expect(next.stats).toMatchObject({ reused: 1, uploaded: 0 })
  expect(mock.creates).toBe(1)
  expect(await readdir(path)).toEqual([])
})
