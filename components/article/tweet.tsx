import { EmbeddedTweet } from 'react-tweet'
import { TweetAvatar } from './tweet-avatar'
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
      <div className='article-tweet' data-link-preview='false'>
        <EmbeddedTweet
          tweet={tweet.data as unknown as Tweet}
          components={{ AvatarImg: TweetAvatar }}
        />
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
