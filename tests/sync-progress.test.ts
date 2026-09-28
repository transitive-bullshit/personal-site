import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  createSyncProgress,
  isInteractiveTerminal
} from '../scripts/sync-progress'
import { taskBatch, type TaskProgress } from '../scripts/task-progress'

describe('sync progress', () => {
  it('animates only ordinary interactive terminals', () => {
    const tty = { isTTY: true }
    expect(isInteractiveTerminal(tty, tty, { TERM: 'xterm-256color' })).toBe(
      true
    )
    for (const env of [{ CI: '1' }, { TERM: 'dumb' }, { BUILD_NUMBER: '2' }])
      expect(isInteractiveTerminal(tty, tty, env)).toBe(false)
    expect(isInteractiveTerminal({}, tty, {})).toBe(false)
    expect(isInteractiveTerminal(tty, {}, {})).toBe(false)
  })

  it('keeps concurrent warnings on the correct task and its parent in plain logs', async () => {
    const lines: string[] = []
    const progress = await createSyncProgress({
      interactive: false,
      log: (line) => lines.push(line),
      warn: (line) => lines.push(line)
    })
    await progress.run('Import', async (parent) => {
      await Promise.all([
        parent.run('broken', async () => {
          await Promise.resolve()
          progress.warn('saved version retained')
        }),
        parent.run('healthy', async () => {
          await Promise.resolve()
          await Promise.resolve()
        })
      ])
    })
    progress.finish()
    expect(lines).toContain('[warn] broken')
    expect(lines).toContain('[done] healthy')
    expect(lines).toContain('[warn] Import')
    expect(lines).toContain('saved version retained')
    expect(lines.join('\n')).not.toContain('\u001b')
  })

  it('preserves fatal failures in plain logs', async () => {
    const lines: string[] = []
    const progress = await createSyncProgress({
      interactive: false,
      log: (line) => lines.push(line)
    })
    const error = new Error('Publication failed')
    await expect(
      progress.run('Publish', async () => {
        throw error
      })
    ).rejects.toBe(error)
    progress.finish()
    expect(lines).toContain('[failed] Publish')
  })

  it('preserves fatal failures and cleans up the real interactive renderer', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict'
      import { createSyncProgress } from './scripts/sync-progress.ts'
      const progress = await createSyncProgress({ interactive: true })
      const error = new Error('Publication failed')
      try {
        await assert.rejects(progress.run('Publish', async () => { throw error }), (caught) => caught === error)
      } finally { progress.finish() }
      console.log('renderer finished')
    `
      ],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 }
    )
    expect(output).toContain('[failed] Publish')
    expect(output).toContain('renderer finished')
  })

  it('counts actual completion when concurrent tasks finish out of order', async () => {
    const statuses: string[] = []
    const progress: TaskProgress = {
      status: (status) => statuses.push(status),
      run: (_, work) => work(progress)
    }
    const run = taskBatch(progress, 2)
    let release!: () => void
    const first = run(
      'first',
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    await run('second', async () => {})
    expect(statuses.at(-1)).toBe('1/2 complete · 1 active')
    release()
    await first
    expect(statuses.at(-1)).toBe('2/2 complete · 0 active')
    expect(statuses).toContain('0/2 complete · 2 active')
  })
})
