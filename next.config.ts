import type { NextConfig } from 'next'
import { legacyRedirects } from './lib/content/legacy-redirects'

const config: NextConfig = {
  redirects() {
    return [
      ...Object.entries(legacyRedirects).map(([slug, destination]) => ({
        source: '/' + slug,
        destination,
        permanent: true
      })),
      { source: '/tags/:tag*', destination: '/writing', permanent: true }
    ]
  },
  rewrites() {
    return [
      { source: '/projects/:slug.md', destination: '/markdown/projects/:slug' },
      { source: '/:slug.md', destination: '/markdown/:slug' }
    ]
  },
  // Keep Takumi's native loader out of the webpack bundle so tracing includes
  // the platform binding instead of baking in a build-machine filesystem path.
  serverExternalPackages: ['takumi-js', '@takumi-rs/core'],
  images: {
    remotePatterns: [
      new URL('https://assets.cultural-alignment.com/personal-site/media/**'),
      new URL('https://pbs.twimg.com/profile_images/**')
    ]
  }
}

export default config
