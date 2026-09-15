import {
  readFile,
  rename,
  writeFile,
  mkdir,
  open,
  unlink
} from 'node:fs/promises'
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

export function canonicalJson(value: unknown): string {
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
  return JSON.stringify(sort(value), null, 2) + '\n'
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
  const body = canonicalJson(parsed)
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

export async function lockSync() {
  await mkdir('work', { recursive: true })
  const path = 'work/content-sync.lock'
  const file = await open(path, 'wx').catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'EEXIST')
      throw new Error(
        'A sync lock already exists at work/content-sync.lock. Check the recorded process before removing a stale lock.'
      )
    throw err
  })
  await writeFile(file, String(process.pid))
  return async () => {
    await file.close()
    await unlink(path)
  }
}
