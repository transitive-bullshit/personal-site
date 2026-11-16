#!/usr/bin/env node
// Prepares particle-portrait assets from one photo, entirely locally:
//   portrait.webp  512×768 low-key greyscale portrait on pure black
//   depth.bin      uint16-le relative inverse depth (near = white), refined by features
//   depth.json     depth metadata
//   features.json  hand-placed facial anchors (from the face config)
//
// Usage:
//   node prepare-portrait.mjs <photo> <outDir> [--config portraits/<name>.json]
//                             [--review <dir>] [--reference <portrait.png>]
//
// The face config holds everything photo-specific: the crop rectangle in source
// pixels, grade/fade overrides and the hand-placed feature anchors in normalised
// portrait coordinates. Swap in a better photo by writing a new config.

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env
} from '@huggingface/transformers'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
env.cacheDir = path.join(here, '.cache')

const W = 512
const H = 768
// The sampler treats pixels whose max RGB channel is below 9 as empty.
const THRESHOLD = 9
const SNAP = 12

// Pinned open models. Both are Apache-2.0.
const MATTE_MODEL = {
  id: 'Xenova/modnet',
  revision: 'fa2fa546052fba4c08921230a26cc69a333fca12'
}
const DEPTH_MODEL = {
  id: 'onnx-community/depth-anything-v2-small',
  revision: '4472b7362082ad9968fee890ca0f1e5aca36b93d'
}

const FEATURE_NAMES = [
  'left eye socket',
  'right eye socket',
  'left eye curvature',
  'right eye curvature',
  'left upper eyelid',
  'right upper eyelid',
  'left cheek contour',
  'right cheek contour',
  'upper lip',
  'lip separation',
  'lower lip',
  'left mouth corner',
  'right mouth corner',
  'left lower eyelid',
  'left orbital rim',
  'right lower eyelid',
  'right orbital rim',
  'under lower lip',
  'left upper lip ridge',
  'right upper lip ridge'
]

const DEFAULT_GRADE = {
  // Greyscale channel mix (applied to sRGB-encoded values).
  mix: [0.42, 0.46, 0.12],
  // Levels from face statistics: percentiles mapped to black and white.
  blackPercentile: 0.5,
  whitePercentile: 99.6,
  // Large-radius local contrast ("clarity") and fine sharpening.
  clarity: { sigma: 18, amount: 0.45 },
  sharpen: { sigma: 1.1, amount: 0.35 },
  // Midtone gamma (>1 darkens) and S-curve strength (0..1).
  gamma: 1.15,
  contrast: 0.35,
  // Shadow toe inside the subject, and the brightest output value (the
  // reference tops out around 218).
  shadowFloor: 0.07,
  white: 0.86,
  // Elliptical light falloff centred on the face.
  light: {
    center: [0.5, 0.42],
    radius: [0.36, 0.42],
    inner: 0.55,
    outer: 1.15,
    amount: 0.45
  },
  // Darken the parts of the head that recede (ears, back of head) using depth.
  depthShade: { from: 0.45, to: 0.85, amount: 0.3 },
  // Darken a band along the silhouette.
  rim: { sigma: 10, amount: 0.3 },
  // Shirt and shoulders: a feathered polygon (normalised) that is stripped of
  // thin bright lines (the necklace) and dimmed to black.
  body: { polygon: [], feather: 10, edge: [0.2, 0.7], dim: 1, openRadius: 3 },
  // Everything fades to black between these heights.
  fade: { start: 0.7, end: 0.83 }
}

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: 'string' },
    review: { type: 'string' },
    reference: { type: 'string' },
    quality: { type: 'string', default: '92' }
  }
})

if (positionals.length !== 2) {
  console.error(
    'Usage: node prepare-portrait.mjs <photo> <outDir> [--config <face.json>] [--review <dir>] [--reference <png>]'
  )
  process.exit(1)
}

const [photoPath, outDir] = positionals.map((p) => path.resolve(p))
const configPath = path.resolve(
  opts.config ?? path.join(here, 'portraits', `${path.basename(outDir)}.json`)
)
const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
const grade = mergeDeep(structuredClone(DEFAULT_GRADE), config.grade ?? {})
validateFeatures(config)

