# Content sync

Notion owns article and project content. `pnpm content:sync` imports selected public entries into `content/snapshot.json` and rebuilds `public/search-index.json`. Review and commit both generated files; deployment is separate. Routine UI development uses the committed files without CMS or storage credentials.

## Setup

Use the Node and pnpm versions in `package.json`. Supply these variables in the shell or ignored `.env.local` (`scripts/io.ts` also supports `.env`; existing shell values win):

- `NOTION_TOKEN`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_API_ENDPOINT`
- `S3_BUCKET_NAME=cultural-alignment`
- `S3_PUBLIC_URL=https://assets.cultural-alignment.com`
- `S3_REGION=auto` (optional)

Video imports require `ffmpeg` on PATH (`brew install ffmpeg` on macOS). Rendering and builds do not run FFmpeg.

Every sync mode, including `--dry-run` and `--fast`, requires this configuration. Source contracts live in `lib/site.ts`; `scripts/notion/source.ts` pins the official API version and expected properties. Sync verifies workspace, root-page ancestry, database/data-source IDs, and saved property IDs before importing. A source-contract mismatch requires an intentional migration, not editing the snapshot to suppress the check.

## Commands

| Command | Effect |
| --- | --- |
| `pnpm content:sync` | Import changed articles and projects, then refresh derived data. |
| `pnpm content:sync --only articles` | Select articles; retain saved projects and their referenced assets. |
| `pnpm content:sync --only projects` | Select projects; retain saved articles and their referenced assets. |
| `pnpm content:sync --dry-run` | Read and validate source data without local or R2 writes. |
| `pnpm content:sync --force` | Re-read every selected page and refresh its media, bookmarks, and tweets. |
| `pnpm content:sync --fast` | Reuse saved media, omit new images/videos/audio/files, and defer all media processing to a normal sync. |
| `pnpm content:sync --prune` | Deactivate missing entries in the selected collections. |
| `pnpm content:sync --accept-slug-changes` | Accept proposed paths and retain old paths as redirects. |
| `pnpm content:videos` | Backfill saved video dimensions and posters from verified R2 originals, without fetching Notion. Requires storage configuration and FFmpeg; resumes by skipping completed videos. |
| `pnpm content:search` | Rebuild search from the committed snapshot without CMS credentials. |

Interactive terminals show a Tasuku task list with spinners, elapsed time, and completed/active counts for page imports, image-width batches, bookmarks, tweets, and placeholders. Finished children collapse into their phase counts so active work stays visible. Warnings mark the phase and print in full before the final JSON summary. Redirected output, CI, and dumb terminals use plain start/completion logs.

Article and project discovery run concurrently as separate progress tasks, sharing the paced Notion request queue. Both finish before imports begin; a discovery failure stops publication. `--only` runs discovery only for the selected collection.

Flags compose. `--only projects --force --fast` re-reads projects while skipping all media transfers and video inspection. Fast mode retains saved media even when its source has changed, omits media without a saved asset, and refreshes bookmark text and tweet data when needed. YouTube/Vimeo embeds remain available because they require no media import. The existing `needsImageSync` marker also tracks deferred video, audio, and file work so a later normal sync revisits these entries.

Dry runs still perform Notion discovery, selected page reads, public image-layout reads, and an R2 access probe. They skip media downloads/uploads, placeholder generation, and bookmark/tweet fetches. A successful dry run therefore does not prove those remote assets are available.

## Publication and caching

- Discovery reads top-level database rows, including private-row metadata so deliberate unpublishing can be detected. Only `Public=true` entries have their bodies and media imported. Child pages are excluded; embedded databases become property tables without fetching row-page bodies.
- Unchanged entries reuse saved bodies when `last_edited_time <= modified`, unless forced or marked `needsImageSync` by an earlier fast import. Image-layout refresh still runs for cached entries.
- Articles and projects share the importer but have independent route registries. `--only` skips discovery and body imports for the other collection. Shared assets can still change; search always includes both collections.
- Proposed slug changes warn and retain the saved path until explicitly accepted. Accepted old paths and Notion ID forms redirect to the current path. Inactive route records retain pathname ownership as tombstones.
- Missing or trashed entries remain published until `--prune`. An observed `Public=false` deactivates the entry immediately in the next published snapshot. Neither operation deletes content in Notion or objects in R2.
- Cross-collection slug/alias matches warn and retain both records: articles use `/[slug]`, projects `/projects/[slug]`.

Publication validates the complete snapshot and writes deterministic JSON through an atomic rename. Unchanged bytes are not rewritten. Search is published afterward in a separate atomic write; the two files are not one transaction.

Projects import the optional `Type` select value and separate `Website` and `YouTube` URL properties, tracking their property IDs. Website identifies the hosted project; YouTube imports only for the exact type `Video`. Empty URLs remain unset. Adopting Type or YouTube re-reads cached projects once. Video projects show a YouTube action when populated and can also have a Website action. GitHub Source URLs use the GitHub icon; other Source URLs use the generic code icon. These links also appear in project Markdown, and Website/YouTube are included in structured metadata.

## Media and image widths

Each media download has a 30-minute timeout per attempt and is limited to 512 MiB, enforced against both the declared content length and the bytes received. Transient download failures retry up to three attempts.

