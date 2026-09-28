import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Blocks } from '../components/article/blocks'
import { mediaSchema, type Snapshot } from '../lib/content/schema'

vi.mock('../components/article/code-block', () => ({ CodeBlock: () => null }))
vi.mock('../components/article/tweet', () => ({ ArticleTweet: () => null }))
vi.mock('../components/article/bookmark', () => ({ Bookmark: () => null }))
vi.mock('../components/article/media', () => ({
  ZoomableImage: () => null,
  NotionIcon: () => null
}))

const hash = 'a'.repeat(64)
const original = {
  hash,
  key: `personal-site/media/${hash}.mp4`,
  url: `https://assets.example.com/personal-site/media/${hash}.mp4`,
  bytes: 100,
  mime: 'video/mp4',
  width: 900,
  height: 1600
}
const poster = {
  ...original,
  key: `personal-site/media/${hash}.webp`,
  url: `https://assets.example.com/personal-site/media/${hash}.webp`,
  mime: 'image/webp'
}
const media = {
  source: { key: 'video', kind: 'file', edited: '' },
  pipelineVersion: 2,
  original,
  poster,
  variants: []
}

function render(value: unknown) {
  return renderToStaticMarkup(
    <Blocks
      blocks={[
        {
          id: 'a'.repeat(32),
          type: 'video',
          media: 'video',
          children: [],
          caption: [
            {
              text: 'Outtake: the shadow grows bear ears.',
              bold: false,
              italic: false,
              underline: false,
              strike: false,
              code: false,
              color: 'default'
            }
          ]
        }
      ]}
      snapshot={
        { media: { video: mediaSchema.parse(value) } } as unknown as Snapshot
      }
    />
  )
}

describe('article videos', () => {
  it('includes the native ratio and poster in initial server HTML', () => {
    const html = render(media)
    expect(html).toContain('width="900" height="1600"')
    expect(html).toContain('aspect-ratio:900 / 1600')
    expect(html).toContain(`poster="${poster.url}"`)
    expect(html).toContain(`src="${original.url}"`)
    expect(html).toContain('preload="metadata"')
    expect(html).toContain(
      '<figcaption><span class="rich-text">Outtake: the shadow grows bear ears.</span></figcaption>'
    )
  })
  it('still renders older snapshots without video metadata', () => {
    const html = render({
      ...media,
      poster: undefined,
      original: { ...original, width: undefined, height: undefined }
    })
    expect(html).toContain('<video')
    expect(html).not.toContain('aspect-ratio')
    expect(html).not.toContain('poster=')
  })
})
