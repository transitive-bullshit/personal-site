import type { LinkPreviewData } from './link-preview'
import { savedLinkPreviewSources } from './saved-link-preview-sources'
import imageManifest from '../content/link-preview-images.json'

const images = imageManifest as Record<
  string,
  { image: string; origin: string }
>

function previewKey(value: string) {
  const url = new URL(value)
  url.hash = ''
  url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  if (url.hostname === 'www.youtube.com' && url.pathname === '/watch') {
    url.searchParams.delete('t')
    url.searchParams.delete('start')
  }
  return url.href
}

export const savedLinkPreviews: LinkPreviewData[] = savedLinkPreviewSources.map(
  (source) => ({
    url: source.url,
    title: source.title,
    description: source.description,
    siteName: source.siteName,
    image: images[source.key]?.image,
    imageAlt: source.title
  })
)
const saved = new Map(
  savedLinkPreviews.map((preview) => [previewKey(preview.url), preview])
)

export function getSavedLinkPreview(url: string): LinkPreviewData | undefined {
  try {
    return saved.get(previewKey(url))
  } catch {
    return undefined
  }
}
