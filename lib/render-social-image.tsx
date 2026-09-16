import { ImageResponse } from 'takumi-js/response'
import { SocialImage, socialTitleStyle } from '../components/social-image'
import { Renderer } from 'takumi-js/node'
import { fromJsx } from 'takumi-js/helpers/jsx'
import { socialImageSize, type SocialImageData } from './social-image'

const renderer = new Renderer()

async function balancedTitleWidth(title: string) {
  const measure = async (width: number) => {
    const { node, css } = await fromJsx(
      <div style={{ ...socialTitleStyle(title), width }}>{title}</div>
    )
    return renderer.measure(node, { css })
  }
  // Takumi 2.13 balances lines without recentering the wider text box. Find
  // the narrowest box that preserves the line count, then center that box.
  let low = 1
  let high = 848
  const { height } = await measure(high)
  while (high - low > 1) {
    const width = Math.floor((low + high) / 2)
    if ((await measure(width)).height <= height) high = width
    else low = width
  }
  return high
}

export function allowedSocialImageUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.origin === 'https://assets.cultural-alignment.com' &&
      /^\/personal-site\/media\/[a-f0-9]{64}\.[a-z0-9]+$/.test(url.pathname) &&
      !url.search &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

export async function renderSocialImage(data: SocialImageData) {
  const titleWidth = await balancedTitleWidth(data.title)
  const render = (cover: string | undefined) =>
    new ImageResponse(
      <SocialImage data={{ ...data, cover }} titleWidth={titleWidth} />,
      {
        ...socialImageSize,
        renderer,
        format: 'webp',
        quality: 90,
        headers: {
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'CDN-Cache-Control':
            'public, max-age=86400, stale-while-revalidate=604800',
          'Vercel-CDN-Cache-Control': 'public, max-age=31536000, immutable'
        },
        images: {
          allowUrl: allowedSocialImageUrl,
          timeout: 5000,
          maxBytes: 8 * 1024 * 1024
        },
        // Built-in Geist needs no remote font request. Current article titles are Latin.
        emoji: 'from-font',
        onError: () => {}
      }
    )
  const response = render(data.cover)
  try {
    // Wait before returning headers so a failed background can become a usable card.
    await response.ready
    return response
  } catch (err) {
    if (!data.cover) throw err
    console.warn('Social image cover unavailable; rendering text fallback')
    const fallback = render(undefined)
    await fallback.ready
    return fallback
  }
}
