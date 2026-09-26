# Accepted design review — 24 September 2026

> Historical record. See [the archive index](README.md) for status and current guidance. Counts, validation results, and proposals below describe the original work.

Reviewed the home, writing index, projects index, article, project detail, and missing-page templates at 320, 390, 768, and 1440px. The audit combined better-ui, Impeccable, improve-ui, shadcn guidance, and the previous Rams report. No fresh Rams call was available.

## Accepted changes

| Review ID | Change |
| --- | --- |
| 01 | Reflow mobile header actions into a separate row with 44px targets; enlarge mobile footer targets. |
| 02 | Show the current writing/projects section with an underline and `aria-current`. |
| 03 | Give search a compact placeholder, icon close button, visible focus treatment, larger mobile targets, and clearer keyboard hints. |
| 04 | Increase table-of-contents links from 12px to 14px and its title from 11px to 12px. |
| 06 | Include the heading text in each section permalink's accessible name. |
| 07 | Name footer and content-end navigation landmarks. |
| 08 | Give the missing-page view a primary Back home action and secondary destinations. |

The user accepted 01–04 and 06 in the gallery, then explicitly accepted 07 and 08 in the follow-up review. Item 05 (restoring focus after dismissing an image lightbox with Escape) was rejected and reverted. The existing lightbox behavior is unchanged.

## Evidence and limits

The local review gallery retains the original annotated before-and-after captures and measurements under `design-plans/2026-09-24-audit/`. Its item 05 after-image documents the rejected proposal, not the final implementation. The gallery and raw audit artifacts are not part of this commit.

The accepted changes had no horizontal page overflow across 24 route/viewport checks. Search keyboard navigation and selected light/dark states were inspected. Physical touch, native screen-reader speech, slow-motion replay, and exhaustive content/contrast checks were not performed. The mobile header is approximately 24px taller as a result of the larger targets.
