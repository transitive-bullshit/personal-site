# Faces prototype

`/faces` is a prototype for a future intro splash: a WebGPU particle swarm that assembles into a 3D portrait of Travis, holds, releases and repeats. It is a full-screen black stage over the site shell, excluded from search (`noindex`) and from discovery surfaces, and `faces` is a reserved slug. Browsers without WebGPU see a short notice.

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
- R3F owns the canvas, renderer, camera and frame loop; `createFacesStage` owns the three.js objects so React lint rules stay satisfied.
- `?portrait=<slug>` loads another prepared portrait from `public/faces/<slug>/` for comparison.

## Portrait assets

Each portrait directory holds:

- `portrait.webp`: 512×768 grayscale on pure black. Pixels with every channel below 9 are empty; brighter pixels are sampled, weighted by local contrast.
- `depth.bin`: uint16 little-endian relative inverse depth (near is white) at the same size, described by `depth.json`.
- `features.json`: hand-placed eye, lip and cheek anchors (normalized from the top-left) that refine depth, densify sampling around the eyes, nostrils and mouth, and make the eyes and nose land first.

`scripts/faces/` regenerates them with local models only (MODNet matting and Depth Anything V2 Small, both Apache-2.0). It has its own dependencies, kept out of the site's install:

```sh
npm install --prefix scripts/faces
node scripts/faces/prepare-portrait.mjs <photo> public/faces/travis --review <review-dir>
node scripts/faces/check-portrait.mjs public/faces/travis <review-dir>/matte.png
```

`scripts/faces/portraits/<slug>.json` holds everything photo-specific: crop, grade, shirt mask and the hand-placed anchors. Re-place the anchors for each new photo and check `features-overlay.png` in the review directory. Output is deterministic.

The current portrait comes from the 460 px GitHub avatar, a smiling three-quarter view, so detail is soft and the far cheek steps back behind the nose. A frontal, evenly lit, high-resolution photo on a plain background would give a cleaner relief and a sharper face.