console.log(`photo   ${photoPath}`)
console.log(`config  ${configPath}`)
console.log(`output  ${outDir}`)

// 1. Load the photo and matte it.
const src = await sharp(photoPath)
  .rotate()
  .toColourspace('srgb')
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const SW = src.info.width
const SH = src.info.height
const srcRgb = new Uint8ClampedArray(
  src.data.buffer,
  src.data.byteOffset,
  src.data.length
)
const alphaSrc = await estimateMatte(srcRgb, SW, SH)
const fgSrc = estimateForeground(srcRgb, alphaSrc, SW, SH, 6)

// 2. Crop to 2:3 around the head and upscale.
const { colour, alpha } = cropAndResize(fgSrc, alphaSrc, SW, SH, config.crop)

// 3. Depth on the cropped colour image (matted on black), before grading.
const colourOnBlack = new Uint8ClampedArray(W * H * 3)
for (let i = 0; i < W * H; i++) {
  for (let c = 0; c < 3; c++)
    colourOnBlack[i * 3 + c] = Math.round(colour[i * 3 + c] * alpha[i] * 255)
}
const rawDepth = await estimateDepth(colourOnBlack)
const depth = normalise(rawDepth)

// 4. Grade.
const portrait = gradePortrait(colour, alpha, depth, grade)
const grey = quantisePortrait(portrait)
const portraitU8 = new Uint8Array(W * H * 3)
for (let i = 0; i < W * H; i++)
  portraitU8[i * 3] = portraitU8[i * 3 + 1] = portraitU8[i * 3 + 2] = grey[i]
await fs.mkdir(outDir, { recursive: true })
const webp = await encodeWebp(portraitU8)
const portraitPath = path.join(outDir, 'portrait.webp')
await fs.writeFile(portraitPath, webp)
const portraitSha = crypto.createHash('sha256').update(webp).digest('hex')

// 5. Stretch the depth to 0–1: the farthest pixel maps to 0 and the nearest
// pixel the sampler can see (portrait value >= 9) maps to 1, as on the
// reference where the nose is white. Hidden pixels nearer than that (the
// faded-out shirt) clip to 1. Then add the bounded feature refinement.
const visible = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) visible[i] = grey[i] >= THRESHOLD ? 1 : 0
const depthFinal = stretchDepth(rawDepth, visible)
const maxAdjust = 0.04
const adjustment = featureAdjustment(config, maxAdjust)
const refined = new Float32Array(W * H)
for (let i = 0; i < W * H; i++)
  refined[i] = clamp01(depthFinal[i] + adjustment[i])
const depthBin = Buffer.alloc(W * H * 2)
for (let i = 0; i < W * H; i++)
  depthBin.writeUInt16LE(Math.round(refined[i] * 65535), i * 2)
await fs.writeFile(path.join(outDir, 'depth.bin'), depthBin)

const features = {
  sourceImageSha256: portraitSha,
  description:
    'Manually placed anchors for this portrait, normalized from its top-left corner. These refine inferred depth; they are not measured geometry.',
  noseGuard: {
    center: round3(config.noseGuard.center),
    radius: round3(config.noseGuard.radius)
  },
  features: config.features.map((f) => ({
    name: f.name,
    center: round3(f.center),
    radius: f.radius.map((v) => Number(v.toFixed(4))),
    amount: Number(f.amount.toFixed(4))
  }))
}
await writeJson(path.join(outDir, 'features.json'), features)
await writeJson(path.join(outDir, 'depth.json'), {
  width: W,
  height: H,
  model: DEPTH_MODEL.id,
  revision: DEPTH_MODEL.revision,
  encoding: 'uint16-le',
  nearIsWhite: true,
  description: 'Estimated relative inverse depth, not metric geometry.',
  refinement: {
    method: 'Bounded, manually anchored local facial relief',
    sourceImageSha256: portraitSha,
    features: 'features.json',
    maximumDepthAdjustment: maxAdjust,
    regions: features.features.map((f) => f.name)
  }
})

