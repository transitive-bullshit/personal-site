import { ViewTransition, type ReactNode } from 'react'

// Keep identity independent of the route/slug, and outside the image lightbox
// so opening a portal never mounts a second participant with the same name.
export function ProjectTransition({
  projectId,
  part,
  children
}: {
  projectId?: string
  part: 'image' | 'title' | 'description'
  children: ReactNode
}) {
  if (!projectId) return children
  return (
    <ViewTransition
      name={`project-${projectId}-${part}`}
      default='none'
      share={part === 'image' ? 'project-image-morph' : 'project-text-morph'}
    >
      {children}
    </ViewTransition>
  )
}
