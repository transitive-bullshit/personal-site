# Personal site implementation plan

Status: implemented and verified on 2026-09-15. See [verification.md](verification.md) for the completed checks and [content-sync.md](content-sync.md) for current operating guidance.

## 1. Outcome and scope

Build a simple Next.js personal site whose article content is imported explicitly from the official Notion API into a committed, validated snapshot. Serve and build from that snapshot. Use R2 for durable media. Focus this pass on polished article bodies, reliable syncing, and preservation of the selected articles' existing URLs.

### Settled decisions

- Import only `Public=true` pages from the top-level Blog Posts collection: currently 35 articles. Query unpublished rows as needed to detect deliberate unpublishing.
- Keep the homepage in application code, with a simple header, footer, and text links to articles. Sort by publication date descending with a stable tie-breaker.
- Exclude About, standalone child pages, nested database row-page bodies, and their routes.
- Render the five embedded comparison databases in the JavaScript tools article as lightweight inline tables of properties. Preserve their data without a database UI or row-page navigation.
- Preserve content structure while improving typography, spacing, media, code, and article navigation. Site branding and broader visual theming are a second pass.
- Use `react-tweet` for server-rendered tweets. Intentional third-party embeds are allowed and receive useful fallback links.
- Preserve original media. Optimize still images only; keep GIFs, videos, and audio unchanged.
- Use the existing `cultural-alignment` R2 bucket, `https://assets.cultural-alignment.com`, and the same credentials for development and production. Use a `personal-site/` key prefix.
- Warn and preserve existing routes when inferred or explicit source slugs change; require a CLI flag to accept pathname changes. Retain old accepted paths as redirects.
- Warn and retain missing articles until `--prune`.
- A successfully observed `Public=false` immediately removes the article and its aliases from the next successful snapshot.
- A failed article keeps its prior version. New failed articles stay inactive.
- Include `sitemap.xml`, `llms.txt`, canonical metadata, article Open Graph metadata, and JSON-LD. Omit `/feed` and special `?lite=true` rendering.
- Future Spotify activity, recent projects, social activity feeds, app-authored sections, and deployment are outside this implementation pass.

The source edits made during alignment are verified: the ChatGPT article no longer contains its three child-page references, and the NPM article no longer contains the dangling synced block. No migration-specific skip rule is necessary.

## 2. Verified sources and reference implementations

### Notion source contract

| Item                   | Value                              |
| ---------------------- | ---------------------------------- |
| Root page              | `78fc5a4b88d74b0e824e29407e9f1ec1` |
| Supplied workspace ID  | `fde5ac74eea345278f004482710e1af3` |
| Blog Posts database    | `f917892e0b8c4dbeb1743620de57a0ec` |
| Blog Posts data source | `bb51e17f99ae4f0797a84c9af77a85ec` |
| Canonical site origin  | `https://transitivebullsh.it`      |

Official API access through `NOTION_TOKEN` is verified. Discovery found 39 rows: 35 public and four unpublished. Six public articles have an explicit Slug; 29 use the legacy title normalization. All 35 currently have a Published date, description, and cover.

Validate these properties and types: `Name` title; `Public` and `Featured` checkboxes; `Slug`, `Description`, `Author`, and `Tweet` rich text; `Published` date; `Last Updated` timestamp; `Tags` multi-select. Resolve and retain property IDs after discovery rather than assuming display names are permanently stable.

The root response exposes `parent.workspace=true`. The implementation separately verifies the supplied workspace ID through the official `users/me` response’s `bot.workspace_id`, then verifies source ancestry and exact database/data-source IDs.

### Local references to read before implementing

