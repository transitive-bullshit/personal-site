import type { Metadata } from 'next'
import { FacesExperience } from '@/components/faces/faces-experience'
import { site } from '@/lib/site'

// Prototype for a future intro splash: keep it out of search and discovery.
export const metadata: Metadata = {
  title: 'Faces',
  description: 'A particle swarm that assembles into portraits.',
  robots: { index: false, follow: false }
}

const subtitle = 'Building at the edge of the singularity'

// Each cycle assembles one of these at random; see docs/faces.md.
const portraits = ['avatar', 'selfie', 'pool', 'puppies'].map((variant) => ({
  id: `travis-${variant}`,
  name: site.author,
  subtitle,
  directory: `/faces/travis-${variant}`
}))

export default function FacesPage() {
  return (
    <FacesExperience
      portraits={portraits}
      // Label each face while portraits are under review.
      showDebug={
        process.env.NODE_ENV === 'development' ||
        process.env.VERCEL_ENV === 'preview'
      }
    />
  )
}
