# Historical records

These documents preserve decisions, experiments, and verification at the time of the work. They are not current instructions or an outstanding task list. Start with [Architecture](../architecture.md), [Verification](../verification.md), and the topic guides in `docs/`.

| Record | How to use it |
| --- | --- |
| [Initial implementation plan](implementation-plan.md) | Migration intent, original tradeoffs, and URL baseline. Its article-only scope, apex hostname, dependency exclusions, and early image/metadata proposals were superseded. |
| [Implementation verification](implementation-verification.md) | Migration and subsequent feature checks from September 15–17, including the Takumi deployment incident. Counts, hashes, and interaction descriptions are historical. |
| [Metadata verification](metadata-verification-2026-09-16.md) | Original generated-HTML and icon checks; current behavior is in [Metadata](../metadata.md). |
| [First production audit](production-audit-2026-09-16.md) → [implemented improvements](production-improvements.md) → [second audit](production-audit-2026-09-16-round2.md) | Follow this sequence to distinguish original findings, local fixes, and subsequent deployment checks. Remaining performance ideas were hypotheses. |
| [Hero-image investigation](hero-image-investigation.md) | Follow-up to the second audit: avatar optimization shipped locally; removing hero blur was tested and reverted. No confirmed hero-LCP fix. |
| [Accepted design review](design-review-2026-09-24.md) | Accepted UI changes and an explicitly rejected/reverted lightbox focus proposal. Check this before treating older focus-return claims as current requirements. |

Machine-local report/gallery paths in these records may be unavailable in another checkout. The conclusions and limits are retained here; use fresh evidence when validating new work. Keep new audit measurements in dated records and promote only durable conclusions into current guides.
