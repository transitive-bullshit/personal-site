import { beforeEach, expect, it, vi } from 'vitest'
import { fetchTweet } from 'react-tweet/api'
import { syncTweets } from '../scripts/tweets'
import type { TweetSnapshot } from '../lib/content/schema'

vi.mock('react-tweet/api', () => ({ fetchTweet: vi.fn<typeof fetchTweet>() }))
const fetchMock = vi.mocked(fetchTweet)
const saved: TweetSnapshot = {
  status: 'available',
  data: {
    __typename: 'Tweet',
    id_str: '123',
    text: 'Saved tweet',
    lang: 'en',
    created_at: '2024-01-01T00:00:00.000Z',
    display_text_range: [0, 11],
    user: {
      name: 'Author',
      screen_name: 'author',
      profile_image_url_https: 'https://example.com/avatar.jpg'
    },
    favorite_count: 0,
    conversation_count: 0,
    edit_control: {},
    isEdited: false,
    isStaleEdit: false
  }
}
beforeEach(() => {
  vi.clearAllMocks()
})

it('reuses saved tweets without network calls in a normal sync', async () => {
  expect(
    await syncTweets(
      ['123'],
      { '123': saved },
      { force: false, dryRun: false },
      () => {}
    )
  ).toEqual({ '123': saved })
  expect(fetchMock).not.toHaveBeenCalled()
})
it('replaces confirmed missing or private tweets with a fallback during refresh', async () => {
  fetchMock.mockResolvedValue({ tombstone: true })
  expect(
    await syncTweets(
      ['123'],
      { '123': saved },
      { force: true, dryRun: false },
      () => {}
    )
  ).toEqual({ '123': { status: 'unavailable' } })
})
it('retains saved tweet data when a refresh fails transiently', async () => {
  fetchMock.mockRejectedValue(new Error('Timed out'))
  expect(
    await syncTweets(
      ['123'],
      { '123': saved },
      { force: true, dryRun: false },
      () => {}
    )
  ).toEqual({ '123': saved })
})
it('does not fetch tweets during dry runs and records useful missing-data state', async () => {
  expect(
    await syncTweets(['123'], {}, { force: true, dryRun: true }, () => {})
  ).toEqual({ '123': { status: 'unavailable' } })
  expect(fetchMock).not.toHaveBeenCalled()
})
