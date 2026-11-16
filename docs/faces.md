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
- `features.json`: eye, lip and cheek anchors (normalized from the top-left) that refine depth, densify sampling around the eyes, nostrils and mouth, and make the eyes and nose land first. Hand-placed anchors are axis-aligned; landmark-derived ones carry an `angle` (radians, clockwise on screen) that rotates the ellipse in normalized coordinates: inside when `((dx·cos a + dy·sin a)/rx)² + ((−dx·sin a + dy·cos a)/ry)² < 1`.

`scripts/faces/` regenerates them with local models only (MODNet matting and Depth Anything V2 Small, both Apache-2.0). It has its own dependencies, kept out of the site's install:

```sh
npm install --prefix scripts/faces
node scripts/faces/prepare-portrait.mjs <photo> public/faces/<slug> --review <review-dir>
node scripts/faces/check-portrait.mjs public/faces/<slug> <review-dir>/matte.png
```

`scripts/faces/portraits/<slug>.json` holds everything photo-specific: the crop, base grade and curvature, plus hand-placed anchors and a shirt polygon when a portrait isn't in landmark mode (below). An optional `curvature: { amount, radius }` eases depth back toward the silhouette so the head rounds off; the portraits use `0.4`–`0.5` over `0.2` of the width, tuned so cheek-to-edge and forehead-to-edge relief land near 0.38 and 0.5 in runtime units. Check `features-overlay.png` and `depth-relief.png` in the review directory. Output is deterministic. The source photos are not committed.

The portraits cycle, so keep their framing consistent: eyes at about 42% height, the face about half the image width, and visible pixels spanning roughly 11–77% of the height, because each portrait is scaled by the height of its visible pixels. Match the avatar's face luminance (mean about 120) so the tone doesn't jump between faces.

The `travis-*` portraits come from a high-resolution cutout of the GitHub avatar and three frontal photos (`selfie`, `pool`, `puppies`), all in landmark mode. Frontal, evenly lit, high-resolution photos give the cleanest relief. Transparent cutouts are flattened onto black before matting.

### Landmark mode

A config with `"landmarks": true` derives the photo-specific parts from Google MediaPipe (Apache-2.0, local) instead of hand work; every `travis-*` portrait uses it. Configs without `landmarks` keep the hand-placed pipeline.

```sh
python3 -m venv scripts/faces/.venv
scripts/faces/.venv/bin/pip install -r scripts/faces/requirements.txt
# download the two models named in landmarks.py's header into scripts/faces/models/
scripts/faces/.venv/bin/python scripts/faces/landmarks.py <photo> <photo-dir>/<photo-name>.landmarks
node scripts/faces/prepare-portrait.mjs <photo> public/faces/<slug> --review <review-dir>
```

`landmarks.py` writes `landmarks.json` (478 landmarks, the transformation matrix and the mesh triangles) and `segments.png` (hair, face skin, body skin, clothes, accessories). `landmarks: true` looks for them beside the photo; a path or `--landmarks <dir>` overrides that. `scripts/faces/landmark-mode.mjs` then:

- Places the 20 anchors and the nose guard from landmark indices, sized by eye width, inter-ocular distance and mouth width, and rotated with the eye line or the mouth line. Amounts match `travis-selfie`; `landmarks.features["<name>"]` overrides `amount`, `center`, `radius`, `angle`, `offset` or `scale`.
- Rasterizes the face mesh's depth and fuses it with the depth model: the mesh supplies everything coarser than 5 px inside the face, the model the finer skin and beard detail, and outside the face the correction carries on from the face edge into hair and ears. The depth model reads head-on faces as flat (on `travis-selfie`, fitting the mesh to it by least squares, `calibration: "fit"`, gives under half the anatomical relief), so by default (`landmarks.mesh.calibration: "anatomical"`) the mesh keeps the same scale as the face's width at runtime. A light `curvature` can still round the skull and hair.
- Replaces the body polygon with the segmentation: clothes, neck and shoulder skin, accessories outside the face and background away from the head go black, with the matte's soft edge kept next to hair and face.
- Grades by region when `grade.tone` is set: levels come from the face, and one monotone curve maps the skin's percentiles to `grade.tone.targets`. `grade.hair.ratio` sets the hair's own gain so its mean is that fraction of the skin median, kept within `grade.hair.range` (default 0.6–1.3) so sunlit or backlit hair can't swing too far. The targets come from the approved avatar via `node scripts/faces/measure-tone.mjs public/faces/travis-avatar <avatar>.landmarks` (skin: face-skin class inside the mesh, above the nose tip, outside the eyes and brows).

The review directory adds `landmarks.png`, `segments-overlay.png`, `mesh-depth.png`, `mesh-relief.png`, `model-relief.png`, `mesh-correction.png` and `tone-skin.png`.
