#!/usr/bin/env node
// Verifies a particle-portrait asset directory.
// Usage: node check-portrait.mjs <outDir> [matte.png]
// matte.png is the review matte written by prepare-portrait.mjs; with it the
// background check uses the subject matte, without it only the frame margins.

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const [dir, mattePath] = process.argv.slice(2)
if (!dir) {
  console.error('Usage: node check-portrait.mjs <outDir> [matte.png]')
  process.exit(1)
}

const W = 512
const H = 768
const THRESHOLD = 9
let failures = 0
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`)
  if (!ok) failures++
}

const depthBin = await fs.readFile(path.join(dir, 'depth.bin'))
check(
  depthBin.length === W * H * 2,
  `depth.bin is ${depthBin.length} bytes (expected ${W * H * 2})`
)

const webp = await fs.readFile(path.join(dir, 'portrait.webp'))
const { data, info } = await sharp(webp)
  .raw()
  .toBuffer({ resolveWithObject: true })
check(
  info.width === W && info.height === H,
  `portrait.webp decodes to ${info.width}×${info.height}`
)
const C = info.channels
const maxAt = (i) => Math.max(data[i * C], data[i * C + 1], data[i * C + 2])

let grey = true
for (let i = 0; i < W * H && grey; i++)
  grey = data[i * C] === data[i * C + 1] && data[i * C + 1] === data[i * C + 2]
check(grey, 'portrait is greyscale (R = G = B)')

// Background: outside the subject matte, and the frame below 85% height.
if (mattePath) {
  const matte = await sharp(mattePath).greyscale().raw().toBuffer()
  let n = 0
  let bad = 0
  let worst = 0
  for (let i = 0; i < W * H; i++) {
    if (matte[i] >= 13) continue // alpha < 0.05 is background
    n++
    const m = maxAt(i)
    worst = Math.max(worst, m)
    if (m >= THRESHOLD) bad++
  }
  check(
    bad === 0,
    `${n} background pixels (matte < 0.05): ${bad} at or above ${THRESHOLD}, brightest ${worst}`
  )
}
let lowBad = 0
for (let y = Math.round(H * 0.85); y < H; y++)
  for (let x = 0; x < W; x++) if (maxAt(y * W + x) >= THRESHOLD) lowBad++
check(
  lowBad === 0,
  `rows below 85% height: ${lowBad} pixels at or above ${THRESHOLD}`
)

// Sampleable pixels should form one region (no stray specks).
const visible = new Uint8Array(W * H)
let x0 = W
let x1 = -1
let y0 = H
let y1 = -1
let count = 0
for (let i = 0; i < W * H; i++) {
  if (maxAt(i) < THRESHOLD) continue
  visible[i] = 1
  count++
  const x = i % W
  const y = (i - x) / W
  x0 = Math.min(x0, x)
  x1 = Math.max(x1, x)
  y0 = Math.min(y0, y)
  y1 = Math.max(y1, y)
}
const seen = new Uint8Array(W * H)
const sizes = []
for (let s = 0; s < W * H; s++) {
  if (!visible[s] || seen[s]) continue
  let size = 0
  const stack = [s]
  seen[s] = 1
  while (stack.length) {
    const i = stack.pop()
    size++
    const x = i % W
    const y = (i - x) / W
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
        const j = yy * W + xx
        if (visible[j] && !seen[j]) {
          seen[j] = 1
          stack.push(j)
        }
      }
    }
  }
  sizes.push(size)
}
sizes.sort((a, b) => b - a)
check(
  sizes.length >= 1 && sizes.slice(1).every((s) => s < 64),
  `visible regions: ${sizes.length} (largest ${sizes[0]}, others ${sizes.slice(1, 6).join(', ') || 'none'})`
)
console.log(
  `     ${count} sampleable pixels (${((100 * count) / (W * H)).toFixed(1)}%), bbox x ${(x0 / W).toFixed(3)}–${((x1 + 1) / W).toFixed(3)}, y ${(y0 / H).toFixed(3)}–${((y1 + 1) / H).toFixed(3)}`
)

// Metadata.
const sha = crypto.createHash('sha256').update(webp).digest('hex')
const depthJson = JSON.parse(
  await fs.readFile(path.join(dir, 'depth.json'), 'utf8')
)
const features = JSON.parse(
  await fs.readFile(path.join(dir, 'features.json'), 'utf8')
)
check(
  depthJson.width === W &&
    depthJson.height === H &&
    depthJson.encoding === 'uint16-le' &&
    depthJson.nearIsWhite === true,
  'depth.json width/height/encoding/nearIsWhite'
)
check(
  depthJson.refinement?.sourceImageSha256 === sha,
  'depth.json refinement.sourceImageSha256 matches portrait.webp'
)
check(
  features.sourceImageSha256 === sha,
  'features.json sourceImageSha256 matches portrait.webp'
)
check(
  depthJson.refinement?.features === 'features.json',
  'depth.json refinement.features'
)
const names = features.features.map((f) => f.name)
check(
  names.length === 20 &&
    new Set(names).size === 20 &&
    JSON.stringify(depthJson.refinement.regions) === JSON.stringify(names),
  '20 unique feature names, listed in depth.json regions'
)
const byName = Object.fromEntries(features.features.map((f) => [f.name, f]))
check(
  byName['left eye socket'].center[0] < byName['right eye socket'].center[0],
  'left eye x < right eye x (image-left convention)'
)
check(
  features.features.every(
    (f) => f.center.every((v) => v > 0 && v < 1) && f.radius.every((v) => v > 0)
  ),
  'feature centres inside the frame, radii positive'
)

let lo = 65535
let hi = 0
for (let i = 0; i < W * H; i++) {
  const v = depthBin.readUInt16LE(i * 2)
  lo = Math.min(lo, v)
  hi = Math.max(hi, v)
}
check(lo === 0 && hi === 65535, `depth fills the uint16 range (${lo}–${hi})`)

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)