| Reference | What to reuse |
| --- | --- |
| `/Users/tfischer/dev/modules/cultural-alignment/scripts/sync.ts` | Explicit sync orchestration, source validation, pagination, error collection |
| `/Users/tfischer/dev/modules/cultural-alignment/scripts/media-reuse.ts` | Page/block edit markers, source identity, pipeline-version reuse |
| `/Users/tfischer/dev/modules/cultural-alignment/scripts/media-storage.ts` | Authenticated HEAD, conditional PUT, immutable objects, descriptor concurrency |
| `/Users/tfischer/dev/modules/cultural-alignment/scripts/sync-utils.ts` | Hashing, normalization, rich-text handling |
| `/Users/tfischer/dev/modules/cultural-alignment/lib/content/schema.ts` | Versioned Zod schema approach |
| `/Users/tfischer/dev/modules/nextjs-notion-starter-kit/lib/get-canonical-page-id.ts` | Legacy slug precedence |
| `/Users/tfischer/dev/modules/nextjs-notion-starter-kit/lib/map-page-url.ts` | Canonical paths and root mapping |
| `/Users/tfischer/dev/modules/nextjs-notion-starter-kit/lib/resolve-notion-page.ts` | Historical aliases and ID URL compatibility |
| `/Users/tfischer/dev/modules/nextjs-notion-starter-kit/site.config.ts` | Identity, origin, explicit historical alias |

The cultural-alignment importer selects structured properties and selected images. Its media and storage behavior is the reference; recursive full-body normalization and rendering are new work here. Adapt the useful modules locally, without introducing a cross-repository runtime dependency.

The current scaffold uses App Router-oriented configuration and installed Next 16.3.5. Read the installed guides in `node_modules/next/dist/docs/` before implementation, especially dynamic routes, generateStaticParams, metadata, sitemap, JSON-LD, server/client components, and images. Keep the repository's pnpm, TypeScript, formatting, linting, and CI conventions.

The importer pins `2026-03-11`, verified against this source. Its page schema uses `in_trash`; `archived` is optional because this API version omits it.

## 3. Architecture and files

Use a small, application-owned normalized block model. Avoid persisting raw unofficial record maps or adopting React Notion X, notion-client, notion-utils, or notion-types as implementation dependencies.

Suggested organization; combine small helpers where it improves clarity:

```text
app/
  layout.tsx
  globals.css
  page.tsx
  [slug]/page.tsx
  sitemap.ts
  llms.txt/route.ts
components/
  article/article.tsx
  article/blocks.tsx
  article/rich-text.tsx
  article/media.tsx
  article/code-block.tsx
  article/tweet.tsx
  article/table-of-contents.tsx
lib/
  site.ts
  content/schema.ts
  content/load.ts
  content/routes.ts
  content/headings.ts
scripts/
  sync.ts
  notion/source.ts
  notion/normalize.ts
  media/reuse.ts
  media/storage.ts
  media/process.ts
content/
  snapshot.json
  README.md
docs/
  implementation-plan.md
  content-sync.md
```

The exact file split is an implementation choice. Keep Notion and storage clients in script-only modules. The application loader reads and validates the committed snapshot without importing credentials, SDK clients, or sync code.

### Snapshot and schemas

Start with a single authoritative `content/snapshot.json`. With this corpus size, one file keeps route publication and content replacement atomic and avoids coordinating several runtime files.

Include:

- Snapshot schema version, importer/pipeline versions, and source contract.
- Published article records keyed by stable Notion page ID.
- Article title, description, canonical pathname, aliases, publication/modification dates, author, tags, optional cover/icon, and normalized blocks.
- Ordered block trees with stable IDs, semantic rich-text annotations, links, captions, and explicit supported variants.
- Media references with immutable public URLs, MIME types, dimensions, original/variant relationships, and the source identities required for reuse.
- Inline table columns and property rows, preserving a deterministic configured display order.
- Tweet data or a recorded fallback, keyed by tweet ID, if fetched during sync.
- Durable pathname assignments/tombstones as needed to prevent accidental reassignment after removal. Only active articles participate in public route resolution.

Zod validates consumed official API response fields, the normalized block union, and the entire final snapshot. Permit irrelevant additive upstream fields; fail when a field needed to preserve content changes shape or an encountered block has no supported handling.

Canonicalize map ordering, whitespace, newline endings, and arrays whose order is not semantic. Keep Notion's order for blocks and lists. Do not persist expiring signed URLs, secrets, a fresh wall-clock sync timestamp, or other incidental values that dirty an unchanged snapshot.

