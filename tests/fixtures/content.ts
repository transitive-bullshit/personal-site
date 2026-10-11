import type {
  Article,
  Block,
  Media,
  Project,
  Snapshot
} from '../../lib/content/schema'
import { sourceContract, projectSourceContract } from '../../lib/site'

export const articleId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
export const projectId = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

export function paragraph(
  id: string,
  text: string,
  children: Block[] = []
): Extract<Block, { type: 'paragraph' }> {
  return {
    id,
    type: 'paragraph',
    color: 'default',
    children,
    richText: [
      {
        text,
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        code: false,
        color: 'default'
      }
    ]
  }
}

export const article: Article = {
  id: articleId,
  title: 'Fixture article',
  slug: 'fixture-article',
  description: 'Article description',
  author: 'Travis Fischer',
  published: '2026-01-01',
  modified: '2026-01-01',
  featured: false,
  tags: [],
  blocks: [paragraph('c'.repeat(32), 'Distinct article body')]
}

export const project: Project = {
  id: projectId,
  title: 'Fixture project',
  slug: 'fixture-project',
  description: 'Project description',
  authors: [],
  modified: '2026-01-01',
  featured: false,
  tags: [],
  blocks: [paragraph('d'.repeat(32), 'Distinct project body')]
}

export function storedMedia(
  key = 'cover',
  hash = '1'.repeat(64),
  variantHash = '3'.repeat(64)
): Media {
  const asset = {
    key: 'personal-site/media/' + hash + '.webp',
    url:
      'https://assets.cultural-alignment.com/personal-site/media/' +
      hash +
      '.webp',
    hash,
    mime: 'image/webp',
    bytes: 123,
    width: 1200,
    height: 630
  }
  return {
    source: { key, kind: 'file', edited: '2026-01-01' },
    pipelineVersion: 2,
    original: asset,
    variants: [
      {
        ...asset,
        width: 960,
        height: 504,
        hash: 'f'.repeat(64),
        key: 'personal-site/media/' + 'f'.repeat(64) + '.webp',
        url:
          'https://assets.cultural-alignment.com/personal-site/media/' +
          'f'.repeat(64) +
          '.webp'
      },
      {
        ...asset,
        hash: variantHash,
        key: 'personal-site/media/' + variantHash + '.webp',
        url:
          'https://assets.cultural-alignment.com/personal-site/media/' +
          variantHash +
          '.webp'
      }
    ]
  }
}

export function contentFixture(): Snapshot {
  return structuredClone({
    schemaVersion: 1,
    importerVersion: 1,
    source: { ...sourceContract, apiVersion: '2026-03-11', propertyIds: {} },
    projectSource: {
      ...projectSourceContract,
      apiVersion: '2026-03-11',
      propertyIds: {}
    },
    articles: { [articleId]: article },
    routes: {
      [articleId]: {
        slug: article.slug,
        aliases: ['old-article'],
        active: true
      }
    },
    projects: { [projectId]: project },
    projectRoutes: {
      [projectId]: { slug: project.slug, aliases: [], active: true }
    },
    media: {},
    tweets: {}
  } satisfies Snapshot)
}