let maxAbs = 0
for (const v of adjustment) maxAbs = Math.max(maxAbs, Math.abs(v))
console.log(`portrait.webp ${webp.length} bytes, sha256 ${portraitSha}`)
console.log(
  `depth.bin ${depthBin.length} bytes, max |adjustment| ${maxAbs.toFixed(4)}`
)

// 6. Review images.
if (opts.review) {
  const reviewDir = path.resolve(opts.review)
  await fs.mkdir(reviewDir, { recursive: true })
  const decoded = await sharp(webp).raw().toBuffer()
  await sharp(decoded, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toFile(path.join(reviewDir, 'portrait.png'))
  await saveGrey(refined, path.join(reviewDir, 'depth.png'))
  await saveGrey(
    hillshade(refined, visible),
    path.join(reviewDir, 'depth-relief.png')
  )
  await saveGrey(
    adjustment.map((v) => 0.5 + v / (2 * maxAdjust)),
    path.join(reviewDir, 'depth-adjustment.png')
  )
  await saveGrey(alpha, path.join(reviewDir, 'matte.png'))
  await saveGrey(visible, path.join(reviewDir, 'visible.png'))
  await sharp(Buffer.from(colourOnBlack), {
    raw: { width: W, height: H, channels: 3 }
  })
    .png()
    .toFile(path.join(reviewDir, 'crop-colour.png'))
  await renderFeatureOverlay(
    decoded,
    features,
    path.join(reviewDir, 'features-overlay.png')
  )
  if (opts.reference) {
    await renderSideBySide(
      opts.reference,
      decoded,
      path.join(reviewDir, 'side-by-side.png')
    )
  }
  console.log(`review  ${reviewDir}`)
}

// ---------------------------------------------------------------------------

// Quantise so that every pixel is either 0 or at least SNAP: lossy WebP error
// then cannot move a pixel across the sampler threshold. Also drop specks
// that are not part of the subject.
function quantisePortrait(values) {
  const grey = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(values[i] * 255)
    grey[i] = v < THRESHOLD ? 0 : Math.max(SNAP, v)
  }
  const labels = new Int32Array(W * H).fill(-1)
  const sizes = []
  const stack = []
  for (let start = 0; start < W * H; start++) {
    if (!grey[start] || labels[start] >= 0) continue
    const id = sizes.length
    let size = 0
    labels[start] = id
    stack.push(start)
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
          if (grey[j] && labels[j] < 0) {
            labels[j] = id
            stack.push(j)
          }
        }
      }
    }
    sizes.push(size)
  }
  const largest = Math.max(...sizes)
  let dropped = 0
  for (let i = 0; i < W * H; i++) {
    if (grey[i] && sizes[labels[i]] < Math.max(64, largest * 0.002)) {
      grey[i] = 0
      dropped++
    }
  }
  console.log(
    `grade   ${sizes.length} visible regions, dropped ${dropped} px of specks`
  )
  return grey
}

// Lossy WebP, verified to keep exactly the same set of sampleable pixels;
// falls back to lossless if it does not.
async function encodeWebp(rgb) {
  const quality = Number(opts.quality)
  const lossy = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality, effort: 6 })
    .toBuffer()
  const decoded = await sharp(lossy).raw().toBuffer({ resolveWithObject: true })
  const c = decoded.info.channels
  let flipped = 0
  for (let i = 0; i < W * H; i++) {
    const m = Math.max(
      decoded.data[i * c],
      decoded.data[i * c + 1],
      decoded.data[i * c + 2]
    )
    if (m >= THRESHOLD !== rgb[i * 3] >= THRESHOLD) flipped++
  }
  if (flipped === 0) {
    console.log(`webp    lossy q${quality}, threshold mask preserved`)
    return lossy
  }
  console.log(
    `webp    lossy q${quality} flipped ${flipped} px across the threshold; using lossless`
  )
  return sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer()
}

// Load a pinned model from the local cache, downloading it once if needed.
async function loadModel({ id, revision }) {
  const load = () =>
    Promise.all([
      AutoModel.from_pretrained(id, { dtype: 'fp32', revision }),
      AutoProcessor.from_pretrained(id, { revision })
    ])
  env.allowRemoteModels = false
  try {
    return await load()
  } catch {
    env.allowRemoteModels = true
    return await load()
  }
}

