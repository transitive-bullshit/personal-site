import { EmbeddedTweet } from 'react-tweet'
import type { Tweet } from 'react-tweet/api'
import type { TweetSnapshot } from '@/lib/content/schema'

export function ArticleTweet({
  id,
  tweet
}: {
  id: string
  tweet: TweetSnapshot | undefined
}) {
  if (tweet?.status === 'available') {
    return (
      <div data-theme='light'>
        <EmbeddedTweet tweet={tweet.data as unknown as Tweet} />
      </div>
    )
  }
  return (
    <a className='bookmark-link' href={'https://twitter.com/i/status/' + id}>
      View the original post on X{' '}
      <small>This post could not be included in the saved article.</small>
    </a>
  )
}
