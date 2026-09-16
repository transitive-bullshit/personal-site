# Content sync

`pnpm content:sync` writes `content/snapshot.json` and `public/search-index.json` for review. It does not deploy.

## Setup

Use the Node and pnpm versions in `package.json`, then run `pnpm install`.

Set these values in the shell or ignored `.env.local`:

- `NOTION_TOKEN`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_API_ENDPOINT`
- `S3_BUCKET_NAME=cultural-alignment`
- `S3_PUBLIC_URL=https://assets.cultural-alignment.com`
- `S3_REGION=auto` (optional)

Source IDs live in `lib/site.ts`. Media is immutable under `personal-site/media/` in R2.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm content:sync` | Sync changed public articles and write the snapshot. |
| `pnpm content:sync --dry-run` | Validate and report without writes. |
| `pnpm content:sync --force` | Re-read every article and refresh remote data. |
| `pnpm content:sync --fast` | Skip image transfers and placeholder work. |
| `pnpm content:sync --prune` | Remove missing articles. |
| `pnpm content:sync --accept-slug-changes` | Accept new paths and retain redirects. |
| `pnpm content:search` | Rebuild the search index from the local snapshot without CMS credentials. |

Flags compose. `--force --fast` re-reads articles but skips images.

## Behavior

- Only top-level `Public=true` pages become articles.
- Unchanged pages reuse the saved article when `last_edited_time <= modified`.
- `--force` bypasses that page cache.
- Article imports use `p-map` with concurrency `8`.
- Path changes require `--accept-slug-changes`.
- Missing pages remain until `--prune`.
- `Public=false` removes the article on the next sync.
- Post-processing rebuilds the static search index, including unchanged-content syncs. Dry runs do not write it.

## Media

- Unchanged sources reuse saved descriptors.
- Still images get WebP variants and an 8 × 8 blur preview.
- GIFs, SVGs, video, audio, and files keep their original bytes.
- `--fast` reuses saved images and omits new ones.
- Fast changes are marked for image work on the next normal sync.
- Bookmark and tweet failures reuse saved data or a link fallback.
- `work/media-cache.json` resumes completed uploads.

## Errors

Authorization, discovery, route, schema, and snapshot-write failures stop the sync.

Article, media, bookmark, tweet, storage-probe, and placeholder failures warn and continue. The snapshot is written, then the command exits `1`. Informational warnings do not change the exit code.

R2 uploads may precede a later failure. They are immutable and unused until the snapshot is committed and deployed.

## Review

1. Inspect `git diff`, especially paths and removals.
2. Run `pnpm test` and `pnpm build`.
3. Inspect representative pages with `pnpm dev`.
4. Commit `content/snapshot.json` and `public/search-index.json` with related code.

Restart an existing dev server after syncing.

## Extending the importer

1. Run `pnpm content:sync --dry-run --force`.
2. Update the schema and Notion normalizer.
3. Add rendering and behavior tests.
4. Sync again and inspect the diff.

Keep Notion and storage clients in `scripts/`.

## Client-side search

Command-K / Control-K and the header search icon open cmdk. The dialog code and index load only on first open; subsequent opens reuse the fetched index. Queries stay in the browser. Keyword matches prefer titles, then descriptions/tags, then nested article text, captions, tables, and saved bookmark/tweet text. Canonical public article routes plus Home and Writing are indexed; add future top-level pages in `lib/content/search-index.ts`.

The top and selected results are explicitly prefetched. Results use full-row Next links with no gaps. A temporary **Preview style** control compares adaptations of cmdk's [four example themes](https://github.com/dip/cmdk/tree/main/website/styles/cmdk): Vercel (initial default), Linear, Raycast, and Framer. The choice persists locally. After choosing one, remove the other CSS variants, the preview control, and its storage key. Shared adaptations remove demo panes, item margins, and keyboard-driven motion; Framer's blue is darkened for readable white text. License attribution is in `docs/licenses/cmdk.txt`.

## Runtime images

The app serves synced images through `next/image` from the configured R2 path. Social cards use the saved cover through `components/social-image.tsx`; bump `templateVersion` in `lib/social-image.ts` after design changes.
