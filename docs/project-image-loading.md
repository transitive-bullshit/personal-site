# Project image navigation

Project cards and detail heroes share a source, but their responsive `sizes` select different Next.js optimizer URLs. A cached card therefore does not imply a cached hero. The hero already uses eager loading and high fetch priority.

`ProjectCoverImage` records the actual `currentSrc` after Next Image completes loading/decoding. On client navigation, it uses that loaded rendition as an unblurred CSS background until the new image loads. This also supports navigation back to the grid. The in-memory map is limited to 64 sources, retains the largest observed rendition, stores no image bytes, and is never written during server rendering. Direct visits keep the original blur placeholder. Only project covers opt in; ordinary article images retain their existing behavior.

Keep accurate responsive sizes and avoid downloading every full-size hero from the grid. Next Image has no documented cross-route previous-rendition fallback; this is a small application-level progressive-image enhancement, not a framework feature. See the [Next Image docs](https://nextjs.org/docs/app/api-reference/components/image#sizes) and [prefetching guide](https://nextjs.org/docs/app/guides/prefetching).

Validation: all 94 tests, format/lint/type checks, and production build pass. A local production-mode proxy delayed large image responses by 20 seconds. Browser inspection confirmed the loaded 750px card URL became the hero background while the hero request was incomplete; the fallback remained visibly sharp during the delay. After completion, the 1920px hero replaced it and the background was removed. No browser console errors were reported.
