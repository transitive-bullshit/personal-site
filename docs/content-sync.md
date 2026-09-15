# Content sync

The website reads `content/snapshot.json`. Notion and storage credentials are needed only for the explicit importer; builds and article requests use the saved content.

## Setup

Use the Node and pnpm versions declared in `package.json`. Install dependencies with `pnpm install`.

Provide `NOTION_TOKEN` in your shell or ignored `.env.local`. The authorized R2 settings have been copied into this checkout's ignored `.env.local`; other checkouts can use `.env.example` as a template:

- `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: the existing bucket's S3 credentials.
- `S3_API_ENDPOINT`: the authenticated R2 endpoint.
- `S3_BUCKET_NAME=cultural-alignment`.
- `S3_PUBLIC_URL=https://assets.cultural-alignment.com`.
- `S3_REGION=auto` (default).

Development and production share this bucket. This site writes immutable objects under `personal-site/media/`. Media files and credentials stay outside Git.

The source IDs live in `lib/site.ts`. The importer verifies the token’s workspace ID through the official users/me endpoint, root/database/data-source ancestry, and the expected property contract before reading articles. It pins official Notion API version `2026-03-11`, whose page deletion state is `in_trash`.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm content:sync --dry-run` | Validate the current source and report the proposed import without writing local content or R2 objects. |
| `pnpm content:sync` | Import public articles, reuse unchanged media, and atomically publish a complete snapshot. |
| `pnpm content:sync --force` | Refresh media sources and tweets. Existing identical R2 objects are reused by content hash. |
| `pnpm content:sync --accept-slug-changes` | Accept proposed title/Slug pathname changes and redirect previous paths. |
| `pnpm content:sync --prune` | Remove previously imported pages missing from a complete source query. |
| `pnpm content:sync --help` | Show flags. |

Flags compose; force never implies pruning or renaming. A dry run validates the source and required block/property shapes, but does not download new media or test an upload. The first real sync verifies those paths.

## Publication and URLs

Only `Public=true` rows from the top-level Blog Posts collection become articles. The homepage belongs to the app. About and nested page routes are excluded.

The JavaScript tools article's five nested comparison databases become lightweight property tables. Their row-page bodies are not imported.

A title or Slug edit leaves the current public pathname intact until explicitly accepted. Accepted changes create direct permanent redirects. Path ownership is retained after removal, preventing accidental reassignment.

A missing page is retained with a warning until explicit pruning. A successfully observed `Public=false` removes its route and aliases on the next successful sync. An incomplete collection query cannot establish that pages are missing.

Canonical paths, historical aliases, and compact/hyphenated page-ID URLs resolve only to published articles. The old root alias `/transitivebullshit` redirects to `/`. The migration audit recovered 104 production-cache mappings; none introduced another slug for the selected 35 articles.

## Media and repeatability

The importer scans article blocks and table rows each time, because descendant changes must not depend solely on the parent page's edit timestamp.

Unchanged block/source identity and pipeline version reuse saved media without downloading or processing it. Changed media retains its original bytes, adds responsive WebP variants for still images, and hashes each output. Authenticated HEAD checks skip existing objects; conditional PUT handles concurrent uploads.

GIFs, animated images, SVGs, videos, audio, and attachments retain their original bytes. There is no GIF or video transcoding. Notion file links are refreshed if an expiring source URL fails. Downloads allow up to five minutes per attempt and retry transient connection/stream failures at most twice; files are capped at 256 MiB.

An unchanged normal sync should leave the snapshot byte-identical and upload no media. The generated snapshot is excluded from oxfmt because the importer owns its canonical JSON serialization. Changes to processing settings must increment `MEDIA_PIPELINE_VERSION`. Force refresh is useful for external media replaced behind the same URL.

Tweet data is saved during sync and rendered using `react-tweet`. Normal sync reuses available saved tweets; force refreshes them. Missing/private tweets fall back to an original-post link. A transient retrieval error reuses saved data where possible. Intentional embed providers and their own media can remain external.

## Bookmark previews and article controls

Bookmark Open Graph metadata is fetched only during explicit sync. The importer falls back to Twitter card metadata, resolves relative image URLs after redirects, and caches usable images through the same immutable R2 pipeline. Saved titles, descriptions, and image descriptors live in the snapshot's `bookmarks` map, keyed by the exact destination URL. Repeated links share one preview.

Normal sync reuses saved previews, including text-only fallbacks. `--force` refreshes them along with other media; failed refreshes preserve previously cached images. A dry run never fetches bookmark destinations or uploads their images. Missing metadata, unavailable pages, and unusable images preserve useful text links. Preview requests validate public destinations and redirect targets, cap HTML reads, and use bounded timeouts and concurrency.

Article images and covers open an accessible lightbox with captions and an original-image link. Escape, the close button, and the backdrop dismiss it; focus returns to the triggering image. GIFs remain unchanged. The TOC selects the final heading when the article ends in the viewport, then resumes normal heading tracking when scrolling up; resize and content-size changes are observed.

If a development server was already running during sync, restart it to load the newly published snapshot. Production builds read the saved snapshot without contacting bookmark sites.

## Failure recovery

Required API, schema, block, or media errors fail the run and preserve the previous snapshot. Errors identify the article and block where possible. Fix the source or importer and rerun; there is no general ignore-errors mode.

The importer writes a temporary sibling file, validates the full candidate, and replaces the single authoritative snapshot atomically. Uploads that precede a later failure may remain in R2; they are immutable and harmless. Sync does not delete bucket objects.

Completed media descriptors also persist in ignored `work/media-cache.json`, so a failed import can reuse successful uploads on the next run. The cache contains no temporary Notion URLs and never decides which articles are published. Dry runs do not write it; force bypasses reuse. It is safe to remove when no sync is running. Article imports use three workers while official API requests remain serial and paced.

A real sync holds `work/content-sync.lock`, containing its process ID. If a run was interrupted, verify that process has ended before removing a stale lock. Do not delete the lock for a running importer.

## Adding supported content

1. Run a dry sync to identify the new block/property shape.
2. Extend the normalized Zod union in `lib/content/schema.ts`.
3. Add official API normalization in `scripts/notion/normalize.ts`.
4. Add semantic rendering in `components/article/blocks.tsx` or a focused child component.
5. Add a behavior test that exercises the new shape and a failure case.
6. Rerun sync, inspect its diff, and check the real rendered article.

Keep SDKs and credentials in script-only modules. Client components should receive only the small values needed for interactivity.

## Review and publish the saved content

After a successful sync:

1. Review `git diff` and newly generated files, especially publication and pathname changes.
2. Run `pnpm fix:format`, `pnpm fix:lint`, `pnpm test`, and `pnpm build`.
3. Inspect representative articles with `pnpm dev`.
4. Commit the code and `content/snapshot.json` together.

The app produces article Open Graph and JSON-LD metadata, `sitemap.xml`, and `llms.txt` from the snapshot. Aliases and unpublished articles are omitted from discovery endpoints.

## Image loading and blur placeholders

All synced article images, covers, icons, bookmark previews, and lightbox images use `next/image`. Only `https://assets.cultural-alignment.com/personal-site/media/**` is allowed by `remotePatterns`. Covers use `loading="eager"` and `fetchPriority="high"`; other inline images remain lazy loaded.