async function estimateMatte(rgb, width, height) {
  const [model, processor] = await loadModel(MATTE_MODEL)
  const image = new RawImage(rgb, width, height, 3)
  const { pixel_values } = await processor(image)
  const { output } = await model({ input: pixel_values })
  const [, , mh, mw] = output.dims
  const matte = resizeBilinear(
    Float32Array.from(output.data),
    mw,
    mh,
    width,
    height
  )
  return matte.map(clamp01)
}

// Recover foreground colour at soft matte edges so the warm background does
// not leave a bright fringe: I = a·F + (1 − a)·B, with B estimated locally.
function estimateForeground(rgb, alpha, width, height, sigma) {
  const n = width * height
  const inv = new Float32Array(n)
  for (let i = 0; i < n; i++) inv[i] = 1 - alpha[i]
  const invBlur = gaussianBlur(inv, width, height, sigma)
  const fg = new Float32Array(n * 3)
  for (let c = 0; c < 3; c++) {
    const weighted = new Float32Array(n)
    for (let i = 0; i < n; i++) weighted[i] = (rgb[i * 3 + c] / 255) * inv[i]
    const bg = gaussianBlur(weighted, width, height, sigma)
    for (let i = 0; i < n; i++) {
      const I = rgb[i * 3 + c] / 255
      const a = alpha[i]
      const B = invBlur[i] > 1e-4 ? bg[i] / invBlur[i] : I
      fg[i * 3 + c] =
        a > 0.98 ? I : a < 0.02 ? 0 : clamp01((I - (1 - a) * B) / a)
    }
  }
  return fg
}

// Crop a 2:3 rectangle given in source pixels (it may extend past the photo;
// the outside is transparent black) and upscale it to W×H with Lanczos-3.
function cropAndResize(fg, alpha, width, height, crop) {
  const cw = crop.width
  const ch = Math.round(crop.width * 1.5)
  const rgba = new Float32Array(cw * ch * 4)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const sx = x + crop.left
      const sy = y + crop.top
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
      const s = sy * width + sx
      const d = (y * cw + x) * 4
      const a = alpha[s]
      // Premultiply so resampling does not bleed colour from transparent pixels.
      rgba[d] = fg[s * 3] * a
      rgba[d + 1] = fg[s * 3 + 1] * a
      rgba[d + 2] = fg[s * 3 + 2] * a
      rgba[d + 3] = a
    }
  }
  const scaled = new Float32Array(W * H * 4)
  for (let c = 0; c < 4; c++) {
    const plane = new Float32Array(cw * ch)
    for (let i = 0; i < cw * ch; i++) plane[i] = rgba[i * 4 + c]
    const out = resizeLanczos(plane, cw, ch, W, H)
    for (let i = 0; i < W * H; i++) scaled[i * 4 + c] = out[i]
  }
  const colour = new Float32Array(W * H * 3)
  const a = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const ai = clamp01(scaled[i * 4 + 3])
    a[i] = ai
    for (let c = 0; c < 3; c++) {
      colour[i * 3 + c] = ai > 1e-3 ? clamp01(scaled[i * 4 + c] / ai) : 0
    }
  }
  return { colour, alpha: a }
}

async function estimateDepth(rgb) {
  const [model, processor] = await loadModel(DEPTH_MODEL)
  const image = new RawImage(rgb, W, H, 3)
  const { pixel_values } = await processor(image)
  const { predicted_depth } = await model({ pixel_values })
  const dims = predicted_depth.dims
  const dh = dims.at(-2)
  const dw = dims.at(-1)
  console.log(
    `depth   model input ${pixel_values.dims.join('×')}, output ${dw}×${dh}`
  )
  return resizeBilinear(Float32Array.from(predicted_depth.data), dw, dh, W, H)
}

