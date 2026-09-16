# Production re-audit — September 16, 2026

The homepage is substantially faster and the previous accessibility/metadata fixes are live. The remaining performance priority is **cold-load mobile detail-page LCP**, which is slower in both runs of this audit. No broken advertised links, console errors, or 5xx responses were found in the measured coverage.

Production: https://www.transitivebullsh.it. Vercel confirms commit **b9432f1**, deployment [6MaJAwhK8hWG5S7RFidPde6DLK9o](https://vercel.com/saasify/personal-site/6MaJAwhK8hWG5S7RFidPde6DLK9o), Ready. Lighthouse measurements: 11:53–11:58 UTC. Compared with the [first audit](production-audit-2026-09-16.md). This audit changes no application code or configuration.

## Individual Lighthouse results

Scores are **Performance / Accessibility / Best Practices / SEO**. Every run also scored 100 in Lighthouse’s separate agentic-browsing category; that is not the is-agentic service score.

| Page | Device/run | Scores | LCP | TBT | CLS | Individual results |
| --- | --- | --- | --- | --- | --- | --- |
| Homepage | Mobile | 98 / 100 / 100 / 100 | 2.0 s | 30 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/home-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/home-mobile.report.json) |
| Homepage | Mobile repeat | 95 / 100 / 100 / 100 | 2.7 s | 70 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/home-repeat-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/home-repeat-mobile.report.json) |
| Projects index | Mobile | 97 / 100 / 100 / 100 | 2.6 s | 60 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/projects-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/projects-mobile.report.json) |
| Writing index | Mobile | 99 / 100 / 100 / 100 | 2.1 s | 20 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/writing-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/writing-mobile.report.json) |
| Passage | Mobile | 93 / 100 / 100 / 100 | 3.1 s | 10 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/project-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/project-mobile.report.json) |
| Passage | Mobile repeat | 88 / 100 / 100 / 100 | 3.4 s | 30 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/project-repeat-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/project-repeat-mobile.report.json) |
| Agentic Spectrum | Mobile | 95 / 100 / 100 / 100 | 2.8 s | 20 ms | 0.015 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/article-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/article-mobile.report.json) |
| Agentic Spectrum | Mobile repeat | 92 / 100 / 100 / 100 | 3.0 s | 70 ms | 0.015 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/article-repeat-mobile.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/article-repeat-mobile.report.json) |
| Homepage | Desktop | 100 / 100 / 100 / 100 | 0.6 s | 0 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/home-desktop.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/home-desktop.report.json) |
| Passage | Desktop | 100 / 100 / 100 / 100 | 0.8 s | 0 ms | 0 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/project-desktop.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/project-desktop.report.json) |
| Agentic Spectrum | Desktop | 100 / 100 / 100 / 100 | 0.6 s | 0 ms | 0.007 | [HTML](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/article-desktop.report.html) · [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/lighthouse/article-desktop.report.json) |

Same Lighthouse 13.4.1 and headless Chrome 152 as the baseline; default simulated mobile throttling, 412×823 viewport, 1.75 DPR, and desktop preset. Runs were sequential. Lab scores vary with network and machine conditions and do not establish field INP or causality. [Scoring methodology](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).

| Comparison | First audit | This audit |
| --- | --- | --- |
| Homepage mobile | 85–87, LCP 3.9–4.0s | **95–98, LCP 2.0–2.7s** |
| Passage mobile | 99, LCP 2.1s, accessibility 96 | **88–93, LCP 3.1–3.4s, accessibility 100** |
| Article mobile | 97, LCP 2.5s, accessibility 98 | **92–95, LCP 2.8–3.0s, accessibility 100** |
| Projects / writing mobile | 97 / 99 | 97 / 99 |
| Home / project / article desktop | 99 / 100 / 100 | 100 / 100 / 100 |

## Prioritized next work

