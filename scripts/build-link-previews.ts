import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { savedLinkPreviewSources } from '../lib/saved-link-preview-sources'
import { renderSocialImage } from '../lib/render-social-image'
import { socialImageTemplateVersion } from '../lib/social-image'
import { publicFetch } from './public-fetch'

type PreviewImage = { image: string; origin: string; fingerprint: string }
await mkdir('public/link-previews', { recursive: true })
const old = JSON.parse(
  await readFile('content/link-preview-images.json', 'utf8')
) as Record<string, PreviewImage>
const images: Record<string, PreviewImage> = {}
const published = new Map<string, PreviewImage>()
const refresh = process.argv.includes('--refresh')

for (const source of savedLinkPreviewSources) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([socialImageTemplateVersion, source]))
    .digest('hex')
  const previous = old[source.key]
  const shared = source.sourceImage
    ? published.get(source.sourceImage)
    : undefined
  const reuse =
    shared ??
    (!refresh &&
    previous &&
    (previous.fingerprint === fingerprint ||
      previous.origin === source.sourceImage)
      ? previous
      : undefined)
  if (reuse) {
    await readFile('public' + reuse.image)
    images[source.key] = { ...reuse, fingerprint }
    if (source.sourceImage)
      published.set(source.sourceImage, images[source.key]!)
    continue
  }
  let bytes: Buffer
  let origin = 'authored-card'
  if (source.sourceImage) {
    const response = await publicFetch(source.sourceImage)
    if (!response.ok)
      throw new Error(`Image HTTP ${response.status}: ${source.key}`)
    const original = Buffer.from(await response.arrayBuffer())
    bytes = await sharp(original)
      .resize(1200, 630, { fit: 'contain', background: '#24252d' })
      .webp({ quality: 90 })
      .toBuffer()
    origin = source.sourceImage
  } else {
    const response = await renderSocialImage({
      title: source.title,
      description: source.description,
      siteName: source.siteName,
      author: source.kind,
      published: '',
      domain: new URL(source.url).hostname,
      cover: undefined
    })
    bytes = Buffer.from(await response.arrayBuffer())
  }
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
  const image = `/link-previews/${source.key}-${hash}.webp`
  await writeFile('public' + image, bytes)
  images[source.key] = { image, origin, fingerprint }
  if (source.sourceImage) published.set(source.sourceImage, images[source.key]!)
  console.log(`${source.key}: ${image}`)
}
await writeFile(
  'content/link-preview-images.json',
  JSON.stringify(images, null, 2) + '\n'
)