function gradePortrait(colour, alpha, depth, g) {
  const n = W * H
  let L = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    L[i] =
      g.mix[0] * colour[i * 3] +
      g.mix[1] * colour[i * 3 + 1] +
      g.mix[2] * colour[i * 3 + 2]
  }

  // Levels from the well-matted face area.
  const samples = []
  for (let i = 0; i < n; i++)
    if (alpha[i] > 0.95 && lightMask(i, g.light) > 0.7) samples.push(L[i])
  samples.sort((a, b) => a - b)
  const lo =
    samples[Math.floor((samples.length - 1) * (g.blackPercentile / 100))]
  const hi =
    samples[Math.floor((samples.length - 1) * (g.whitePercentile / 100))]
  for (let i = 0; i < n; i++) L[i] = (L[i] - lo) / (hi - lo)

  // Local contrast, computed on the matted image so the edge does not glow.
  const matted = L.map((v, i) => v * alpha[i])
  const wide = gaussianBlur(matted, W, H, g.clarity.sigma)
  const wideA = gaussianBlur(alpha, W, H, g.clarity.sigma)
  const fine = gaussianBlur(L, W, H, g.sharpen.sigma)
  for (let i = 0; i < n; i++) {
    const base = wideA[i] > 1e-3 ? wide[i] / wideA[i] : L[i]
    L[i] =
      L[i] +
      g.clarity.amount * (L[i] - base) +
      g.sharpen.amount * (L[i] - fine[i])
  }

  // Tone: gamma for midtones, then a gentle S-curve.
  for (let i = 0; i < n; i++) {
    let v = clamp01(L[i]) ** g.gamma
    const s = v * v * (3 - 2 * v)
    v = v + g.contrast * (s - v)
    // Toe: lift the deepest shadows (beard, moustache) so they stay sampleable.
    L[i] = g.shadowFloor + (1 - g.shadowFloor) * v
  }

  // Low-key lighting: elliptical falloff, depth-based shading and a soft
  // darkening along the silhouette, as if the surface turns away from the light.
  const rim = gaussianBlur(alpha, W, H, g.rim.sigma)
  for (let i = 0; i < n; i++) {
    const light = 1 - g.light.amount * (1 - lightMask(i, g.light))
    const ds = smoothstep(g.depthShade.from, g.depthShade.to, depth[i])
    const shade = 1 - g.depthShade.amount * (1 - ds)
    const edge = 1 - g.rim.amount * (1 - smoothstep(0.45, 0.95, rim[i]))
    L[i] *= light * shade * edge
  }

  // Body: remove thin bright lines (necklace) and dim the shirt.
  if (g.body.polygon.length >= 3) {
    // Feathered, with the transition biased just outside the polygon so the
    // shirt right next to the beard is fully dimmed.
    const [e0, e1] = g.body.edge
    const mask = gaussianBlur(
      rasterPolygon(g.body.polygon),
      W,
      H,
      g.body.feather
    ).map((v) => smoothstep(e0, e1, v))
    const opened = dilate(
      erode(L, W, H, g.body.openRadius),
      W,
      H,
      g.body.openRadius
    )
    for (let i = 0; i < n; i++) {
      const m = mask[i]
      const v = L[i] + m * (Math.min(L[i], opened[i]) - L[i])
      L[i] = v * (1 - g.body.dim * m)
    }
  }

  // Vertical fade to black.
  for (let i = 0; i < n; i++) {
    const y = (Math.floor(i / W) + 0.5) / H
    L[i] *= 1 - smoothstep(g.fade.start, g.fade.end, y)
  }

  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = clamp01(L[i]) * g.white * alpha[i]
  }
  return out
}

function lightMask(i, light) {
  const x = ((i % W) + 0.5) / W
  const y = (Math.floor(i / W) + 0.5) / H
  const d = Math.hypot(
    (x - light.center[0]) / light.radius[0],
    (y - light.center[1]) / light.radius[1]
  )
  return 1 - smoothstep(light.inner, light.outer, d)
}

function featureAdjustment(cfg, limit) {
  const out = new Float32Array(W * H)
  const guard = cfg.noseGuard
  for (let y = 0; y < H; y++) {
    const ny = (y + 0.5) / H
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W
      let sum = 0
      for (const f of cfg.features) {
        const q =
          ((nx - f.center[0]) / f.radius[0]) ** 2 +
          ((ny - f.center[1]) / f.radius[1]) ** 2
        if (q < 16) sum += f.amount * Math.exp(-0.5 * q)
      }
      const gq =
        ((nx - guard.center[0]) / guard.radius[0]) ** 2 +
        ((ny - guard.center[1]) / guard.radius[1]) ** 2
      sum *= 1 - Math.exp(-0.5 * gq)
      out[y * W + x] = limit * Math.tanh(sum / limit)
    }
  }
  return out
}

