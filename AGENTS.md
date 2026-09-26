# Agent guide

This is Travis Fischer's personal portfolio and writing site. Next.js serves committed Notion content snapshots; explicit syncs import content and durable media.

## Start here

- Read [Architecture](docs/architecture.md) for project intent, domain objects, ownership boundaries, and where to make changes.
- Use [Verification](docs/verification.md) for setup, development, and checks appropriate to the change.
- For content imports, publication, or media processing, read [Content sync](docs/content-sync.md).
- For routes, discovery, or social cards, read [Metadata](docs/metadata.md). For project image loading or transitions, read [Project images](docs/project-image-loading.md).

## Conventions

- Use `pnpm` and modern TypeScript without semicolons.
- Format with `pnpm fix:format` (oxfmt); lint with `pnpm fix:lint` (oxlint).
- Keep current guidance concise under `docs/` and update the relevant guide when behavior changes. Put dated audits and experiments in `docs/archive/`; carry forward durable decisions into the current guide. The top-level `readme.md` is human-facing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
