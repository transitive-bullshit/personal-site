# Faces prototype

`/faces` is a prototype for a future intro splash: a WebGPU particle swarm that assembles into a 3D portrait of Travis, holds, releases and repeats with another portrait. It is a full-screen black stage over the site shell, excluded from search (`noindex`) and from discovery surfaces, and `faces` is a reserved slug. Browsers without WebGPU see a short notice.

The effect re-implements the techniques behind Thomas Cullen's [faces playground](https://playground.thomascullen.io/faces) (three.js WebGPU + TSL) with React Three Fiber; constants that define the look (forces, timings, lighting, depth of field, bloom) match the original.

## Pipeline

```text
public/faces/<slug>/ portrait.webp + depth.bin/json + features.json
  → lib/faces/faces.worker.ts   sample 30k targets (lib/faces/portrait.ts)
                                match swarm → targets each cycle (lib/faces/assignment.ts)
  → lib/faces/swarm-simulation.ts  WGSL compute: flocking, gyroid folding, portrait springs
  → lib/faces/faces-stage.ts       instanced spheres, trails, studio lights, DOF + bloom, caption
  → components/faces/*             R3F canvas with WebGPURenderer, page wrapper
```

- `lib/faces/timeline.ts` loops swarm (2 s) → assemble (2 s) → hold (3 s) → release (2.8 s). The swarm phase waits until the worker has a fresh assignment, made from a GPU position snapshot taken 0.9 s into the phase.
- `app/faces/page.tsx` lists the portraits. The worker loads them one at a time in random order, and `lib/faces/portrait-shuffle.ts` picks each cycle's face: every loaded portrait once per round, never the same one twice in a row. A portrait that fails to load is skipped.
- R3F owns the canvas, renderer, camera and frame loop; `createFacesStage` owns the three.js objects so React lint rules stay satisfied.
- `?portrait=<slug>` shows only the prepared portrait in `public/faces/<slug>/`, for comparison.
- In development and Vercel previews, a corner label names the portrait on screen (`travis-selfie · 2/4`) for review feedback. There, ←/→ jump to the previous/next loaded face with a shortened transition (`timeline.jump()`) and pin it; Esc resumes the random loop.

## Portrait assets

Each `public/faces/<slug>/` directory holds:

- `portrait.webp`: 512×768 grayscale on pure black. Pixels with every channel below 9 are empty; brighter pixels are sampled, weighted by local contrast.
- `depth.bin`: uint16 little-endian relative inverse depth (near is white) at the same size, described by `depth.json`.
- `features.json`: hand-placed eye, lip and cheek anchors (normalized from the top-left) that refine depth, densify sampling around the eyes, nostrils and mouth, and make the eyes and nose land first.

`scripts/faces/` regenerates them with local models only (MODNet matting and Depth Anything V2 Small, both Apache-2.0). It has its own dependencies, kept out of the site's install:

```sh
npm install --prefix scripts/faces
node scripts/faces/prepare-portrait.mjs <photo> public/faces/<slug> --review <review-dir>
node scripts/faces/check-portrait.mjs public/faces/<slug> <review-dir>/matte.png
```

`scripts/faces/portraits/<slug>.json` holds everything photo-specific: crop, grade, shirt mask and the hand-placed anchors. When the depth model reads a face as a flat mask (common for head-on selfies), an optional `curvature: { amount, radius }` eases depth back toward the silhouette so the head rounds off; `travis-selfie` uses `0.55` over `0.2` of the width to match the avatar's roundness. Re-place the anchors for each new photo and check `features-overlay.png` in the review directory. Output is deterministic. The source photos are not committed.

The portraits cycle, so keep their framing consistent: eyes at about 42% height, the face about half the image width, and visible pixels spanning roughly 11–77% of the height, because each portrait is scaled by the height of its visible pixels. Match the avatar's face luminance (mean about 120) so the tone doesn't jump between faces.

The `travis-*` portraits come from a high-resolution cutout of the GitHub avatar and three frontal photos (`selfie`, `pool`, `puppies`). Head tilt and three-quarter poses are only approximated by the axis-aligned anchors, and a three-quarter view steps the far cheek back behind the nose. Frontal, evenly lit, high-resolution photos give the cleanest relief. Transparent cutouts are flattened onto black before matting.