function validateFeatures(cfg) {
  const names = cfg.features.map((f) => f.name)
  const missing = FEATURE_NAMES.filter((n) => !names.includes(n))
  const extra = names.filter((n) => !FEATURE_NAMES.includes(n))
  if (missing.length || extra.length || names.length !== FEATURE_NAMES.length) {
    throw new Error(
      `Feature names mismatch. Missing: ${missing.join(', ')}; unexpected: ${extra.join(', ')}`
    )
  }
  if (!cfg.noseGuard?.center || !cfg.noseGuard?.radius)
    throw new Error('noseGuard is required')
}

// --- image helpers ----------------------------------------------------------

function gaussianBlur(src, width, height, sigma) {
  if (sigma <= 0) return Float32Array.from(src)
  const r = Math.ceil(sigma * 3)
  const k = new Float32Array(r * 2 + 1)
  let sum = 0
  for (let i = -r; i <= r; i++)
    sum += k[i + r] = Math.exp((-i * i) / (2 * sigma * sigma))
  for (let i = 0; i < k.length; i++) k[i] /= sum
  const tmp = new Float32Array(width * height)
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0
      for (let i = -r; i <= r; i++)
        acc +=
          k[i + r] * src[y * width + Math.min(width - 1, Math.max(0, x + i))]
      tmp[y * width + x] = acc
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0
      for (let i = -r; i <= r; i++)
        acc +=
          k[i + r] * tmp[Math.min(height - 1, Math.max(0, y + i)) * width + x]
      out[y * width + x] = acc
    }
  }
  return out
}

function morph(src, width, height, radius, pick) {
  const out = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = src[y * width + x]
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = Math.min(height - 1, Math.max(0, y + dy))
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius + radius) continue
          const xx = Math.min(width - 1, Math.max(0, x + dx))
          v = pick(v, src[yy * width + xx])
        }
      }
      out[y * width + x] = v
    }
  }
  return out
}
function erode(src, width, height, radius) {
  return morph(src, width, height, radius, Math.min)
}

function dilate(src, width, height, radius) {
  return morph(src, width, height, radius, Math.max)
}

function rasterPolygon(points) {
  const out = new Float32Array(W * H)
  const pts = points.map(([x, y]) => [x * W, y * H])
  for (let y = 0; y < H; y++) {
    const py = y + 0.5
    for (let x = 0; x < W; x++) {
      const px = x + 0.5
      let inside = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]
        const [xj, yj] = pts[j]
        if (
          yi > py !== yj > py &&
          px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
        )
          inside = !inside
      }
      out[y * W + x] = inside ? 1 : 0
    }
  }
  return out
}

function resizeBilinear(src, sw, sh, dw, dh) {
  const out = new Float32Array(dw * dh)
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(sh - 1, Math.max(0, ((y + 0.5) * sh) / dh - 0.5))
    const y0 = Math.floor(fy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < dw; x++) {
      const fx = Math.min(sw - 1, Math.max(0, ((x + 0.5) * sw) / dw - 0.5))
      const x0 = Math.floor(fx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const tx = fx - x0
      const a = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx
      const b = src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx
      out[y * dw + x] = a * (1 - ty) + b * ty
    }
  }
  return out
}

