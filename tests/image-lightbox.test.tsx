import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { EssayImage } from '../components/article/cyber-swarm/essay-images'
import { imageDownloadSource } from '../components/article/image-download'

it('registers both essay photos as normal gallery triggers', () => {
  const $ = load(
    renderToStaticMarkup(
      <article>
        <EssayImage
          src='/essays/cyber-swarm/iron-dome-original.jpg'
          alt='Original photograph'
          width={1024}
          height={576}
          sizes='1120px'
          priority
        />
        <EssayImage
          src='/essays/cyber-swarm/swarm.webp'
          alt='AI swarm illustration'
          width={1672}
          height={941}
          sizes='1120px'
        />
      </article>
    )
  )
  const triggers = $('article .image-lightbox-trigger')
  expect(triggers).toHaveLength(2)
  expect(triggers.eq(0).attr('aria-label')).toBe(
    'Enlarge image: Original photograph'
  )
  expect(triggers.eq(1).attr('aria-label')).toBe(
    'Enlarge image: AI swarm illustration'
  )
  expect(triggers.eq(0).find('img').attr('fetchpriority')).toBe('high')
  expect(triggers.eq(0).find('img').attr('sizes')).toBe('1120px')
  expect(triggers.eq(1).find('img').attr('loading')).toBe('lazy')
})

it.each([
  ['/essays/cyber-swarm/iron-dome-original.jpg', 'iron-dome-original.jpg'],
  ['/essays/cyber-swarm/swarm.webp', 'swarm.webp']
])('downloads the public original at %s directly', (src, filename) => {
  expect(imageDownloadSource(src)).toEqual({ src, filename })
})

it('keeps remote originals behind the existing snapshot-backed endpoint', () => {
  expect(
    imageDownloadSource(
      'https://assets.cultural-alignment.com/personal-site/media/example.gif'
    )
  ).toEqual({
    filename: 'example.gif',
    src: '/api/media-download/example.gif'
  })
  expect(imageDownloadSource('//untrusted.example/missing.png')).toEqual({
    filename: 'missing.png',
    src: '/api/media-download/missing.png'
  })
})
