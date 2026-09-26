# Architecture

## Intent and scope

Travis Fischer's portfolio presents projects and long-form writing with readable bodies, durable media, and stable public links. Notion is the authoring tool; this application owns presentation, navigation, and delivery. The homepage highlights featured projects and writing, with complete indexes at `/projects` and `/writing`.

The migration replaced request-time CMS rendering with an explicit import and a committed snapshot. This makes publication reviewable in Git and keeps page rendering independent of Notion availability and credentials. The normalized block model supports the site's content rather than reproducing Notion's editor or database UI. Child pages are excluded; embedded databases become property tables without row-page navigation.

## Content flow and ownership

```text
Notion public collections → scripts/sync.ts → content/snapshot.json
                                ├─ media → immutable public R2 objects
                                └─ public/search-index.json
snapshot → lib/content/load.ts → HTML, Markdown, metadata, discovery
search-index.json → lazy client search
```

- **Authoring:** edit article/project content in Notion, then [sync explicitly](content-sync.md). The source contracts and site identity live in `lib/site.ts`; configuration and versions live in `package.json` and `.env.example`.
- **Publication:** commit `content/snapshot.json` and `public/search-index.json` together. Sync writes artifacts and can upload media; deployment is a separate step. The single snapshot keeps content, routes, and references together, while the search index is derived and can be rebuilt locally.
- **Runtime:** `lib/content/load.ts` is server-only. It validates the snapshot and references, resolves internal Notion links, and exports sorted collections. Builds and requests require no Notion or S3 credentials. Content is read at module load; restart dev after a sync.
- **Network boundary:** Notion/storage clients and sync orchestration stay in `scripts/`. Runtime public fetches are intentional: image optimization, media downloads, social-card covers, and external hover previews. The preview API reuses credential-free `scripts/bookmarks.ts` and `scripts/public-fetch.ts`; preserve their destination, redirect, timeout, and size checks.
- **Presentation:** article and project pages share `components/article/content-body.tsx` and the block renderer. Keep content rendering on the server and client behavior scoped to search, theme, previews, lightboxes, navigation, and scroll tracking. Global styling and motion rules live in `app/globals.css`.

## Domain objects

The executable contract is `lib/content/schema.ts`; these distinctions explain how to use it.

| Object | Meaning and important distinction |
| --- | --- |
| Article | A public writing entry keyed by stable Notion page ID, rendered at `/<slug>`. Has one author string and a publication date. |
| Project | A public portfolio entry at `/projects/<slug>`, sharing article bodies/media. Has people-based authors, an optional publication date, and optional Website, Source, and Tweet actions. Source may be a repository or a creation conversation. |
| Public / Featured | Public controls inclusion in the snapshot; Featured controls homepage selection. Featured is not a publication state. |
| Block / RichText | Application-owned content tree and text annotations. Stable block IDs support anchors, TOC entries, and rewritten Notion links. Image block `width` is an optional display width in pixels, separate from asset dimensions. |
| RouteRecord | Stable slug assignment, old aliases, and active status, stored separately from content. Inactive records reserve paths; they do not publish pages. Articles and projects have separate registries. |
| Media / Asset | A media descriptor tracks a source identity, pipeline version, original asset, variants, and optional blur preview. An asset is an immutable, content-hashed R2 object. Entries/blocks refer to descriptors by key. |
| Bookmark / Tweet | Saved preview metadata or provider payload/fallback from sync. These render deterministically; external hover previews are a separate live feature. |
| Snapshot / search index | The snapshot is the authoritative generated content artifact. Search is derived public data for the browser, not another CMS or source of truth. |

Projects and articles sort by publication date descending, then slug; undated projects sort last. Older article-only snapshots remain supported through optional project fields.

## Where to change things

| Task | Start here; related surfaces to account for |
| --- | --- |
| Change import/publication behavior | `scripts/sync.ts`, `scripts/notion/import-pages.ts`, `scripts/notion/source.ts`; [sync guide](content-sync.md), publication/import tests. |
| Add a content block or property | `lib/content/schema.ts`, `scripts/notion/normalize.ts`, `components/article/blocks.tsx`; also Markdown, search extraction, references, and headings in `lib/content/` where applicable. |
| Change page layout | `app/`, `components/article/`, `components/project.tsx`, index components, and `app/globals.css`; shared content changes affect both articles and projects. |
| Change images or motion | `scripts/media/`, `components/article/media.tsx`, `components/article/project-cover-image.tsx`, `components/project-transition.tsx`; [project image decisions](project-image-loading.md). |
| Add an application page or change URLs | `lib/content/routes.ts` owns reserved slugs and route resolution. Account for metadata, sitemap, llms, Markdown, search, navigation, and internal previews; [metadata guide](metadata.md). |
| Change search | `lib/content/search-index.ts` builds documents, `lib/search.ts` ranks them, `components/site-search.tsx` lazily opens `search-palette.tsx`. Regenerate with `pnpm content:search`. |
| Change hover previews | `components/link-preview-provider.tsx`, `lib/content/link-previews.ts`, `lib/link-preview.ts`, and `app/api/link-preview/`; internal previews come from the snapshot, external previews are fetched on demand. |

## Decisions and watch-outs

- **Stable URLs:** title edits must not silently move published paths. The route registry retains aliases and inactive assignments; use the explicit sync flags to accept path changes or prune missing content. Public=false removes access on a successful sync. Recognized aliases redirect directly; unknown or inactive routes return 404.
- **Deterministic artifacts:** preserve source block order and stable IDs. Sync uses stable serialization and atomic file replacement; incidental wall-clock sync timestamps, signed Notion media URLs, and secrets do not belong in generated content. Recoverable failures can write fallback data and still exit nonzero; inspect the diff and diagnostics.
- **Narrow unofficial API use:** the official Notion API supplies content and publication state. `notion-client` exists only to recover missing image layout for already-selected public blocks. Keep that exception scoped to `scripts/notion/image-widths.ts`.
- **Saved originals:** still images get variants and blur previews; GIFs, SVGs, video, audio, and attachments retain original bytes. Next Image additionally chooses responsive delivery sizes. Downloads are restricted to originals in the snapshot.
- **Lazy search:** the dialog and index load on first open; queries remain in the browser. Keep the full snapshot server-side. The adapted cmdk styling retains attribution in [licenses/cmdk.txt](licenses/cmdk.txt).

For development and validation, use [Verification](verification.md). For the migration rationale, production incidents, rejected experiments, and accepted design review, consult the [historical index](archive/README.md) only when relevant; those records are not a current backlog.
