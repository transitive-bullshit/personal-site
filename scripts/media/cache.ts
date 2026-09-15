import { readFile, mkdir, writeFile, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import { mediaSchema, type Media } from '../../lib/content/schema'
import { canonicalJson } from '../io'

// Only completed immutable uploads are cached. The published snapshot stays authoritative.
export class MediaCache {
  private pending = Promise.resolve()
  private constructor(
    readonly path: string,
    readonly entries: Record<string, Media>
  ) {}

  static async open(path = 'work/media-cache.json') {
    try {
      const entries = z
        .record(z.string(), mediaSchema)
        .parse(JSON.parse(await readFile(path, 'utf8')))
      return new MediaCache(path, entries)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      return new MediaCache(path, {})
    }
  }

  async save(media: Media) {
    this.entries[media.source.key] = media
    this.pending = this.pending.then(async () => {
      await mkdir(dirname(this.path), { recursive: true })
      const temp = this.path + '.tmp'
      await writeFile(temp, canonicalJson(this.entries))
      await rename(temp, this.path)
    })
    await this.pending
  }
}
