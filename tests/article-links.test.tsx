import { load } from 'cheerio'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { Bookmark } from '../components/article/bookmark'
import { RichText } from '../components/article/rich-text'
import type { Snapshot } from '../lib/content/schema'

vi.mock('../components/article/media', () => ({ MediaImage: () => null }))

it.each([
  ['https://example.com/article', true],
  ['https://transitivebullsh.it.example.com/article', true],
  ['https://www.transitivebullsh.it/learn-in-public', false],
  ['http://transitivebullsh.it/learn-in-public', false],
  ['/learn-in-public', false],
  ['#sources', false],
  ['mailto:hello@example.com', false]
])('sets the inline link target for %s', (href, external) => {
  const $ = load(
    renderToStaticMarkup(
      <RichText
        spans={[
          {
            text: 'Read more',
            href,
            bold: false,
            italic: false,
            underline: false,
            strike: false,
            code: false,
            color: 'default'
          }
        ]}
      />
    )
  )
  expect($('a').attr('href')).toBe(href)
  expect($('a').attr('target')).toBe(external ? '_blank' : undefined)
  expect($('a').attr('rel')).toBe(external ? 'noopener noreferrer' : undefined)
})

it('renders the locally saved screenshot as the bookmark image', () => {
  const url = 'https://example.com/article'
  const screenshot = {
    url: '/bookmarks/' + 'a'.repeat(64) + '.webp',
    width: 640,
    height: 480
  }
  const $ = load(
    renderToStaticMarkup(
      <Bookmark
        block={{
          id: 'a'.repeat(32),
          type: 'bookmark',
          url,
          caption: [],
          children: []
        }}
        snapshot={
          {
            bookmarks: { [url]: { title: 'Page', description: '', screenshot } }
          } as unknown as Snapshot
        }
      />
    )
  )
  expect($('.bookmark-image').attr('src')).toContain(
    encodeURIComponent(screenshot.url)
  )
  expect($('.bookmark-image').attr('width')).toBe('640')
  expect($('.bookmark-image').attr('height')).toBe('480')
})

it.each([
  ['https://example.com/article', true],
  ['https://www.transitivebullsh.it/learn-in-public', false],
  ['https://transitivebullsh.it/learn-in-public', false]
])('sets the bookmark target for %s', (url, external) => {
  const $ = load(
    renderToStaticMarkup(
      <Bookmark
        block={{
          id: 'a'.repeat(32),
          type: 'bookmark',
          url,
          caption: [],
          children: []
        }}
        snapshot={{ bookmarks: {} } as Snapshot}
      />
    )
  )
  expect($('.bookmark-card').attr('href')).toBe(url)
  expect($('.bookmark-card').attr('target')).toBe(
    external ? '_blank' : undefined
  )
  expect($('.bookmark-card').attr('rel')).toBe(
    external ? 'noopener noreferrer' : undefined
  )
})