## 4. Sync command and lifecycle

The current command contract is in [content-sync.md](content-sync.md).

- Reuse articles when `last_edited_time <= modified`; `--force` bypasses this.
- Import articles with `p-map` concurrency `8`.
- `--fast` skips images and defers their work to the next normal sync.
- `--prune` removes missing pages.
- `--accept-slug-changes` changes paths and keeps redirects.
- Recoverable failures write a valid fallback snapshot and exit `1`.
- Hard validation failures keep the prior snapshot.
- Sync writes Git changes; it does not deploy.

## 5. R2 and media

### Configuration

Use `NOTION_TOKEN` and the existing values for `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_API_ENDPOINT`, `S3_BUCKET_NAME`, and `S3_PUBLIC_URL`. Region defaults to `auto`. The user has authorized reusing the cultural-alignment credentials.

During implementation, copy only the required settings to an ignored local env file or load them through an explicit local setup step. Document names and example nonsecret values in `.env.example`; do not make the sibling repository's filesystem location a production dependency. Verify these settings can access the existing bucket before the first media import.

### Immutable media pipeline

1. Identify media by stable block/property ID, source type, edit marker, and pipeline version. Never use Notion's temporary signed URL as the durable identity.
2. When identity and pipeline match, reuse the previous media descriptor without downloading or processing the asset.
3. Otherwise download to temporary storage with response/MIME validation, timeouts, and bounded sizes. Refresh an expired Notion URL through the official API if needed.
4. Hash and retain original bytes. Inspect image dimensions and animation status.
5. For still raster images, generate responsive WebP variants, initially following the reference's 960px/1920px targets and quality settings without upscaling. Tune only where representative content needs it.
6. Keep GIFs and other animated media unchanged, including a single-frame GIF file. Keep SVGs, videos, audio, and attachments unchanged; no GIF/video conversion or transcoding.
7. Hash each output's actual bytes into `personal-site/media/<sha256>.<extension>`. Use authenticated HEAD before conditional PUT, and correct Content-Type plus long-lived immutable cache headers.
8. Treat a true 404 as missing. Authorization, timeout, or service errors fail the required media import. A concurrent conditional-write conflict can reuse the existing matching object.
9. Store public URLs, dimensions, MIME, hashes, and source reuse markers in the snapshot.

Reuse cultural-alignment's descriptor pattern if separate remote state materially helps, under `personal-site/state/`, with conditional ETag writes. Prefer snapshot-contained reuse metadata initially to keep state small and publication coherent. The bucket is public: state must contain no credentials or expiring signed URLs; cache-control is not an access boundary.

Serve the generated variants with responsive image markup and explicit dimensions. Avoid a second optimization pipeline for GIFs/video or preprocessed variants. Covers and Notion-hosted image icons use the same durable pipeline as body images.

## 6. URL compatibility and ownership

Implement the legacy algorithm locally with regression fixtures:

1. Use a nonempty `slug` or `Slug` property verbatim.
2. Otherwise apply the exact legacy title normalization: spaces to hyphens, the existing character whitelist, its existing hyphen cleanup, trim, and lowercase.
3. Fall back to the compact Notion page ID if the normalized title is empty.
4. Preserve an existing registry assignment regardless of a newly inferred value unless explicitly accepted.

Validate that the result is a legal single top-level path segment. An invalid explicit slug fails with a useful message instead of being silently rewritten. Detect collisions across canonical paths, aliases, and application-owned routes; never let one article win by iteration order.

Preserve the 35 verified canonical paths in the appendix. Preserve `/the-social-audio-revolution`, including the explicit legacy mapping to `c4deaf33cc924ad7a5b9f69c6ae04a01`. Keep `/transitivebullshit` as a homepage redirect.

For selected articles, resolve known raw compact/hyphenated page IDs and title-plus-ID forms to the canonical path. Allow only IDs in the published registry. Legacy Redis contains potential historical slug mappings: attempt a read-only, production-site-scoped inventory during migration using the existing legacy configuration. Preserve recovered aliases only for selected articles; report any recovery/access gap.

