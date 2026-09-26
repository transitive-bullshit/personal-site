# Development and verification

## Local workflow

Use the Node engine and pnpm version in `package.json`. CI's clean-install command is:

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm dev
```

`pnpm dev` uses Portless. Open the URL it prints rather than assuming port 3000. The committed snapshot supports normal development without CMS/storage credentials; use [Content sync](content-sync.md) only when importing content. If the snapshot is missing from a checkout, restore the committed artifact first.

Use the installed Next.js guides under `node_modules/next/dist/docs/` for the APIs being changed. `work/` is ignored scratch space for probes and screenshots, not a required checkout dependency. Keep durable commands in `scripts/`, behavior checks in `tests/`, and useful conclusions in the relevant guide.

## Checks by change

| Change | Verification |
| --- | --- |
| Documentation only | `pnpm fix:format`, review the diff and local links; check described commands/behavior against source. |
| Application or importer code | Run relevant Vitest tests while iterating, then `pnpm fix:format`, `pnpm fix:lint`, `pnpm test`, and `pnpm build`. |
| Content sync | Review snapshot/index diffs and warnings, then the code checks above and representative rendered pages. A nonzero sync exit can still leave changed artifacts. |
| UI, media, or navigation | Add focused browser checks on top of the code checks. See the representative cases below. |

`pnpm test` covers format, lint, generated Next types plus TypeScript, and unit tests. `pnpm build` uses webpack and then checks the native social-image bundle. CI runs both on pushes. Script definitions in `package.json` are authoritative.

Run an individual test file with, for example:

```sh
pnpm exec vitest run tests/projects.test.ts
```

| Behavior | Useful tests |
| --- | --- |
| Publication, aliases, references, project source contracts | `publication.test.ts`, `content.test.ts`, `projects.test.ts`, `import.test.ts`, `notion.test.ts` |
| Media, retries, dry runs, widths, downloads | `media.test.ts`, `cache.test.ts`, `download.test.ts`, `placeholders.test.ts`, `image-widths.test.tsx`, `media-download.test.ts` |
| Search, Markdown, embeds, previews, TOC | `search.test.ts`, `markdown.test.ts`, `tweets.test.ts`, `link-preview.test.ts`, `article-enhancements.test.ts` |
| Social rendering and metadata | `social-image.test.ts`, plus the mandatory build bundle check |

## Browser and production-mode checks

There is no committed browser-test runner. Check the changed behavior in a browser and report what was actually exercised. Use `pnpm build` followed by `pnpm start` when validating production rendering, image timing, HTTP responses, or metadata; dev mode is not a performance baseline.

- For layout changes, inspect an affected page at desktop and 390px/320px widths, both themes where relevant, keyboard focus, and horizontal overflow.
- For shared content, choose cases that exercise the change: `/agentic-spectrum` for prose/TOC, `/javascript-dev-tools-in-2022` for tables, `/chatgpt-twitter-bot-lessons` for tweets, `/making-your-code-beautiful` for code/GIFs, and `/projects/passage` for project details. Check homepage → project navigation separately from direct visits.
- For interactions, verify the relevant keyboard path, dismissal, focus behavior, and reduced-motion branch. The [September design review](archive/design-review-2026-09-24.md) records an explicitly rejected lightbox focus proposal; older logs are not the current interaction specification.
- For routes/discovery, check canonical 200s, direct alias 308s, unknown/private 404s, Markdown MIME/canonical headers, sitemap/llms inclusion, and metadata in the initial HTML. Derive expected counts from the current snapshot rather than old audit totals.
- For images/social cards, cover direct load, client navigation, slow/failed image requests, and the no-cover fallback as applicable. A successful local Takumi render alone does not validate the deployed native bundle; see [Metadata](metadata.md).

Local standalone Next does not serve Vercel analytics/Speed Insights collector endpoints. Separate those local telemetry failures from application failures. For performance claims, record the build, environment, throttling, and repeated measurements; the [hero investigation](archive/hero-image-investigation.md) explains why an earlier placeholder hypothesis was reverted.

## Historical evidence

[Implementation verification](archive/implementation-verification.md) preserves the original migration and feature checks. [Metadata verification](archive/metadata-verification-2026-09-16.md) and the [archive index](archive/README.md) retain past audits and their limits. They establish what was tested then, not the health of the current checkout or deployment.
