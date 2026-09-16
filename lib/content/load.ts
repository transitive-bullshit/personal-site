import 'server-only'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { snapshotSchema } from './schema'
import { resolveContentLinks } from './content-links'
import { validateSnapshot } from './references'

function load() {
  let raw: string
  try {
    raw = readFileSync(join(process.cwd(), 'content/snapshot.json'), 'utf8')
  } catch {
    throw new Error(
      'Missing content snapshot. Run pnpm content:sync and commit content/snapshot.json before building.'
    )
  }
  const snapshot = snapshotSchema.parse(JSON.parse(raw))
  validateSnapshot(snapshot)
  return resolveContentLinks(snapshot)
}

export const content = load()
export const articles = Object.values(content.articles).sort(
  (a, b) =>
    b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug)
)
export const featuredArticles = articles.filter((article) => article.featured)

export const projects = Object.values(content.projects ?? {}).sort(
  (a, b) =>
    (b.published ?? '').localeCompare(a.published ?? '') ||
    a.slug.localeCompare(b.slug)
)
export const featuredProjects = projects.filter((project) => project.featured)