// Separable Lanczos-3 resampling of a float plane (used for the upscale).
function resizeLanczos(src, sw, sh, dw, dh) {
  const lanczos = (x) => {
    if (x === 0) return 1
    if (Math.abs(x) >= 3) return 0
    const px = Math.PI * x
    return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px)
  }
  const pass = (input, inW, inH, outW, outH, horizontal) => {
    const out = new Float32Array(outW * outH)
    const inLen = horizontal ? inW : inH
    const outLen = horizontal ? outW : outH
    const scale = inLen / outLen
    const support = 3 * Math.max(1, scale)
    const weights = []
    for (let o = 0; o < outLen; o++) {
      const centre = (o + 0.5) * scale - 0.5
      const start = Math.floor(centre - support)
      const end = Math.ceil(centre + support)
      const ws = []
      let sum = 0
      for (let s = start; s <= end; s++) {
        const w = lanczos((s - centre) / Math.max(1, scale))
        ws.push([Math.min(inLen - 1, Math.max(0, s)), w])
        sum += w
      }
      weights.push(ws.map(([s, w]) => [s, w / sum]))
    }
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        let acc = 0
        if (horizontal)
          for (const [s, w] of weights[x]) acc += w * input[y * inW + s]
        else for (const [s, w] of weights[y]) acc += w * input[s * inW + x]
        out[y * outW + x] = acc
      }
    }
    return out
  }
  const h = pass(src, sw, sh, dw, sh, true)
  return pass(h, dw, sh, dw, dh, false)
}

function stretchDepth(src, visible) {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < src.length; i++) {
    lo = Math.min(lo, src[i])
    if (visible[i]) hi = Math.max(hi, src[i])
  }
  return src.map((v) => clamp01((v - lo) / (hi - lo)))
}

// Raking-light rendering of the depth surface, to judge facial relief.
function hillshade(d, visible) {
  const out = new Float32Array(W * H)
  const k = 90
  const l = [-0.5, -0.6, 0.62]
  const ln = Math.hypot(...l)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const dx = (d[i + 1] - d[i - 1]) * k
      const dy = (d[i + W] - d[i - W]) * k
      const n = Math.hypot(dx, dy, 1)
      const shade = Math.max(0, (-dx * l[0] - dy * l[1] + l[2]) / (n * ln))
      out[i] = (0.1 + 0.9 * shade) * (visible[i] ? 1 : 0.35)
    }
  }
  return out
}

