import type { NextConfig } from 'next'

const config: NextConfig = {
  images: {
    remotePatterns: [
      new URL('https://assets.cultural-alignment.com/personal-site/media/**')
    ]
  }
}

export default config