All aliases resolve directly to one canonical target with a permanent redirect; avoid redirect chains. Unpublishing removes every public alias for that article. About and the three removed child pages remain excluded even if discovered through old aliases.

Use an explicit application-owned reserved-name list for real system routes such as sitemap and llms, and a snapshot-derived set of article paths. Keep names available for future app-authored sections through deliberate reservation and collision checks rather than inventing sections in this pass.

## 7. Article rendering

Implement supported blocks from the selected corpus, then fail imports for unknown required types. Do not build a general Notion editor or reproduce database tooling.

| Content | Expected behavior |
| --- | --- |
| Rich text | Bold, italic, underline, strike, inline code, color where meaningful, safe links, and supported mentions |
| Paragraphs/headings | Readable measure, consistent spacing, stable block anchors, heading links |
| Lists/to-dos | Correct nesting, ordered numbering, multiline items, accessible checked states |
| Quotes/callouts/dividers | Semantic structure, visible hierarchy, emoji/image icons where present |
| Columns | Preserve document order; collapse naturally on narrow screens |
| Code | Server-side highlighting, language label, preserved whitespace, horizontal overflow, accessible copy control |
| Images/GIFs | Captions, alt text from source where available, durable URLs, dimensions, responsive still variants, unchanged animation |
| Video | Existing YouTube embeds with useful links; native controls for direct-file videos encountered later |
| Bookmarks | Lightweight linked cards/text; preserve useful source information without fetching every destination on page load |
| Tables/databases | Semantic tables, deliberate columns/order, readable mobile overflow, no row-page navigation or interactive database framework |
| Other embeds | Intentional CodeSandbox/other supported embeds with titles, suitable sizing, lazy loading, and fallback links |
| Toggles/equations/synced blocks | Support if present in the fresh selected inventory; valid synced content must resolve, and unavailable required content fails |

Recompute the selected-corpus inventory after source edits. Earlier totals included About and excluded children and must not be used as expected final counts. Known article features include headings, nested lists, columns, callouts, code, bookmarks, GIFs, YouTube, tweets, CodeSandbox, and five comparison tables.

Keep the bulk of rendering in Server Components. Isolate client behavior to controls and scroll tracking; avoid sending the entire snapshot to the browser.

### Table of contents

Derive a single heading model from normalized blocks, preserving order and handling skipped heading levels and duplicate text. Use stable block-ID anchors and rewrite Notion block fragments to those anchors so existing deep links continue to work.

Render an updating desktop side table of contents with a small IntersectionObserver client component. Provide an accessible collapsible equivalent on mobile, useful anchor offsets, visible focus, and reduced-motion behavior. An authored Notion TOC block should reuse this model without adding redundant navigation.

### Tweets

