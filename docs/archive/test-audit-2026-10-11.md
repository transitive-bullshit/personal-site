# Test audit repairs — 2026-10-11

The audit at `ea28ca9` examined all 142 cases in 23 Vitest files: 113 Keep, 26 Repair, three Combine, no unconditional removals. This follow-up repairs every flagged case, transfers unique assertions before consolidation, and adds focused checks for the identified boundary gaps.

## Contract ownership after repair

| Finding | Surviving proof |
| --- | --- |
| F1: circular hash expectation | `media.test.ts`: independent SHA-256 vector, distinct content keys and preserved bytes, existing deduplication and HEAD-before-PUT checks. |
| F2: uniform multipart bytes | `multipart.test.ts`: distinct part contents and exact reconstructed object after resume or expired-upload restart. |
| F3: unchanged source fixture | `media.test.ts`: key, kind, external URL, edited marker, pipeline version, and force each invalidate reuse. |
| F4: positive-only remote dimensions | `remote-video.test.ts`: exact rotated 90×160 and anamorphic 320×90 display dimensions through real FFmpeg inspection. |
| F5: Markdown counts/no-fetch claim | `markdown.test.ts`: exact canonical build paths and observed absence of runtime fetches across the committed corpus. |
| F6: incomplete redirect wiring | `legacy-redirects.test.ts`: complete registration plus independently known mappings; destination integrity and reserved paths remain. |
| F7: body failure before any bytes | `download.test.ts`: real partial chunk followed by reader failure; retry returns only complete replacement bytes. Incidental backoff is controlled. |
| F8: duplicates and harness-supplied evidence | `import.test.ts` owns shared cache, force, fast-sync recovery, fallback, concurrency, and transferred inactive-entry removal/project diagnostics. Generic prune/rename assertions remain in `content.test.ts`; selected-only pruning now runs through `sync.test.ts`. Fake uploads bookkeeping is removed. The 30-minute timeout check is folded into retry coverage with signal-to-fetch wiring. |
| F9: expensive/editorial fixtures | `cache.test.ts` now performs a real PUT against stateful storage with tiny attachment bytes. Project compatibility, links, hero selection, social metadata, and Markdown handlers use explicit fixtures. Intentional corpus smoke and real native media/rendering checks remain. |
| F10: weak values or incidental markup | Preview metadata and failure diagnostics, heading identities/text, Notion width requests, isolated search removal/identity conditions, dated search ordering/nonmutation, actual cover replacement, decoded social fallbacks, and parsed video attributes/caption now have substantive assertions. |
| F11: wrong validation guard | `publication.test.ts` supplies a schema-valid missing-media snapshot and proves reference validation rejects it without replacing saved bytes; schema failure/no-op checks remain. |

`markdown-routes.test.ts` receives the moved handler assertions, retaining MIME, canonical headers, ID redirects, recoverable 404s, and saved tweet rendering; it also covers aliases. Its small article and project fixtures contain distinct body text.

## Boundary gaps addressed

- G1: `sync.test.ts` runs real discovery orchestration, normalization, generic import, reference validation, and atomic publication. It covers both collection-selection directions, selected-only pruning, private rows excluded from body reads, discovery failure preventing publication, and real download/FFmpeg failures retaining saved content while skipping new entries. Service responses, credentials, and filesystem destinations are isolated. The only production change makes importing the existing `main` function inert; direct CLI execution remains the entry point.
- G2: `public-fetch.test.ts` replaces DNS and HTTP boundaries while running `publicFetch`: mixed public/private answers are rejected; every redirect destination is validated before fetching; relative public redirects reach the correct response.
- G3: downloader tests cover declared/received 512 MiB limits, 401/403 refresh, 500 recovery, 429 retry exhaustion/backoff caps, and cancellation. `remote-video-ranges.test.ts` controls inspector seeks through the real local HTTP bridge to cover 1 MiB requests, 32 MiB total budget, invalid/mismatched/oversized/incomplete ranges, and deadline wiring/expiry. `references.test.ts` uses schema-valid negative cases for identity/path, publication, duplicate anchors, internal ID links, tweet state, content-addressed assets, temporary URLs, and remote source consistency.

## Verification

- `pnpm test`: 170 cases in 28 files pass, including format, lint, and generated Next/TypeScript checks. Vitest completed locally in 1.69 seconds; the original run took 2.60 seconds. These are single observations, not a performance benchmark.
- `pnpm build`: production build, static generation, and native Takumi bundle check pass.
- Disposable mutation checks against the final tests reject all seven previously surviving counterexamples: constant hashes, wrong multipart offsets, lost project namespaces, incomplete redirects, ignored source kind/URL, incorrect display dimensions, and partial-byte leakage. Nine additional counterexamples verify transferred inactive-entry coverage, hero selection, redirect validation, range budgets, reference validation before publication, private-body filtering, preferred cover selection, and both download size guards. Failure diagnostics were inspected; this is targeted falsification, not a comprehensive mutation score. Copies and mutation infrastructure remain outside the repository.

The suite still does not establish live Notion/R2/provider integrations, deployed native rendering, or browser layout/usability. Real FFmpeg, Sharp, Takumi, filesystem publication, and loopback transport remain covered locally. No browser runner or external-service test infrastructure was added.

Independent Codex review confirmed the importer, timeout, and Markdown transfers preserve their unique protection. It found a cover fixture sharing its original and preferred-variant URL; those assets now have distinct URLs/hashes, and the original-only cover mutation fails. Streaming size fixtures are bounded even if a guard regresses, and sync input snapshots are read from the same isolated filesystem destination used for publication.
