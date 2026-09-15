import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { canonicalJson, publishSnapshot } from '../scripts/io'
import { sourceContract } from '../lib/site'
import type { Snapshot } from '../lib/content/schema'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})
const snapshot: Snapshot = {
  schemaVersion: 1,
  importerVersion: 1,
  source: { ...sourceContract, apiVersion: '2026-03-11', propertyIds: {} },
  articles: {},
  routes: {},
  media: {},
  tweets: {}
}

describe('snapshot publication', () => {
  it('produces stable bytes regardless of object insertion order while preserving arrays', () => {
    expect(canonicalJson({ b: 1, a: [3, 1] })).toBe(
      canonicalJson({ a: [3, 1], b: 1 })
    )
    expect(canonicalJson({ a: [3, 1] })).not.toBe(canonicalJson({ a: [1, 3] }))
  })
  it('leaves the previous snapshot intact on validation failure and no-op sync', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'personal-site-test-'))
    directories.push(directory)
    const path = join(directory, 'snapshot.json')
    expect(await publishSnapshot(snapshot, path)).toBe(true)
    const before = await readFile(path, 'utf8')
    expect(await publishSnapshot(snapshot, path)).toBe(false)
    await expect(
      publishSnapshot(
        { ...snapshot, schemaVersion: 99 } as unknown as Snapshot,
        path
      )
    ).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe(before)
  })
})