1. **Investigate and reduce mobile hero render delay.** Highest impact, moderate effort; not a proven one-line fix. Passage’s first trace shows ~1,046ms between image completion and rendering, versus ~39ms image transfer; the article shows ~1,017ms render delay versus ~72ms transfer. These are observed trace subparts, not the simulated LCP totals above. Both heroes already have eager/high-priority attributes. Run a controlled comparison of direct-load blur versus an empty/CSS placeholder, retaining the loaded-card fallback on client navigation. Inspect hydration/decode work before changing production. Next removes its blur after client-side image decoding; this is a hypothesis to test, not proof that the new fallback caused the slowdown (the article does not use that fallback). Avoid adding duplicate preloads or shrinking images to address render delay. [LCP diagnosis](https://web.dev/articles/optimize-lcp), [Next Image guidance](https://nextjs.org/docs/app/api-reference/components/image).

2. **Right-size tweet avatars.** Clearest small fix: Passage fetches a 400×400, ~22KB avatar for a 48px display. Lighthouse estimates ~21KB avoidable. “components/article/tweet-avatar.tsx” explicitly upgrades the source to 400px. Generate/cache a roughly 96px version for 2× displays, with the current failure fallback retained. Tweet media also has a size warning, but account for DPR before reducing its resolution. The entire project image-delivery estimate is ~72KiB; it is not all safely removable. [Responsive image guidance](https://nextjs.org/docs/app/api-reference/components/image#sizes).

3. **Correct the small mobile hero sizes mismatch.** At 412px viewport, the hero renders at 380px, while its “sizes” declares 368px (“100vw - 44px”). Align the cover-specific declaration with the actual 32px page gutters. This is a small correctness fix, not a promised speedup; both currently select 750px at the measured DPR. Keep body-image sizing separate.

4. **Optional: declare the site’s content type to is-agentic.** A single “is-agentic-site-type=content” metadata declaration can pin the report’s default lens. Its docs explicitly say this does **not** increase the score. The current inferred lens already matches, so this is preventive and lower priority. Do not add fake OpenAPI, checkout, or developer-portal endpoints for a portfolio. [Service declaration docs](https://is-agentic.com/docs#declare-site-type).

There is no evidence here justifying broad caching changes, eager loading of all project heroes, or a large JavaScript rewrite. Lighthouse flags ~96–100KiB unused JS, but framework code is included and removability has not been established. CSS and dependency-tree insights estimate zero LCP savings in these runs.

## Individual is-agentic results

Each page was explicitly rescanned. All three browser results updated to **60/100** from 58, but remained at **“Saving completed scan…”**. Repeated public-API reads still returned the original 58-point snapshots. Therefore 60 is a **provisional displayed result**, not a confirmed persisted score. The browser report tabs are left open; a freshly opened report URL may show the old score until the service saves it.

| Page | Displayed rescan | Individual service report | Saved observation | API snapshot |
| --- | --- | --- | --- | --- |
| Homepage | 60, saving pending | [Report](https://is-agentic.com/scan/www.transitivebullsh.it) | [Observed result](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/agentic-home-observation.html) | [Stale 58-point JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/agentic-home.json) |
| Passage | 60, saving pending | [Report](https://is-agentic.com/scan/www.transitivebullsh.it/projects/passage) | [Observed result](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/agentic-project-observation.html) | [Stale 58-point JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/agentic-project.json) |
| Agentic Spectrum | 60, saving pending | [Report](https://is-agentic.com/scan/www.transitivebullsh.it/agentic-spectrum) | [Observed result](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/agentic-article-observation.html) | [Stale 58-point JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/agentic-article.json) |

The displayed rescans still reuse the prior Ora journey identifying the site as a starter kit, including alleged /contact and /notes 500s. Direct checks return real 404s, and raw HTML contains the portfolio content. Treat that journey as stale/misleading evidence, not a newly reproduced failure. The scanner still favors Accept-based Markdown negotiation; this site intentionally provides discoverable separate .md URLs. No Accept variation means no need to add “Vary: Accept” alone. The supported API reads completed reports rather than launching rescans. [Service docs](https://is-agentic.com/docs).

## Deployed fixes and general checks

- **61/61 sitemap pages:** 200, unique titles, nonempty descriptions, one H1 each, www canonical, valid parsed JSON-LD, and Markdown alternate links. Homepage Person now includes description, URL, and sameAs. Structured data is present in initial HTML. [Next JSON-LD guidance](https://nextjs.org/docs/app/guides/json-ld).
- **61/61 Markdown alternates:** 200 with text/markdown and canonical Link headers. llms.txt lists them and describes the portfolio. Missing article/project .md URLs return 404 with useful recovery links. HTML missing pages also return 404.
- **130 discovered internal link URLs:** all resolve to 200. **59 unique OG images plus three icons and the historical image URL:** all 63 checks pass. The historical URL resolves through its compatibility redirect.
- Homepage first card is eager/high-priority. Article heading hierarchy and tweet target-size fixes now earn 100 accessibility in production. Pluribus’s description is corrected.
- Live homepage → Passage navigation completed with the sharp hero loaded; no blur pause was observed in this warm production run. This does not reproduce a slow-connection transition; the earlier delayed-image test is documented separately. Search returns Agentic Spectrum correctly.
- All **11 Lighthouse runs** have empty console-error and HTTP 4xx/5xx resource lists. Manual production browser logs also show no errors.
- HTTPS/HSTS and framework CDN caching remain present. Sample pages return Vercel HIT or PRERENDER. No evidence of a caching malfunction.

Evidence: [page crawl](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/crawl.json), [assets](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/assets.json), [Markdown/internal link checks](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/extra.json), [link inventory](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit-round2/internal-links.json).

## Vercel telemetry and logs

[Speed Insights](https://vercel.com/saasify/personal-site/speed-insights) is now collecting: desktop RES **99** from **11 events**, with 8 shown for the homepage route. Mobile showed **no events**; the UI’s zero is an empty state, not a measured score. The current tier does not expose the individual metric cards. The sample is too small and audit-heavy for field-performance conclusions. [Vercel metric definitions](https://vercel.com/docs/speed-insights/metrics).

[Production logs](https://vercel.com/saasify/personal-site/logs?search=environment%3Aproduction), visible 11:29–11:59 UTC window: Warning **0**, Error **0**, Fatal **0**. Status counts: 921×200, 228×404, 17×304, 2×405, 1×308; no 5xx category. The inspected 404 rows were scanner probes such as /openapi.json, /api, /docs, /ask, /checkout_sessions and /__ora-404-probe-… . These are not broken advertised links and should retain their correct failure statuses. This limited log window is not proof of no historical errors.

Scope: production public routes, representative browser flows, lab performance and a limited telemetry window. No exhaustive external-link crawl, security audit, or mature mobile field data. Remaining root causes and proposed performance experiments are not claimed as confirmed fixes.
