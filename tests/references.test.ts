import { expect, it } from 'vitest'
import { snapshotSchema, type Snapshot } from '../lib/content/schema'
import { validateSnapshot } from '../lib/content/references'
import {
  contentFixture,
  articleId,
  projectId,
  storedMedia
} from './fixtures/content'

const cases: [string, (snapshot: Snapshot) => void, string][] = [
  [
    'entry identity',
    (snapshot) => {
      snapshot.articles[articleId]!.id = projectId
    },
    'identity/path mismatch'
  ],
  [
    'canonical path',
    (snapshot) => {
      snapshot.articles[articleId]!.slug = 'other-slug'
    },
    'identity/path mismatch'
  ],
  [
    'publication state',
    (snapshot) => {
      snapshot.routes[articleId]!.active = false
    },
    'publication mismatch'
  ],
  [
    'nested duplicate anchors',
    (snapshot) => {
      snapshot.articles[articleId]!.blocks[0]!.children.push(
        structuredClone(snapshot.articles[articleId]!.blocks[0]!)
      )
    },
    'Duplicate block ID'
  ],
  [
    'internal ID-shaped links',
    (snapshot) => {
      const block = snapshot.articles[articleId]!.blocks[0]!
      if (block.type === 'paragraph') block.richText[0]!.href = '/' + projectId
    },
    'ID-shaped internal link'
  ],
  [
    'missing tweet state',
    (snapshot) => {
      snapshot.articles[articleId]!.blocks.push({
        id: 'e'.repeat(32),
        type: 'embed',
        url: 'https://x.com/fixture/status/123',
        tweetId: '123',
        caption: [],
        children: []
      })
    },
    'Missing tweet state'
  ],
  [
    'asset hash mismatch',
    (snapshot) => {
      snapshot.media.cover = storedMedia()
      const asset = snapshot.media.cover.original
      if (!('remote' in asset)) asset.hash = '2'.repeat(64)
    },
    'content-addressed media reference'
  ],
  [
    'asset path mismatch',
    (snapshot) => {
      snapshot.media.cover = storedMedia()
      snapshot.media.cover.original.url = 'https://example.com/wrong.webp'
    },
    'content-addressed media reference'
  ],
  [
    'temporary file URLs',
    (snapshot) => {
      snapshot.media.cover = storedMedia()
      snapshot.media.cover.source.url =
        'https://example.com/signed?token=fixture'
    },
    'Temporary Notion URL'
  ],
  [
    'remote source mismatch',
    (snapshot) => {
      snapshot.media.video = {
        source: {
          key: 'video',
          kind: 'external',
          url: 'https://example.com/one.mp4',
          edited: '2026-01-01'
        },
        pipelineVersion: 2,
        variants: [],
        original: {
          remote: true,
          url: 'https://example.com/two.mp4',
          mime: 'video/mp4',
          bytes: 4,
          width: 160,
          height: 90
        }
      }
    },
    'Invalid remote video source'
  ]
]

it.each(cases)(
  'rejects schema-valid snapshots with %s',
  (_name, mutate, message) => {
    const snapshot = contentFixture()
    mutate(snapshot)
    // Parsing must succeed so an unrelated schema guard cannot supply the failure.
    const parsed = snapshotSchema.parse(snapshot)
    expect(() => validateSnapshot(parsed)).toThrow(message)
  }
)
