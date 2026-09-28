import type { Project, Snapshot } from './schema'

// The first top-level video is the project's primary video. External embeds
// keep their body placement because they cannot use our native poster player.
export function getProjectHeroVideo(project: Project, snapshot: Snapshot) {
  if (project.type !== 'Video') return undefined
  const block = project.blocks.find((block) => block.type === 'video')
  return block?.type === 'video' && block.media && snapshot.media[block.media]
    ? block
    : undefined
}
