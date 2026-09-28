import { AsyncLocalStorage } from 'node:async_hooks'
import type { Task, TaskInnerAPI } from 'tasuku'
import type { TaskProgress } from './task-progress'

export function isInteractiveTerminal(
  stdout: Partial<Pick<NodeJS.WriteStream, 'isTTY'>> = process.stdout,
  stderr: Partial<Pick<NodeJS.WriteStream, 'isTTY'>> = process.stderr,
  env: Partial<NodeJS.ProcessEnv> = process.env
) {
  return Boolean(
    stdout.isTTY &&
    stderr.isTTY &&
    env.TERM !== 'dumb' &&
    !env.CI &&
    !env.CONTINUOUS_INTEGRATION &&
    !env.BUILD_NUMBER
  )
}

export async function createSyncProgress(
  options: {
    interactive?: boolean
    log?: (message: string) => void
    warn?: (message: string) => void
  } = {}
) {
  const interactive = options.interactive ?? isInteractiveTerminal()
  const log = options.log ?? console.log
  const warn = options.warn ?? console.warn
  const renderer = interactive ? (await import('tasuku')).default : undefined
  const context = new AsyncLocalStorage<{ warning: () => void }>()
  const warnings: string[] = []
  const completed: { clear: () => void; summary: string }[] = []

  function scope(
    render?: Task,
    inner?: TaskInnerAPI,
    parentWarning?: () => void
  ): TaskProgress {
    return {
      status: (message) => inner?.setStatus(message),
      async run(title, work) {
        let status = ''
        let warning = false
        const markWarning = () => {
          warning = true
          parentWarning?.()
        }
        const summary = (state: string) =>
          `[${state}] ${title}${status ? ' — ' + status : ''}`
        if (!render) {
          log('[start] ' + title)
          try {
            const result = await context.run({ warning: markWarning }, () =>
              work({
                ...scope(undefined, undefined, markWarning),
                status: (message) => {
                  status = message
                }
              })
            )
            log(summary(warning ? 'warn' : 'done'))
            return result
          } catch (err) {
            log(summary('failed'))
            throw err
          }
        }
        // Return failures as data so we can clean up the renderer before rethrowing.
        const task = await render(
          title,
          async (api) =>
            context.run({ warning: markWarning }, async () => {
              try {
                const value = await work({
                  ...scope(api.task, api, markWarning),
                  status(message) {
                    status = message
                    api.setStatus(message)
                  }
                })
                if (warning) api.setWarning('Completed with warnings')
                return { ok: true as const, value }
              } catch (err) {
                api.setError(err instanceof Error ? err : String(err))
                return { ok: false as const, error: err }
              }
            }),
          { showTime: true }
        )
        // Keep phase summaries; retire finished children so active work stays visible.
        if (inner) task.clear()
        else
          completed.push({
            clear: task.clear,
            summary: summary(
              task.result.ok ? (warning ? 'warn' : 'done') : 'failed'
            )
          })
        if (!task.result.ok) throw task.result.error
        return task.result.value
      }
    }
  }

  return {
    ...scope(renderer),
    warn(message: string) {
      context.getStore()?.warning()
      if (interactive) warnings.push(message)
      else warn(message)
    },
    finish() {
      const phases = completed.splice(0)
      for (const phase of phases) phase.clear()
      for (const phase of phases) log(phase.summary)
      for (const message of warnings.splice(0)) warn(message)
    }
  }
}
