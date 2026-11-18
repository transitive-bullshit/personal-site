import { expect, it } from 'vitest'
import { showsCoverAboveBody } from '../lib/content/cover'
import { article } from './fixtures/content'

it('shows covers above the body except for entries that place them in the body', () => {
  expect(showsCoverAboveBody({ ...article, cover: 'cover' })).toBe(true)
  expect(showsCoverAboveBody({ ...article, cover: undefined })).toBe(false)
  expect(
    showsCoverAboveBody({
      ...article,
      id: '3f7edb27f12481bcb191fcff5dcafd41',
      cover: 'cover'
    })
  ).toBe(false)
})
