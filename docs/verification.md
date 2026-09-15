# Initial implementation verification

Verified 2026-09-15. The implementation and generated snapshot are ready for review.

## Imported content

- Official Notion API `2026-03-11`; token workspace and source ancestry verified.
- 35 public top-level articles; all canonical paths match the migration baseline.
- Four unpublished rows, About, child pages, and nested database row bodies excluded.
- Five embedded comparison databases rendered as property tables.
- 213 media references, resolving to 549 unique immutable public asset files.
- 174 body image blocks, including 27 GIFs retained unchanged.
- 24 tweet records: 21 available and three confirmed unavailable with original-post links.
- Snapshot SHA-256: `8c575a8b7804889bfcf8846b5e65ba442a9fdcaf1b60a983a91b13279c49199f`.

The broken Saasify callout icon was repaired in Notion using the identical original logo from its archived source repository. The user removed the 22 MB gallery GIF; its block is absent from the snapshot.

## Checks and evidence

| Check | Result |
| --- | --- |
| Strict frozen-lockfile dependency installation | Passed |
| `pnpm fix:format`, `pnpm fix:lint`, `pnpm test` | Passed; 35 tests across eight files |
| Production build with Notion/S3 environment variables removed and local env file temporarily absent | Passed; all 35 articles prerendered |
| Repeat normal sync | Identical snapshot bytes; 35 unchanged articles; zero downloads, conversions, or uploads |
| `--dry-run --force` | Zero downloads/uploads; snapshot and media-cache bytes and modification times unchanged |
| Public asset HEAD audit | All 549 files returned matching size, MIME, and immutable cache headers |
| Production canonical route and metadata audit | All 35 returned 200 with canonical URL, article Open Graph, and matching BlogPosting JSON-LD |
| Compact, hyphenated, and title-plus-ID route forms | All 105 returned direct 308 redirects to canonical paths |
| Root alias | Direct 308 redirect to homepage |
| About, feed, removed child routes, arbitrary slug, and unknown page ID | 404 |
| Discovery endpoints | Sitemap contains 36 canonical URLs; llms includes all 35 articles |
| Internal article/block links | All 12 resolve, including legacy ID links |
| Tweet server output | Rendered tweet markup on seven article pages; no Twitter iframe renderer |
| Snapshot integrity | No expiring Notion signed media URLs; removed gallery GIF absent |
| Local cleanup | Env restored; sync lock released; temporary clipboard test page removed |

The public asset host rejects Python's default User-Agent with HTTP 403. Browser requests and HEAD checks using a browser User-Agent succeed. No hosting or security settings were changed.

The focused tests cover publication/pathname lifecycle, pagination and required-source failures, atomic snapshot publication after partial uploads, immutable media storage and conditional-write races, GIF/video preservation, media reuse and pipeline invalidation, download/stream retries, resumable media caching, dry-run behavior, heading hierarchy, JSON-LD escaping, and tweet fallback/reuse.

## Browser checks

Checked the production build and the final development preview:

- **Agentic Spectrum:** prose, rich text, hierarchy, desktop sticky TOC and active section changes.
- **JavaScript tools:** all five tables, header wrapping, mobile horizontal scrolling by keyboard, expandable mobile TOC, no horizontal page overflow.
- **ChatGPT Twitter Bot:** saved tweet content, readable mobile embeds, source images and captions.
- **Making Your Code Beautiful:** highlighted code, independently scrolling code blocks, focusable code regions, copy control verified by pasting the 428-character snippet into a temporary local textarea; original GIF animation and caption.
- **Homepage:** 35 article links, desktop and narrow mobile layout.

Responsive checks used 390px and 320px viewport overrides; overrides were reset afterward. Representative browser console checks showed no application errors or warnings.

## Expected external fallbacks

These tweets were confirmed unavailable by the provider and retain original-post links:

