# Production audit improvements

Implemented all seven recommendations from [the production audit](production-audit-2026-09-16.md). These changes have been validated locally; deployment and incoming production Speed Insights events have not been verified.

1. Standardized canonical URLs, sitemap, social metadata, and structured data on `https://www.transitivebullsh.it`. Content links still recognize both historical hostnames.
2. Made only the homepage’s first project image eager with high fetch priority. Other cards retain lazy loading.
3. Corrected the Notion source image-caption link and local snapshot. Added a permanent redirect for valid historical `/api/social-image?id=…` links; unknown IDs return 404.
4. Normalized article/project heading levels without changing anchor IDs or source content. Increased tweet-header link targets to at least 24px.
5. Installed and mounted Vercel Speed Insights. Its production collector requires deployment to Vercel; local standalone Next does not serve the Vercel telemetry endpoints.
6. Added Person description and clearer agent guidance, corrected 404 navigation, and fixed the Pluribus description in Notion, the snapshot, and the search index.
7. Added statically generated Markdown for all 61 public pages. Discovery uses HTML `rel="alternate"` metadata and llms.txt. Examples: `/index.md`, `/writing.md`, `/projects.md`, `/agentic-spectrum.md`, `/projects/passage.md`. Markdown retains content, headings, links, code, tables, and cached tweet text. Responses include `text/markdown` and canonical Link headers. Aliases redirect and unknown pages return 404. Separate URLs preserve static HTML delivery without Accept negotiation or shared-cache representation ambiguity.

## Validation

- `pnpm test`: formatting, lint, types, and all 94 tests pass.
- `pnpm build`: passes, including all 133 generated static outputs and native social-image bundle verification.
- HTTP validation: all 61 Markdown URLs return 200 with correct MIME and canonical headers; verified metadata alternate, one eager/high-priority homepage image, corrected heading outline, historical-image redirect, and Markdown 404.
- Browser layout checked on Passage.
- Local production-build Lighthouse accessibility: Passage **100** (production baseline 96), Agentic Spectrum **100** (production baseline 98). These targeted runs assess accessibility only; they are not new production performance measurements.

| Local page | Lighthouse HTML | Raw JSON |
| --- | --- | --- |
| Passage | [Report](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/after/project.report.html) | [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/after/project.report.json) |
| Agentic Spectrum | [Report](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/after/article.report.html) | [JSON](/Users/tfischer/.codex/visualizations/2026/09/16/01a0a9e0-3164-7f73-92d2-fb04f1fa53fa/audit/after/article.report.json) |

Original individual production Lighthouse and is-agentic reports remain in the audit report. After deployment, repeat mobile homepage Lighthouse, verify telemetry arrival in Vercel, and recheck production Markdown discovery. No post-change is-agentic score is claimed.
