# Development and verification

## Local workflow

Install FFmpeg on PATH for the video import tests (`brew install ffmpeg` on macOS; `apt-get install ffmpeg` on Debian/Ubuntu).

Use the Node engine and pnpm version in `package.json`. CI's clean-install command is:

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm dev
```

`pnpm dev` uses Portless with `--force`: starting it stops any existing server registered to this checkout's hostname and takes over the route. Linked worktrees retain their own inferred hostnames. Open the URL it prints rather than assuming port 3000. The committed snapshot supports normal development without CMS/storage credentials; use [Content sync](content-sync.md) only when importing content. If the snapshot is missing from a checkout, restore the committed artifact first.

[Agentation](https://www.agentation.com/install) is available across the site in development. Open the bottom-right toolbar, select an element or text, add feedback, then copy its Markdown into your agent. Annotations stay in browser local storage; no MCP endpoint is configured. `components/development-feedback.tsx` loads it only on the client in development, and production builds exclude its package code. For CyberSwarm, open `/ai-cyberswarm-warfare` on the dev URL.

Use the installed Next.js guides for the APIs being changed. Locate the relevant topic first, then read the returned path; numbered directories and extensions can change:

```sh
rg --files node_modules/next/dist/docs | rg 'css|use-client|server-and-client|image'
```

`work/` is ignored scratch space for probes and screenshots, not a required checkout dependency. Keep durable commands in `scripts/`, behavior checks in `tests/`, and useful conclusions in the relevant guide.

## Agent execution troubleshooting

- If pnpm starts silently, check the active runner against `package.json`. Once the required version is active, `npm_config_manage_package_manager_versions=false pnpm --version` can diagnose a version-manager stall; this recovered earlier sessions.
- `listen EPERM` on loopback or tsx IPC indicates sandbox permissions. Rerun the affected command through the tool's approval path, then finish the normal checks.

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
| Publication, aliases, references, project source contracts | `publication.test.ts`, `references.test.ts`, `content.test.ts`, `projects.test.ts`, `import.test.ts`, `notion.test.ts`, `sync.test.ts` |
| Media, retries, dry runs, widths, downloads | `media.test.ts`, `cache.test.ts`, `download.test.ts`, `placeholders.test.ts`, `image-widths.test.tsx`, `media-download.test.ts`, `remote-video.test.ts`, `remote-video-ranges.test.ts` |
| Search, Markdown, embeds, previews, TOC | `search.test.ts`, `markdown.test.ts`, `markdown-routes.test.ts`, `tweets.test.ts`, `link-preview.test.ts`, `article-enhancements.test.ts`, `public-fetch.test.ts` |
| Social rendering and metadata | `social-image.test.ts`, plus the mandatory build bundle check |

Focused behavior tests use small explicit fixtures; committed-content checks intentionally detect corpus drift. Derive expected values independently, keep relevant failure paths real, and control incidental retry delays. Shared importer behavior belongs in `import.test.ts`; `sync.test.ts` exercises selection and publication through the real collaborators with isolated service and filesystem boundaries. The range protocol suite controls inspector seeks, while `remote-video.test.ts` retains real FFmpeg decoding.

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
