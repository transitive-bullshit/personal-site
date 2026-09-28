import { createHash } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  type CreateMultipartUploadCommandOutput,
  type UploadPartCommandOutput
} from '@aws-sdk/client-s3'
import { z } from 'zod'
import { publishJson } from '../io'
import type { StorageTransport } from './storage'

export const MULTIPART_THRESHOLD = 16 * 1024 * 1024
export const MULTIPART_PART_SIZE = 8 * 1024 * 1024
export type MultipartCommand =
  | CreateMultipartUploadCommand
  | UploadPartCommand
  | CompleteMultipartUploadCommand

const checkpointSchema = z.object({
  uploadId: z.string().min(1),
  parts: z.array(
    z.object({
      PartNumber: z.number().int().positive(),
      ETag: z.string().min(1)
    })
  )
})

export class MultipartUploader {
  constructor(
    private transport: StorageTransport,
    private endpoint: string,
    private bucket: string,
    private directory: string
  ) {}

  private path(key: string) {
    // Scope checkpoints to the destination and chunk layout, without credentials.
    const id = createHash('sha256')
      .update(
        JSON.stringify([this.endpoint, this.bucket, key, MULTIPART_PART_SIZE])
      )
      .digest('hex')
    return join(this.directory, id + '.json')
  }

  async forget(key: string) {
    await rm(this.path(key), { force: true })
  }

  async upload(key: string, bytes: Uint8Array, mime: string): Promise<void> {
    const path = this.path(key)
    let checkpoint: z.infer<typeof checkpointSchema> | undefined
    try {
      checkpoint = checkpointSchema.parse(
        JSON.parse(await readFile(path, 'utf8'))
      )
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }

    // A saved upload may have expired under the bucket's lifecycle policy.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!checkpoint) {
        const result = (await this.transport.send(
          new CreateMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: mime,
            CacheControl: 'public,max-age=31536000,immutable'
          })
        )) as CreateMultipartUploadCommandOutput
        if (!result.UploadId)
          throw new Error('Multipart upload returned no upload ID')
        checkpoint = { uploadId: result.UploadId, parts: [] }
        await publishJson(checkpoint, path)
      }
      const input = {
        Bucket: this.bucket,
        Key: key,
        UploadId: checkpoint.uploadId
      }
      try {
        const parts = []
        for (
          let offset = 0, number = 1;
          offset < bytes.byteLength;
          offset += MULTIPART_PART_SIZE, number++
        ) {
          let part = checkpoint.parts.find((part) => part.PartNumber === number)
          if (!part) {
            // The SDK retries each part independently. A lost response only
            // requires re-sending this part, using the same upload ID/number.
            const result = (await this.transport.send(
              new UploadPartCommand({
                ...input,
                PartNumber: number,
                Body: bytes.subarray(offset, offset + MULTIPART_PART_SIZE)
              })
            )) as UploadPartCommandOutput
            if (!result.ETag) throw new Error('Multipart part returned no ETag')
            part = { PartNumber: number, ETag: result.ETag }
            checkpoint.parts.push(part)
            await publishJson(checkpoint, path)
          }
          parts.push(part)
        }
        // R2 does not document conditional completion. Content-addressed keys
        // ensure competing uploads to this key contain identical bytes.
        await this.transport.send(
          new CompleteMultipartUploadCommand({
            ...input,
            MultipartUpload: { Parts: parts }
          })
        )
        await this.forget(key)
        return
      } catch (err) {
        if (
          !(err instanceof Error) ||
          err.name !== 'NoSuchUpload' ||
          attempt > 0
        )
          throw err
        await this.forget(key)
        checkpoint = undefined
      }
    }
  }
}