function normalise(src) {
  let lo = Infinity
  let hi = -Infinity
  for (const v of src) {
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  return src.map((v) => (v - lo) / (hi - lo))
}

async function saveGrey(values, file) {
  const buf = Buffer.alloc(W * H)
  for (let i = 0; i < W * H; i++) buf[i] = Math.round(clamp01(values[i]) * 255)
  await sharp(buf, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toFile(file)
}

async function renderFeatureOverlay(rgb, feats, file) {
  const S = 2
  const PW = W * S
  const PH = H * S
  const LEG = 360
  const items = [
    ...feats.features.map((f, i) => ({ ...f, id: String(i + 1) })),
    {
      name: 'nose guard',
      id: 'N',
      center: feats.noseGuard.center,
      radius: feats.noseGuard.radius,
      amount: 0
    }
  ]
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW + LEG}" height="${PH}" font-family="Menlo, monospace">`
  svg += `<rect x="${PW}" y="0" width="${LEG}" height="${PH}" fill="#111"/>`
  for (const f of items) {
    const colour =
      f.id === 'N' ? '#ffd400' : f.amount < 0 ? '#38d6ff' : '#ff7a3d'
    const cx = f.center[0] * PW
    const cy = f.center[1] * PH
    const rx = f.radius[0] * PW
    const ry = f.radius[1] * PH
    const dash = f.id === 'N' ? ' stroke-dasharray="6 4"' : ''
    svg += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${colour}" stroke-width="1.5" stroke-opacity="0.9"${dash}/>`
    svg += `<circle cx="${cx}" cy="${cy}" r="2" fill="${colour}"/>`
  }
  // Labels: greedy placement around each anchor, avoiding earlier labels and
  // anchor points in the dense eye and mouth clusters.
  const placed = items.map((f) => ({
    x: f.center[0] * PW,
    y: f.center[1] * PH,
    w: 6,
    h: 6
  }))
  const hits = (b) =>
    placed.some(
      (p) =>
        Math.abs(p.x - b.x) * 2 < p.w + b.w &&
        Math.abs(p.y - b.y) * 2 < p.h + b.h
    )
  items.forEach((f) => {
    const colour =
      f.id === 'N' ? '#ffd400' : f.amount < 0 ? '#38d6ff' : '#ff7a3d'
    const cx = f.center[0] * PW
    const cy = f.center[1] * PH
    const box = { x: cx, y: cy + 30, w: 8 * f.id.length + 6, h: 16 }
    search: for (const r of [26, 40, 56, 72, 90, 110]) {
      for (let a = 0; a < 16; a++) {
        const ang = (a * Math.PI) / 8 + Math.PI / 2
        const candidate = {
          ...box,
          x: cx + Math.cos(ang) * r * 1.3,
          y: cy + Math.sin(ang) * r
        }
        if (!hits(candidate)) {
          Object.assign(box, candidate)
          break search
        }
      }
    }
    placed.push(box)
    const lx = box.x
    const ly = box.y
    svg += `<line x1="${cx}" y1="${cy}" x2="${lx}" y2="${ly}" stroke="${colour}" stroke-width="0.8" stroke-opacity="0.7"/>`
    svg += `<text x="${lx}" y="${ly + 4}" font-size="12" font-weight="bold" fill="${colour}" text-anchor="middle" stroke="#000" stroke-width="3" paint-order="stroke">${f.id}</text>`
  })
  items.forEach((f, k) => {
    const colour =
      f.id === 'N' ? '#ffd400' : f.amount < 0 ? '#38d6ff' : '#ff7a3d'
    const y = 28 + k * 22
    const amt =
      f.id === 'N' ? '' : (f.amount > 0 ? '+' : '') + f.amount.toFixed(4)
    svg += `<text x="${PW + 12}" y="${y}" font-size="12" fill="${colour}">${f.id.padStart(2)} ${f.name}</text>`
    svg += `<text x="${PW + LEG - 12}" y="${y}" font-size="12" fill="#bbb" text-anchor="end">${amt}</text>`
    svg += `<text x="${PW + 12}" y="${y + 11}" font-size="9" fill="#777">c ${f.center.map((v) => v.toFixed(3)).join(', ')}  r ${f.radius.map((v) => v.toFixed(3)).join(', ')}</text>`
  })
  svg += '</svg>'
  const base = await sharp(Buffer.from(rgb), {
    raw: { width: W, height: H, channels: 3 }
  })
    .resize(PW, PH, { kernel: 'lanczos3' })
    .extend({ right: LEG, background: '#111' })
    .png()
    .toBuffer()
  await sharp(base)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toFile(file)
}

async function renderSideBySide(referencePath, rgb, file) {
  const gap = 16
  const ref = await sharp(referencePath)
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .png()
    .toBuffer()
  const ours = await sharp(Buffer.from(rgb), {
    raw: { width: W, height: H, channels: 3 }
  })
    .png()
    .toBuffer()
  let guides = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2 + gap}" height="${H}">`
  for (const [y, label] of [
    [0.42, 'eyes 42%'],
    [0.83, 'fade 83%']
  ]) {
    for (const x0 of [0, W + gap]) {
      guides += `<line x1="${x0}" y1="${y * H}" x2="${x0 + 14}" y2="${y * H}" stroke="#ff4d4d" stroke-width="2"/>`
      guides += `<line x1="${x0 + W - 14}" y1="${y * H}" x2="${x0 + W}" y2="${y * H}" stroke="#ff4d4d" stroke-width="2"/>`
    }
    guides += `<text x="${W + gap / 2}" y="${y * H + 4}" font-size="9" font-family="Menlo" fill="#ff4d4d" text-anchor="middle">${label.split(' ')[1]}</text>`
  }
  guides += '</svg>'
  await sharp({
    create: { width: W * 2 + gap, height: H, channels: 3, background: '#222' }
  })
    .composite([
      { input: ref, left: 0, top: 0 },
      { input: ours, left: W + gap, top: 0 },
      { input: Buffer.from(guides), left: 0, top: 0 }
    ])
    .png()
    .toFile(file)
}

// --- small utilities --------------------------------------------------------

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function round3(arr) {
  return arr.map((v) => Number(v.toFixed(3)))
}

function mergeDeep(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      target[k] &&
      typeof target[k] === 'object'
    ) {
      mergeDeep(target[k], v)
    } else {
      target[k] = v
    }
  }
  return target
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
}
