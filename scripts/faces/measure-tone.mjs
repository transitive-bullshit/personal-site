#!/usr/bin/env node
// Measures face-skin tone percentiles of a prepared portrait, for landmark
// mode's `grade.tone.targets`. The skin region is the one landmark mode matches:
// face-skin class inside the face mesh, above the nose tip, away from the eyes
// and brows (see regionMasks in landmark-mode.mjs).
//
// Usage:
//   node measure-tone.mjs <portraitDir> <landmarksDir> [--config <face.json>]
//                         [--percentiles 5,25,50,75,95]
// <landmarksDir> is landmarks.py's output for the portrait's source photo; the
// config (default portraits/<portraitDir name>.json) supplies the crop.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import sharp from 'sharp'

import {
  autoFeatures,
  loadLandmarks,
  percentilesOver,
  rasteriseMesh,
  regionMasks
} from './landmark-mode.mjs'

const W = 512
const H = 768
const here = path.dirname(fileURLToPath(import.meta.url))
const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: 'string' },
    percentiles: { type: 'string', default: '5,25,50,75,95' }
  }
})
if (positionals.length !== 2) {
  console.error(
    'Usage: node measure-tone.mjs <portraitDir> <landmarksDir> [--config <face.json>] [--percentiles 5,25,50,75,95]'
  )
  process.exit(1)
}
const [portraitDir, marksDir] = positionals.map((p) => path.resolve(p))
const configPath = path.resolve(
  opts.config ??
    path.join(here, 'portraits', `${path.basename(portraitDir)}.json`)
)
const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
const percentiles = opts.percentiles.split(',').map(Number)

const lm = await loadLandmarks(marksDir, config.crop, W, H)
const mesh = rasteriseMesh(lm.points, lm.triangles, W, H)
const regions = regionMasks(lm, mesh, autoFeatures(lm.points, W, H), {}, W, H)
const { data, info } = await sharp(path.join(portraitDir, 'portrait.webp'))
  .raw()
  .toBuffer({ resolveWithObject: true })
const grey = new Float32Array(W * H)
const mask = new Uint8Array(W * H)
let hairSum = 0
let hairN = 0
for (let i = 0; i < W * H; i++) {
  grey[i] = data[i * info.channels]
  // Only sampleable pixels: the fade and the matte edge are not skin tone.
  mask[i] = regions.skin[i] && grey[i] >= 9 ? 1 : 0
  if (regions.hair[i] > 0.9 && grey[i] >= 9) {
    hairSum += grey[i]
    hairN++
  }
}
const values = percentilesOver(grey, mask, percentiles)
let n = 0
for (const v of mask) n += v
const median = percentilesOver(grey, mask, [50])[0]
console.log(`portrait ${portraitDir}`)
console.log(`skin     ${n} px`)
console.log(`p${percentiles.join('/')}  ${values.join('/')}`)
console.log(
  `hair     ${hairN} px, mean ${(hairSum / Math.max(1, hairN)).toFixed(1)} (${(hairSum / Math.max(1, hairN) / median).toFixed(2)}× the skin median)`
)
