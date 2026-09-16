import { readFile, rename, mkdir, open, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { validateSnapshot } from '../lib/content/references'
import { parseEnv } from 'node:util'
import { snapshotSchema, type Snapshot } from '../lib/content/schema'

export async function loadEnv() {
  for (const path of ['.env.local', '.env']) {
    try {
      const values = parseEnv(await readFile(path, 'utf8'))
      for (const [key, value] of Object.entries(values))
        process.env[key] ??= value
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }
}

export function canonicalJson(value: unknown, space = 2): string {
  function sort(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(sort)
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b, 'en'))
          .map(([key, item]) => [key, sort(item)])
      )
    }
    return input
  }
  return JSON.stringify(sort(value), null, space) + '\n'
}

export async function readSnapshot(
  path = 'content/snapshot.json'
): Promise<Snapshot | undefined> {
  try {
    return snapshotSchema.parse(JSON.parse(await readFile(path, 'utf8')))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw err
  }
}

export async function publishSnapshot(
  snapshot: Snapshot,
  path = 'content/snapshot.json'
) {
  const parsed = snapshotSchema.parse(snapshot)
  validateSnapshot(parsed)
  return publishJson(parsed, path)
}

export async function publishJson(value: unknown, path: string, space = 2) {
  const body = canonicalJson(value, space)
  try {
    if ((await readFile(path, 'utf8')) === body) return false
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  await mkdir(dirname(path), { recursive: true })
  const temp = path + '.' + process.pid + '.tmp'
  try {
    const file = await open(temp, 'wx')
    try {
      await file.writeFile(body)
      await file.sync()
    } finally {
      await file.close()
    }
    await rename(temp, path)
  } finally {
    await unlink(temp).catch(() => {})
  }
  return true
}
