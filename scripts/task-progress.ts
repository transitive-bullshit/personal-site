// Keep presentation optional so importers also work in tests and runtime routes.
export interface TaskProgress {
  run<T>(title: string, work: (task: TaskProgress) => Promise<T>): Promise<T>
  status(message: string): void
}

export const silentProgress: TaskProgress = {
  run: (_title, work) => work(silentProgress),
  status: () => {}
}

export function taskBatch(progress: TaskProgress, total: number) {
  let completed = 0
  let active = 0
  const update = () =>
    progress.status(`${completed}/${total} complete · ${active} active`)
  update()
  return async <T>(title: string, work: (task: TaskProgress) => Promise<T>) => {
    active++
    update()
    try {
      return await progress.run(title, work)
    } finally {
      active--
      completed++
      update()
    }
  }
}
