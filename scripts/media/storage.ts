import { createHash } from 'node:crypto'
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import type { Asset } from '../../lib/content/schema'

export const hashBytes = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex')
export type StorageTransport = {
  send(command: HeadObjectCommand | PutObjectCommand): Promise<unknown>
}

export function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('$metadata' in error))
    return undefined
  const metadata = error.$metadata
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('httpStatusCode' in metadata)
  )
    return undefined
  return typeof metadata.httpStatusCode === 'number'
    ? metadata.httpStatusCode
    : undefined
}

export function storageConfig(env = process.env) {
  const required = (name: string) => {
    const value = env[name]?.trim()
    if (!value) throw new Error(name + ' is required for content sync')
    return value
  }
  const endpoint = new URL(required('S3_API_ENDPOINT'))
  const publicOrigin = new URL(required('S3_PUBLIC_URL'))
  for (const url of [endpoint, publicOrigin]) {
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        'Storage URLs must use HTTPS without credentials, query strings, or fragments'
      )
  }
  if (publicOrigin.hostname.endsWith('.r2.cloudflarestorage.com'))
    throw new Error('S3_PUBLIC_URL must be the public media origin')
  return {
    bucket: required('S3_BUCKET_NAME'),
    publicOrigin: publicOrigin.href.replace(/\/+$/, ''),
    client: {
      endpoint: endpoint.href,
      region: env.S3_REGION || 'auto',
      credentials: {
        accessKeyId: required('S3_ACCESS_KEY_ID'),
        secretAccessKey: required('S3_SECRET_ACCESS_KEY')
      },
      maxAttempts: 3
    }
  }
}

export class MediaStorage {
  readonly stats = { reused: 0, uploaded: 0, uploadedBytes: 0 }
  private known = new Set<string>()
  private transport: StorageTransport
  private bucket: string
  private publicOrigin: string

  constructor(
    config: ReturnType<typeof storageConfig>,
    transport?: StorageTransport
  ) {
    this.transport =
      transport ??
      new S3Client({
        ...config.client,
        requestHandler: {
          connectionTimeout: 10000,
          requestTimeout: 120000,
          throwOnRequestTimeout: true
        }
      })
    this.bucket = config.bucket
    this.publicOrigin = config.publicOrigin
  }

  async exists(key: string) {
    try {
      await this.transport.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      )
      return true
    } catch (err) {
      if (errorStatus(err) === 404) return false
      throw err
    }
  }

  async publish(
    bytes: Uint8Array,
    mime: string,
    extension: string,
    dimensions: { width?: number; height?: number } = {}
  ): Promise<Asset> {
    const hash = hashBytes(bytes)
    const key = 'personal-site/media/' + hash + '.' + extension
    const asset = {
      hash,
      key,
      url: this.publicOrigin + '/' + key,
      mime,
      bytes: bytes.byteLength,
      ...dimensions
    }
    if (this.known.has(key) || (await this.exists(key))) {
      this.stats.reused++
      this.known.add(key)
      return asset
    }
    try {
      await this.transport.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: bytes,
          ContentType: mime,
          CacheControl: 'public,max-age=31536000,immutable',
          IfNoneMatch: '*'
        })
      )
      this.stats.uploaded++
      this.stats.uploadedBytes += bytes.byteLength
    } catch (err) {
      if (errorStatus(err) !== 412) throw err
      this.stats.reused++
    }
    this.known.add(key)
    return asset
  }
}
