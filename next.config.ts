import type { NextConfig } from 'next'

const config: NextConfig = {
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
      new URL('https://assets.cultural-alignment.com/personal-site/media/**')
    ]
  }
}

export default config
