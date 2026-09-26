# Routes, discovery, and social metadata

## Canonical pages and alternate representations

`lib/site.ts` owns `site.origin` (`https://www.transitivebullsh.it`). Canonical HTML URLs, structured-data page URLs, and sitemap entries use that origin even on previews. Internal content links recognize both historical hostnames.

`lib/content/routes.ts` owns slug validation, reserved application paths, aliases, and Notion ID resolution. The article and project pages use separate registries; `dynamicParams = true` allows known aliases outside generated canonical params. Keep unknown/inactive routes as 404s and recognized aliases as direct permanent redirects. `/transitivebullshit` remains a homepage redirect.

HTML and Markdown are separate static representations. `next.config.ts` rewrites `.md` URLs to `app/markdown/[...path]/route.ts`; examples are `/index.md`, `/writing.md`, `/projects.md`, `/agentic-spectrum.md`, and `/projects/passage.md`. Markdown uses the same snapshot, returns `text/markdown` and canonical Link headers, redirects aliases, and returns useful 404s. Separate URLs avoid Accept negotiation and shared-cache representation ambiguity.

When adding a page, account for all applicable discovery surfaces:

- `lib/metadata.ts`: canonical and Markdown alternates, plus explicit per-page Open Graph/Twitter fields. Next metadata inheritance is shallow.
- `lib/content/metadata.ts`: site/person, WebPage, CollectionPage/ItemList, BlogPosting, or CreativeWork builders. `components/json-ld.tsx` safely serializes/renders their output. Projects use CreativeWork because they include more than software; omit missing authors/dates rather than inventing them.
- `app/sitemap.ts`, `app/robots.ts`, and `app/llms.txt/route.ts`: advertise canonical public pages and Markdown links.
- `lib/content/markdown.ts`, `lib/content/markdown-path.ts`, and the Markdown route: content and index representations.
- `lib/content/search-index.ts`, navigation, and `lib/content/link-previews.ts`: search and browsing entry points where applicable.

## Social images

- Main pages use `public/social-image.jpg`; icons use Next's metadata file conventions in `app/`.
- Articles use on-demand Takumi WebP cards through `app/api/social-image/[slug]/route.tsx`, `lib/render-social-image.tsx`, and `components/social-image.tsx`. Bump `templateVersion` in `lib/social-image.ts` when the template changes so crawlers receive a new versioned URL.
- Projects use their saved cover or the default social image; both use `summary_large_image`. They do not use the article card renderer.
- `deploymentOrigin()` selects the public production hostname or preview branch alias, with the unique Vercel URL and then `site.origin` as fallbacks. This is separate from canonical page origin: a unique deployment URL previously sent social crawlers to a Vercel login page.
- Historical `/api/social-image?id=…` URLs permanently redirect recognized active article IDs to current cards; unknown IDs return 404.

## Deployment lessons

Takumi needs a native platform binding. Keep its wrapper/core externalized in `next.config.ts`, core installed directly, and the post-build check in `scripts/verify-social-image-bundle.ts`. A past deployment failed because local rendering found a native binary on the build machine that was absent from the deployed trace. `pnpm build` checks the artifact, not just whether compilation succeeds.

Card covers are fetched only from the allowed immutable R2 path, with timeout/size limits and a text-only fallback on failure. The title-width measurement in `lib/render-social-image.tsx` compensates for observed Takumi balanced-text centering; visually verify short and long titles before replacing it or upgrading that rendering path.

Use [Verification](verification.md) for current checks. The [original metadata audit](archive/metadata-verification-2026-09-16.md) and [social-image incident record](archive/implementation-verification.md#live-vercel-social-image-repair--2026-09-15) retain historical evidence.
