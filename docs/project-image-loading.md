# Project images and transitions

## Loaded-image reuse

Project cards and detail heroes share a source, but their responsive `sizes` select different Next.js optimizer URLs. A cached card therefore does not imply a cached hero. The hero already uses eager loading and high fetch priority.

`ProjectCoverImage` records the actual `currentSrc` after Next Image completes loading/decoding. On client navigation, it uses that loaded rendition as an unblurred CSS background until the new image loads. This also supports navigation back to the grid. The in-memory map is limited to 64 sources, retains the largest observed rendition, stores no image bytes, and is never written during server rendering. Direct visits keep the original blur placeholder. Only project covers opt in; ordinary article images retain their existing behavior.

Keep responsive `sizes` accurate and load the rendition needed for the current layout. `MediaImage`'s local `priority` prop sets eager loading and high fetch priority; it is not the deprecated Next Image prop. The homepage prioritizes its first project cover; other cards remain lazy. Read the installed Next Image guide before changing delivery behavior.

## Transition identity

`components/project-transition.tsx` wraps project images, titles, and descriptions in React ViewTransition participants. Names use stable project IDs so card/detail transitions survive slug changes. Keep the participant outside the image lightbox: a portal must not mount another participant with the same name. Motion styles and the reduced-motion branch live in `app/globals.css`.

## Lessons and verification

- The September 16 navigation check delayed large image responses by 20 seconds: the loaded 750px card remained sharp while the 1920px hero was pending, then cleared after the hero decoded. Recheck both direct visits and client navigation when changing this behavior.
- Removing blur from eager heroes was tested and reverted; the small local comparison showed no convincing improvement. Earlier production LCP subparts did not prove the placeholder or project fallback caused a delay. See the [hero investigation](archive/hero-image-investigation.md) before repeating that experiment or adding preloads.
- Tweet avatars use a restricted Next Image source with original-image fallback. That optimization was retained independently of the reverted hero experiment.

Use [Verification](verification.md) for current checks. Performance work needs production-mode, repeatable measurements and the final decoded image as evidence, rather than a cached navigation or one Lighthouse score.
