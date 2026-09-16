import type { Metadata } from 'next'
import { deploymentOrigin, site } from './site'

export function defaultSocialImages() {
  return [
    {
      url: deploymentOrigin() + '/social-image.jpg',
      width: 1200,
      height: 630,
      alt: 'Travis Fischer — Building things. Sharing what I learn.'
    }
  ]
}

export function websiteMetadata(
  title: string,
  description: string,
  path: string
): Metadata {
  const images = defaultSocialImages()
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      title,
      description,
      url: site.origin + path,
      siteName: site.name,
      images
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
      creator: '@' + site.twitter
    }
  }
}
