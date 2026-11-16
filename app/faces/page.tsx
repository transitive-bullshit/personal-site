import type { Metadata } from 'next'
import { FacesExperience } from '@/components/faces/faces-experience'
import { site } from '@/lib/site'

// Prototype for a future intro splash: keep it out of search and discovery.
export const metadata: Metadata = {
  title: 'Faces',
  description: 'A particle swarm that assembles into a portrait.',
  robots: { index: false, follow: false }
}

export default function FacesPage() {
  return (
    <FacesExperience
      portrait={{
        name: site.author,
        subtitle: 'Building at the edge of the singularity',
        directory: '/faces/travis'
      }}
    />
  )
}