Use `react-tweet` and its supplied components. Its [documentation](https://react-tweet.vercel.app/) supports static/server rendering; its [API reference](https://react-tweet.vercel.app/api-reference) distinguishes retrieved data, missing tweets, and tombstones.

Fetch unique tweet data during explicit sync and pass stored data to `EmbeddedTweet` for deterministic server rendering. Avoid browser-side tweet fetching or Twitter iframe widgets. Bound and deduplicate tweet requests. Reuse stored data on transient fetch failures; replace confirmed unavailable/private tweets with original-post links. Support deliberate refresh through the force path.

Where tweet media is imported, use the same unchanged-original/image pipeline; external embed-owned media may remain third-party URLs under the agreed embed exception. Tweet retrieval or optional media failure must produce a useful server-rendered fallback instead of failing unrelated Notion content.

## 8. Next.js pages and metadata

- Implement the shell and homepage from the committed snapshot.
- Use `app/[slug]/page.tsx`, snapshot-driven `generateStaticParams`, and the installed Next version's async params convention.
- Ensure canonical pages are prerendered. Resolve recognized aliases from the local registry; unknown routes return 404. Verify dynamic parameter configuration allows intended ID aliases while keeping unknown IDs inaccessible.
- Keep runtime requests and builds independent of Notion, R2 credentials, and tweet API availability. Browser media requests may reach the public asset origin and intentional embed providers.
- Generate title, description, canonical URL, Open Graph article fields, durable cover image, author, and dates from snapshot data.
- Add `BlogPosting` JSON-LD with headline, description, author, publication/modification dates, canonical mainEntityOfPage, and image where available. Serialize safely, including escaping less-than characters.
- Generate `sitemap.xml` for the homepage and active canonical articles only. Use source modification dates, not the build clock.
- Generate a concise `llms.txt` with site identity, article titles, descriptions, and canonical links from the same snapshot.
- Use R2 covers for article sharing images. A generated OG-image design system belongs to later visual work.

## 9. Implementation sequence and completion gates

### Phase 1 — Contracts and source audit

Set up sync-only environment loading, Zod contracts, deterministic serialization, the official API wrapper, and route state. Read current framework/package docs before integrating libraries.

**Done when:** a read-only run validates the selected source and produces the exact expected article/path inventory plus actual required block types, with no unsupported or inaccessible content silently dropped.

### Phase 2 — End-to-end import

Implement normalization, link rewriting, media reuse, tweet fallbacks, lifecycle flags, and atomic snapshot writes.

**Done when:** unchanged syncs are no-ops and recoverable failures still write a valid snapshot.

### Phase 3 — Routes and renderer

Implement the app shell, article list, route lookup/redirects, full selected block rendering, server-rendered tweets, responsive media, code, and active TOC.

**Done when:** every selected canonical path renders the correct article, representative aliases redirect correctly, excluded pages remain absent, and article content is readable at mobile and desktop sizes.

### Phase 4 — Metadata and compatibility

Add Open Graph, JSON-LD, sitemap, llms, block-anchor compatibility, and recovered historical aliases. Check current live paths against the imported registry.

**Done when:** metadata and discovery endpoints enumerate only active canonical content and all verified selected-article legacy URLs resolve correctly.

### Phase 5 — Verification and handoff

Run focused behavioral tests and the repository checks, inspect representative pages in a browser, and write `docs/content-sync.md` plus generated-content ownership guidance.

**Done when:** the acceptance checklist below passes, all unresolved external access gaps are explicitly reported, and the user can run and review an explicit sync without additional service setup.

## 10. Validation and acceptance checklist

Use focused Vitest tests for behavior that could lose content, break URLs, or create unnecessary uploads. Add the unit-test script to the existing `test:*` pipeline so CI actually runs it. Avoid tests that only restate component markup.

- [x] Source pagination includes all rows/blocks; only top-level Public=true pages become articles.
- [x] Public=false removes every public representation on successful sync.
- [x] Missing-page retention, explicit prune, failed discovery, and inaccessible required bodies behave distinctly.
- [x] Title changes preserve paths; accepted changes redirect old paths; collisions and invalid slugs fail.
- [x] Legacy normalization, ID aliases, root alias, internal article links, and block anchors match fixtures.
- [x] Embedded comparison rows render inline with stable columns/order and create no routes.
- [x] Unchanged media skips downloads/conversion/upload; changed bytes produce new immutable objects.
- [x] Still-image conversion preserves originals; GIF/video bytes are unchanged; authenticated HEAD errors are not mistaken for absence.
- [x] Pipeline-version changes and force refresh work; conditional upload races reuse existing objects.
- [x] Recoverable errors write valid fallback data and return exit code `1`.
- [x] No-op sync leaves identical snapshot bytes; dry-run writes neither local content nor R2.
- [x] Snapshot media uses durable R2 URLs, never temporary Notion URLs.
- [x] Tweets appear in server-rendered output; transient/unavailable tweet cases produce the defined fallback.
- [x] TOC ordering, duplicate/skipped headings, nested lists, code escaping, and JSON-LD escaping have focused coverage.
- [x] Build succeeds with Notion and S3 credentials absent and without live content fetching.
- [x] Unknown/excluded routes return 404; sitemap and llms omit them and omit aliases.
- [x] Run `pnpm fix:format`, `pnpm fix:lint`, `pnpm test`, and `pnpm build`; review the resulting diff.
- [x] Browser-check at least a prose article, the JavaScript tools tables, ChatGPT tweets/code, and an article with actual GIF media after the fresh inventory.
- [x] Check mobile widths, keyboard navigation, copy controls, captions, code/table overflow, active TOC, and article metadata.
- [x] Document env setup, commands/flags, source ownership, adding a block renderer, failure recovery, and how to review/commit a sync.

## Appendix: canonical article baseline

These 35 paths were verified against the existing public site during alignment. This is the migration baseline; future publication changes are governed by the sync rules above. Explicit Slug overrides are marked in the final column.

| Article | Path | Explicit Slug |
| --- | --- | --- |
| Agentic Spectrum | `/agentic-spectrum` | Yes |
| An Army of Agents | `/ai-agents` | Yes |
| ChatGPT Twitter Bot: Lessons from over 100k Conversations | `/chatgpt-twitter-bot-lessons` | Yes |
| Kwote | `/kwote` |  |
| Open Sourcing Twitter’s Algorithm Part 1: How Twitter Works | `/oss-twitter-algorithm-part-1` | Yes |
| Internet Diet | `/internet-diet` |  |
| The Best JavaScript Dev Tools in 2022 | `/javascript-dev-tools-in-2022` | Yes |
| A Guide to Finding Awesome Co-Founders | `/a-guide-to-finding-awesome-co-founders` |  |
| Creator Economy 101 | `/creator-economy-101` |  |
| The Social Audio Revolution | `/the-social-audio-revolution` |  |
| Why I'm so Hyped about the Passion Economy | `/why-im-so-hyped-about-the-passion-economy` |  |
| Mapping the Passion Economy | `/mapping-the-passion-economy` |  |
| Saasify Key Takeaways | `/saasify-key-takeaways` |  |
| Next.js Notion Starter Kit | `/nextjs-notion-starter-kit` |  |
| My 10 Year Music Diary | `/my-10-year-music-diary` |  |
| Saasify VC Feedback | `/saasify-vc-feedback` |  |
| Developer + X = Entrepreneur | `/developer-x-entrepreneur` |  |
| Saasify's Approach to OSS | `/saasifys-approach-to-oss` |  |
| Finding Your Passion as a Developer | `/finding-your-passion-as-a-developer` |  |
| Pivoting & Marketing | `/pivoting-marketing` |  |
| Free Resources for Indie SaaS Devs | `/free-resources-for-indie-saas-devs` |  |
| Introducing Saasify | `/introducing-saasify` |  |
| Ionic vs React Native | `/ionic-vs-react-native` |  |
| Deep-Dive into AI Video Creation | `/deep-dive-into-ai-video-creation` |  |
| Gaming CS Interviews | `/gaming-cs-interviews` |  |
| Publishing Baller React Modules | `/publishing-baller-react-modules` |  |
| Making Your Code Beautiful | `/making-your-code-beautiful` |  |
| JavaScript Modules Worth Using | `/javascript-modules-worth-using` | Yes |
| Mastering the Art of NPM | `/mastering-the-art-of-npm` |  |
| Automagical Architecture | `/automagical-architecture` |  |
| My Journey Through Open Source | `/my-journey-through-open-source` |  |
| Building a Polyfill for React Suspense | `/building-a-polyfill-for-react-suspense` |  |
| Building a WebGL Gallery in React | `/building-a-webgl-gallery-in-react` |  |
| Scraping the web with Node.js | `/scraping-the-web-with-nodejs` |  |
| Data Fingerprinting in JavaScript | `/data-fingerprinting-in-javascript` |  |

Excluded unpublished rows: Saasify Status, GitHub Sponsors, Wisdom Bubbles, and Puppet Master. About and all three Top Tweet Interactions child pages are also excluded. The 26 nested comparison rows are table data only.
