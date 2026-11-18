import type { Article, Project } from './schema'

// These entries keep their cover for cards and social images but place it themselves
// in the body, so the page does not repeat it above the first block.
// Keyed by Notion ID so title or slug changes retain the choice.
const bodyPlacedCoverIds = new Set([
  '3f7edb27f12481bcb191fcff5dcafd41' // AI Cyberswarm Warfare
])

export function showsCoverAboveBody(entry: Article | Project) {
  return Boolean(entry.cover) && !bodyPlacedCoverIds.has(entry.id)
}
