import { expect, it } from 'vitest'
import { imageDownloadSource } from '../components/article/image-download'

it.each([
  ['/images/photo.jpg', 'photo.jpg'],
  ['/images/illustration.webp', 'illustration.webp']
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