Next.js automatically generates blur data for static imports, but remote images require a supplied `blurDataURL` ([Image documentation](https://nextjs.org/docs/app/api-reference/components/image#blurdataurl)). Sync generates an inline WebP preview no larger than 8 × 8 pixels using Sharp, and stores it in each image descriptor. Next.js handles the blur and removes the placeholder when the image loads. Animated images use a separate first-frame preview; their original bytes and animation remain unchanged.

Normal sync backfills older descriptors from immutable cached R2 assets, including reused bookmark previews, and resumes completed previews from the local media cache. Dry runs skip this work. Once saved, previews need no further fetching or generation. Builds read them from the snapshot without Notion or storage credentials. Still images use Next.js responsive optimization; GIFs, animated images, and SVGs bypass re-encoding.

## Generated article social images

Articles advertise `/api/social-image/<canonical-slug>?v=<content-hash>` in Open Graph, Twitter cards, and JSON-LD. Takumi renders a 1200 × 630 WebP on demand from the saved article metadata and its cached R2 cover. The first-pass design follows the starter kit: subtly blurred full-bleed cover, centered white title panel, description, author, publication month/year, and site identity. Long descriptions are shortened for the card.

The Node.js route uses `takumi-js/response`, with `@takumi-rs/core` externalized as required by [Takumi's Next.js integration](https://takumi.kane.tw/docs/integration/nextjs). Built-in Geist avoids remote font requests. Rendering never calls Notion or accepts arbitrary image/title query parameters. Missing or unpublished articles return 404; existing aliases resolve the canonical article.

Successful images send browser caching for one hour and CDN caching for one day, with stale-while-revalidate for one week. Changes to displayed metadata, cached cover URLs, or the template version produce a fresh advertised URL. Cover failures produce a readable text card cached for five minutes at the CDN. Cover requests are limited to immutable image paths in our bucket, with a five-second timeout and 8 MiB limit.

Edit `components/social-image.tsx` for the design, and bump `templateVersion` in `lib/social-image.ts` when changing the template. Builds still prerender all article HTML without CMS/storage credentials; only social-image requests invoke Takumi.