External MP4, WebM, and MOV videos on the exact owned origins in `scripts/media/remote-video.ts` (currently `https://assets.cultural-alignment.com`) retain their original public URLs. URLs with credentials, query strings, or fragments do not qualify. Inspection uses bounded HTTP range requests (1 MiB per request, 32 MiB total, 60-second deadline) to obtain display dimensions and a first-frame poster; only the poster is uploaded. These originals are explicitly marked `remote` in the snapshot and have no fabricated object key or content hash. The origin must return a video MIME type, content length, and valid byte ranges without redirects. Inspection failures follow the normal media failure path, without falling back to a full download. Sync reports hotlinked count and inspection bytes separately from downloads. Dry runs skip inspection; subsequent imports reuse metadata until the source changes or `--force` is used. Use `--force` to migrate videos in previously cached pages. Add other owned public origins explicitly; arbitrary R2 domains are not trusted. `content:videos` skips remote originals.

Media is immutable under `personal-site/media/<hash>.<extension>` in the shared R2 bucket. Reuse depends on stable source identity, edit marker, and media pipeline version. Original bytes are preserved; still raster images receive non-upscaled WebP variants. GIFs (including single-frame GIFs), other animated images, SVGs, video, audio, and files keep their original formats. Image placeholders are at most 8px on either side. Videos also store display dimensions (including rotation and pixel aspect ratio) on the original asset and a separate first-frame WebP `poster` asset, capped at 1280px on either side. The renderer uses these dimensions to reserve space before metadata loads and displays the poster before playback. MIME type remains on the original asset; videos are never transcoded. Failed video inspection follows the existing media fallback/error path. Native audio players are centered with their captions, fill available space on narrow screens, and cap at 500px wide.

Files larger than 16 MiB upload to R2 in sequential 8 MiB parts using the [S3 multipart API](https://developers.cloudflare.com/r2/api/s3/api/). Each part has independent SDK retries and the existing two-minute storage request timeout. Upload IDs and completed part ETags are saved atomically under `work/media-uploads/`, scoped to the endpoint, bucket, object key, and part size. A later sync skips completed parts; expired upload IDs restart automatically. Keep this directory to resume interrupted transfers and run only one sync at a time. Completed uploads remove their checkpoints. Incomplete remote uploads remain resumable until the bucket lifecycle aborts them (R2 defaults to seven days); deleting local checkpoints does not abort remote uploads. Downloads still restart from the source and buffer the full file before hashing and processing. Small files retain conditional single-request uploads; multipart objects use the same immutable content-hashed keys.

`work/media-cache.json` resumes completed uploads and placeholder work after interrupted or unpublished runs. It is disposable local state; the committed snapshot is authoritative. Bump `MEDIA_PIPELINE_VERSION` in `scripts/media/process.ts` when changing generated media semantics, then use `--force` to apply the change to unchanged entries; the page cache otherwise bypasses media processing.

The official Notion API omits image layout. `scripts/notion/image-widths.ts` narrowly supplements it with unauthenticated `notion-client` requests to `app.notion.com/api/v3/syncRecordValues`, in batches of 100 already-selected image IDs. This API is used only for image layout, not page discovery or media bytes; these blocks must also be publicly readable in Notion.

Layout refresh runs for cached entries and in fast/dry-run modes. `format.block_width` is a pixel display width; page/full-width flags clear it. Saved widths survive unavailable or invalid records. Such failures warn and make sync exit `1`; a later normal sync can repair them without `--force`. Display width is independent of source image dimensions and lightbox sizing.

## Failures and recovery

| Failure | Outcome and next step |
| --- | --- |
| Source authorization/discovery, route collision, or whole-snapshot validation | Stops publication. Fix the source or contract issue before retrying. |
| One page cannot be imported, including an unsupported block | Keeps its previous version, or leaves a new entry inactive; successful entries can still publish. Add support or repair the source, then retry. |
| Media, bookmark, tweet, storage-probe, layout, or placeholder failure | Keeps available saved data or a fallback, writes the valid snapshot, then exits `1`. Inspect warnings and the diff before retrying. |
| Snapshot/search write failure | Stops at that write. Inspect both files; search failure can occur after the snapshot was published. `pnpm content:search` repairs the derived index. |

Informational warnings, such as a retained proposed slug or cross-collection slug match, do not change the exit code. R2 uploads can precede a later failure; their immutable objects do not affect the published site until a deployed snapshot references them.

## Review and extend

After a sync, inspect `git diff` for paths, removals, fallback content, and image changes, including when the command exits `1`. Run the checks in [verification.md](verification.md), inspect representative changed pages, and commit the snapshot and search index together. Restart an existing dev server after syncing because the content loader reads the snapshot at module initialization.

When adding a property or block type, follow the path from `scripts/notion/source.ts` and `scripts/notion/normalize.ts` through `lib/content/schema.ts`, reference validation, and the shared HTML/Markdown renderers. Add focused tests for the new behavior and its failure case. Use a forced dry run to verify traversal, then a real sync to verify asset processing and the generated diff. Keep Notion and storage clients in `scripts/`; [architecture.md](architecture.md) maps the runtime consumers.
