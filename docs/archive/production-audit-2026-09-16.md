# Production audit — September 16, 2026

> Historical record. See [the archive index](README.md) for status and current guidance. Counts, validation results, and proposals below describe the original work.

The site is in good shape. Fix the canonical-host mismatch and the homepage’s lazy-loaded LCP image first. Most metadata is already present and working; the remaining issues are small accessibility, content, and observability improvements.

Audit target: https://www.transitivebullsh.it. Production commit `1b44bb7`, deployment `2CuUjfxqcrYh7sUxEtG6CaYJy8Sw`; local installed Next.js 16.3.5. Measurements taken around 11:01–11:10 UTC. This audit changed no application code or production configuration.

## Individual Lighthouse results

Scores are **Performance / Accessibility / Best Practices / SEO**, each out of 100. Click HTML for the full interactive Lighthouse report; JSON preserves all measurements and network evidence.

| Page | Device | Scores | LCP | TBT | CLS | Full report |
| --- | --- | --- | --- | --- | --- | --- |
| [Homepage](https://www.transitivebullsh.it/) | Mobile | 87 / 100 / 100 / 100 | 3.9 s | 20 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/home-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/home-mobile.report.json) |
| [Homepage repeat](https://www.transitivebullsh.it/) | Mobile | 85 / 100 / 100 / 100 | 4.0 s | 40 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/home-mobile-repeat.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/home-mobile-repeat.report.json) |
| [Projects index](https://www.transitivebullsh.it/projects) | Mobile | 97 / 100 / 100 / 100 | 2.5 s | 30 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/projects-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/projects-mobile.report.json) |
| [Writing index](https://www.transitivebullsh.it/writing) | Mobile | 99 / 100 / 100 / 100 | 2.1 s | 20 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/writing-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/writing-mobile.report.json) |
| [Passage project](https://www.transitivebullsh.it/projects/passage) | Mobile | 99 / 96 / 100 / 100 | 2.1 s | 20 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/project-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/project-mobile.report.json) |
| [Agentic Spectrum article](https://www.transitivebullsh.it/agentic-spectrum) | Mobile | 97 / 98 / 100 / 100 | 2.5 s | 40 ms | 0.015 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/article-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/article-mobile.report.json) |
| [Homepage](https://www.transitivebullsh.it/) | Desktop | 99 / 100 / 100 / 100 | 0.9 s | 0 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/home-desktop.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/home-desktop.report.json) |
| [Passage project](https://www.transitivebullsh.it/projects/passage) | Desktop | 100 / 96 / 100 / 100 | 0.5 s | 0 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/project-desktop.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/project-desktop.report.json) |
| [Agentic Spectrum article](https://www.transitivebullsh.it/agentic-spectrum) | Desktop | 100 / 98 / 100 / 100 | 0.6 s | 0 ms | 0.009 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/article-desktop.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/lighthouse/article-desktop.report.json) |

Lighthouse 13.4.1, isolated headless Chrome 152, local CLI, default simulated mobile throttling (412×823 viewport, 1.75 DPR, 4× CPU slowdown) and desktop preset. Runs were sequential; the homepage was repeated to check the weaker result. These are lab measurements, not field Core Web Vitals or INP. Scores vary with conditions; use the homepage’s observed 85–87 range rather than treating one number as definitive. [Lighthouse methodology](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring), [Web Vitals](https://web.dev/articles/vitals).

## Individual is-agentic results

| Submitted page | Score | Live service result | Saved JSON snapshot |
| --- | --- | --- | --- |
| Homepage | 58/100 | [Report](https://is-agentic.com/scan/www.transitivebullsh.it) | [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/agentic-home.json) |
| Passage project | 58/100 | [Report](https://is-agentic.com/scan/www.transitivebullsh.it/projects/passage) | [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/agentic-project.json) |
| Agentic Spectrum article | 58/100 | [Report](https://is-agentic.com/scan/www.transitivebullsh.it/agentic-spectrum) | [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/agentic-article.json) |

All three URLs were submitted separately through the service. The service returned the same findings and the same homepage-oriented Ora journey for all three, despite different report URLs and timestamps. Treat these as service-returned results, **not three independently validated page-level journeys**. Projects/writing indexes were Lighthouse-tested only. Public report URLs show the latest result, so the saved JSON files preserve this audit’s scores. [Service API and interpretation](https://is-agentic.com/docs).

The score needs interpretation:

- **Content without JavaScript:** service details acknowledge 2,239 characters and an H1; its partial score is due to a 2.3% text-to-markup ratio. Our raw-HTML check found 2,552 characters inside main. The site already serves useful content without JS; a CSR rewrite is not needed.
- **404s:** the service itself acknowledges real HTTP 404s. It wants Markdown recovery content for full credit. Both arbitrary missing article/project paths returned 404 with noindex. Its journey’s claimed /contact and /notes 500s did not reproduce; both returned 404.
- **JSON-LD:** the report asks for Person URL/sameAs, but both already exist in the live @graph. The Person node lacks a description; adding one is reasonable, but adding a duplicate identity graph is unnecessary.
- **API/CLI requirements:** the service appears to infer a software/API product from portfolio content and labels the core product a Notion starter kit. This is a personal portfolio with articles about software. Do not build a public API, developer portal, OAuth, or CLI just to satisfy those findings.
- **Markdown negotiation:** Accept: text/markdown currently returns HTML. This is a real missing capability, but not evidence of a broken cache: no Markdown variant exists yet. Adding Vary: Accept alone would not implement the feature.

## Prioritized improvements

Effort is an estimate including focused verification. No score gains are guaranteed.

| Priority | Improvement | Evidence and concrete action | Effort |
| --- | --- | --- | --- |
| 1 — high value | Align every canonical URL with www | Apex returns 308 to www, but all 61 page canonicals and sitemap URLs point to apex. Set site.origin to https://www.transitivebullsh.it; this centralizes canonicals, OG URLs, JSON-LD, robots sitemap, and llms.txt links. Keep the existing apex→www redirect. Verify the final destination is self-canonical. [Source](/Users/tfischer/dev/modules/personal-site/lib/site.ts:5). | 15–30 min |
| 2 — high value | Eager-load the first homepage project image | Homepage mobile LCP is 3.9–4.0 s, performance 85–87. Lighthouse identifies the Passage thumbnail as LCP with loading=lazy and no high priority. Pass the existing MediaImage priority option for the first above-the-fold card only; it already maps to loading=eager and fetchPriority=high. Keep later cards lazy. [Card source](/Users/tfischer/dev/modules/personal-site/components/project-index.tsx:33), [image source](/Users/tfischer/dev/modules/personal-site/components/article/media.tsx:6). | 20–40 min |
| 3 — easy correctness | Repair one legacy internal link | /nextjs-notion-starter-kit links to /api/social-image?id=d1b5dcf8-b9ff-425b-8aef-5ce6f0730202, which returns 404. Correct the source content and resync; if historical inbound URLs matter, add an explicit legacy-ID mapping to the appropriate current image URL. [Snapshot](/Users/tfischer/dev/modules/personal-site/content/snapshot.json:54137). | 15–30 min |
| 4 — easy accessibility | Fix article heading hierarchy and tweet target sizes | Agentic Spectrum jumps from H1 to H3 “Intro” (98 accessibility). Renderer shifts Notion levels uniformly; correct source headings or normalize the document hierarchy without changing anchor IDs. Passage scores 96 because tweet name, username, and follow links are 20 px tall with inadequate separation; make their hit areas at least 24 px with sufficient spacing. [Heading mapping](/Users/tfischer/dev/modules/personal-site/components/article/blocks.tsx:95), [tweet wrapper](/Users/tfischer/dev/modules/personal-site/components/article/tweet.tsx:17). | 30–60 min |
| 5 — easy visibility | Add real-user performance measurement | Vercel Speed Insights displays Get Started / no events, and @vercel/speed-insights is absent. Add its Next.js component to the root layout, deploy, and verify event collection. This enables LCP/CLS/INP monitoring; it does not itself speed up pages. | 15–30 min |
| 6 — easy clarity | Improve identity, recovery copy, and one typo | Add a concise Person.description and a short “what this site is / when to use it” introduction to llms.txt. On 404, “Back to writing” currently points home; fix that label or destination and add direct Projects/Writing links. Correct “in anthis AI parody” in Pluribus’s description at its content source. | 20–40 min |
| 7 — optional agent improvement | Publish clean article/project Markdown | Derive Markdown from the existing content snapshot, expose predictable page-level .md URLs, and advertise them in llms.txt. If also supporting Accept negotiation, implement actual representation selection and Vary: Accept with cache-separation tests; preserve static HTML delivery. This helps extraction but is more work than the fixes above. | Half day or more |

Priority 1 follows [Vercel domain redirect guidance](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting), [Next.js metadataBase/canonical guidance](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), and [Google’s canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls). Priority 2 follows the installed Next.js 16.3.5 image docs and [current Image guidance](https://nextjs.org/docs/app/api-reference/components/image): eager/high-priority loading is appropriate for this LCP image; avoid blanket preloads and the deprecated Next Image priority prop. MediaImage’s own priority prop is a local abstraction that already emits the correct attributes. Priority 5 follows [Vercel’s Speed Insights setup](https://vercel.com/docs/speed-insights/quickstart). Identity data follows [Next.js JSON-LD guidance](https://nextjs.org/docs/app/guides/json-ld).

## Metadata and HTTP coverage

- Crawled every sitemap page: **61/61 returned 200**, each with a unique title, nonempty description, one H1, canonical, and OG image; none had noindex. Raw responses contain meaningful page content and structured data.
- **59 unique advertised OG images all returned 200** with image content types, including dynamically generated article cards. Favicon, app icon, and Apple touch icon also returned 200.
- Homepage includes viewport, lang=en, description, Open Graph title/description/type/site name/URL/image dimensions/alt, Twitter large-image card/creator, Person + WebSite JSON-LD, and page JSON-LD. Article/project templates emit BlogPosting/CreativeWork data. Metadata completeness is good; host consistency is the main gap.
- robots.txt and llms.txt return 200; sitemap is valid XML and advertises the content routes. robots allows crawling. llms.txt already lists projects and articles.
- HTTPS and HSTS are present. HTTP upgrades to HTTPS. Missing article/project paths return 404 and noindex.
- Production pages are prerendered (x-nextjs-prerender: 1). The browser-facing max-age=0 policy is not proof that Vercel skips CDN caching; do not replace it with long browser caching on mutable HTML. Versioned static assets and framework caching should retain their normal policies.
- No need to add a manifest, meta keywords, or a public API simply to improve a checklist score. More specific homepage description copy is a small optional editorial improvement.

Evidence: [page/metadata crawl](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/crawl.json), [image/icon responses](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/assets.json), [internal link inventory](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/internal-links.json).

## Errors, 404s, and interaction checks

All nine isolated Lighthouse runs reported **no console errors and no HTTP 4xx/5xx resource responses** during their captured page loads. Manual Chrome had one chrome-extension:// removeChild error; it belongs to a browser extension, not the site. Search opened, loaded its index, and returned Agentic Spectrum for a matching query.

[Vercel production logs](https://vercel.com/saasify/personal-site/logs?search=environment%3Aproduction) were inspected for the visible 30-minute window around 10:37–11:07 UTC: Warning 0, Error 0, Fatal 0. Status choices showed 733×200, 152×304, 221×404, 2×405, and 1×422, with no 5xx choice. The visible 404 list was dominated by the agent scanner’s guessed /openapi.json, /api, /developers, /pricing and similar paths, plus our intentional missing-page probes. Do not turn these into fake 200s. A /favicon-96x96.png request also returned 404, but that path is not advertised by current metadata; a compatibility alias is optional if it persists in real traffic. The legacy social-image link above is a confirmed content-linked 404.

The project’s six-hour overview displayed 2.6K edge requests, 60 function invocations, and 0% error rate. These are a launch-window snapshot substantially affected by this audit, not a traffic baseline. Log retention/window limits and static cache hits mean this is not proof of zero historical errors. [Vercel log semantics](https://vercel.com/docs/logs/runtime).

## Lower-priority performance observations

Lighthouse estimates roughly 96–100 KiB unused initial JavaScript across pages, including framework/runtime code. Search is already lazy-loaded. Do not claim all that JavaScript can be removed; use a bundle analyzer before splitting shared UI further. [Next.js lazy-loading guidance](https://nextjs.org/docs/app/guides/lazy-loading).

The homepage made 65 captured requests (~588 KiB), including 11 RSC-prefetch requests. Cards explicitly prefetch, and desktop link previews also warm routes. If performance remains weak after the LCP fix, compare hover/focus-only card prefetching against the current behavior. This trades initial bandwidth for slower first navigation; benefit is unproven until A/B measurements. [Next.js Link prefetch behavior](https://nextjs.org/docs/app/api-reference/components/link#prefetch).

Passage’s custom TweetAvatar upgrades a 48 px avatar to a 400×400 source; Lighthouse estimates ~21 KiB excess for that image. A ~96 px optimized variant is a small later win. Homepage image-delivery estimates reach ~60 KiB, but existing responsive srcsets and DPR must be considered before shrinking sources. CSS-blocking and legacy-JS diagnostics are not higher priorities given 0–40 ms TBT and desktop scores of 99–100.

Scope limits: no exhaustive external-link crawl, no authenticated user flows, no full security assessment, no field INP data, and no before/after implementation measurements. The report ranks observed low-effort fixes rather than promising arbitrary score targets.