- [1600079396215349249](https://twitter.com/i/status/1600079396215349249)
- [1600405537287417857](https://twitter.com/i/status/1600405537287417857)
- [1602073979543760897](https://twitter.com/i/status/1602073979543760897)

The 104-entry legacy Redis inventory yielded no additional noncanonical aliases for the selected articles. Known ID URL forms and the explicit root mapping are preserved.

## Operating the site

See [content-sync.md](content-sync.md) for environment setup, source ownership, sync flags, failure recovery, and snapshot review. Use `pnpm dev` for local work. Branding and deployment remain separate passes.

## Article enhancements — 2026-09-15

Added cached bookmark cards, image lightboxes, and end-of-article TOC selection.

- Synced 245 unique bookmark URLs: 221 cached images, 24 text-only fallbacks for unavailable pages or unusable/missing social images. All 35 article bodies remained unchanged.
- Verified all 477 unique bookmark image files/variants publicly return their expected sizes and MIME types.
- Repeated bookmark sync and forced dry-run both reused all 245 previews, with zero remote fetches or image uploads and identical serialized preview data.
- Formatting, lint, type checking, and all 43 tests pass. New tests cover metadata parsing, relative social-image URLs, deduplication, cache reuse, force/dry-run fallbacks, public network destinations, and final-heading selection across viewport sizes.
- Production build succeeds with Notion and S3 credentials absent; bookmark sites are not contacted while building or serving pages.
- Browser checks cover desktop/mobile bookmark cards; lightbox opening, Escape/backdrop dismissal, original-image links, focus return/trapping, stable image dimensions and unchanged GIFs; and the final TOC item at article bottom at 720px and 1000px desktop heights, followed by correct selection when scrolling upward.
- Added Next.js's documented scroll-behavior attribute so route transitions can reset scrolling without a long smooth scroll.

The preceding migration hash and counts describe the initial snapshot. Current enhanced snapshot SHA-256: `9cc859a373ae0c07e70a6307d1c2ec91cb3cbf3e58b81d99e6cbf732ce38f417`.

## Next.js image checkpoint — 2026-09-15

- Switched cached article images, covers, icons, bookmarks, and lightboxes to `next/image`, with a strict remote pattern for the shared bucket's `personal-site/media/` path.
- Backfilled all 434 image descriptors with Sharp-generated previews (8px maximum dimension; 279 characters maximum per data URL). Repeating the backfill performed zero fetches. Original assets and variants were unchanged.
- Checked generated HTML across all 35 articles: 436 image instances carry inline blur placeholders, and all 35 covers have eager loading and high fetch priority.
- Browser checks confirmed optimized image URLs load successfully, pending lazy images retain blur placeholders, and cover/lightbox placeholders clear after loading. GIFs bypass optimization and retain original animation.
- Formatting, lint, types, and all 46 tests pass. Production build passes without CMS/storage credentials; all 35 articles prerender successfully.
- Snapshot SHA-256: `d37bcb423ed71964034ba5216fae6076235a7e6d5f790ed868ee47b0adeed90d`.

## Takumi article social images — 2026-09-15

- Added on-demand 1200 × 630 WebP cards based on the starter kit's cover-background and centered title-panel design, with description, author, date, and site identity.
- Verified generated metadata across all 35 built article pages: Open Graph, Twitter, and JSON-LD share the canonical versioned image URL; OG dimensions are 1200 × 630.
- All 51 tests pass, including actual Takumi renders with a cover, missing-cover fallback, allowed image paths, and metadata-based URL invalidation. Formatting, lint, and types pass.
- Production build passes without CMS/storage credentials. The built server returned valid WebPs for sample articles and a Notion ID alias, with expected cache headers; an unknown article returned 404.
- Visually checked representative cards including both longest current titles. Description truncation uses an ellipsis. Previews are saved under ignored `work/`; the durable template is `components/social-image.tsx`.

- Final card revision removes the domain footer and explicitly centers the title with `text-wrap: balance`; template version 2 refreshes the advertised image URL.

- Corrected Takumi 2.13 balanced-text positioning by measuring the narrowest box that preserves line count, then centering it. Pixel-based checks cover short and long titles. The cover uses a 6px blur, and Takumi emits WebP at quality 90.

## Deployment-aware social image URLs — 2026-09-15

- Social image URLs now use Vercel's built-in `VERCEL_URL`, prefixed with HTTPS, with `site.origin` as the non-Vercel fallback.
- All 54 tests pass, covering preview/production deployment URLs and the fallback. A production build with simulated preview environment variables succeeds without CMS/storage credentials.
- Inspected the generated HTML for all 35 articles: OG, Twitter, and JSON-LD images use the preview hostname, while canonical article URLs retain the production origin.
