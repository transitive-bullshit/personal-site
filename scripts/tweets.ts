import { taskBatch, silentProgress, type TaskProgress } from './task-progress'
import { fetchTweet } from 'react-tweet/api'
import { tweetDataSchema, type TweetSnapshot } from '../lib/content/schema'

export async function syncTweets(
  ids: Iterable<string>,
  previous: Record<string, TweetSnapshot>,
  options: { force: boolean; dryRun: boolean; progress?: TaskProgress },
  warn: (message: string) => void
) {
  const tweets: Record<string, TweetSnapshot> = {}
  const sorted = [...ids].sort()
  const run = taskBatch(options.progress ?? silentProgress, sorted.length)
  for (const id of sorted) {
    await run('Tweet ' + id, async (task) => {
      if (!options.force && previous[id]?.status === 'available') {
        tweets[id] = previous[id]
        task.status('cached')
        return
      }
      if (options.dryRun) {
        tweets[id] = previous[id] ?? { status: 'unavailable' }
        task.status('dry run')
        return
      }
      try {
        const result = await fetchTweet(id, {
          signal: AbortSignal.timeout(20_000)
        })
        if (result.tombstone || result.notFound) {
          tweets[id] = { status: 'unavailable' }
          warn('Tweet ' + id + ' unavailable; showing original-post link')
        } else if (result.data) {
          tweets[id] = {
            status: 'available',
            data: tweetDataSchema.parse(result.data)
          }
        } else throw new Error('Empty tweet response')
      } catch {
        tweets[id] = previous[id] ?? { status: 'unavailable' }
        warn(
          'Tweet ' +
            id +
            ' could not be refreshed; using saved data or original-post link'
        )
      }
    })
  }
  return tweets
}
