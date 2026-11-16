// Landmark mode for prepare-portrait.mjs: facial anchors, a face-mesh depth
// prior, a body mask and region masks for the grade, all from the MediaPipe
// output that landmarks.py writes (landmarks.json + segments.png). Opt-in per
// portrait config (`landmarks`); portraits without it never reach this module.
//
// Coordinates: landmark positions are mapped through the crop into portrait
// pixels (x right, y down, z near-is-larger in the same pixel units). Feature
// anchors are written normalised to the portrait's width and height, with an
// optional `angle` in radians (positive is clockwise on screen) applied in that
// normalised space: a point is inside when
//   ((dx·cos a + dy·sin a)/rx)² + ((−dx·sin a + dy·cos a)/ry)² < 1.

import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { clamp01, dilate, gaussianBlur, smoothstep } from './image-ops.mjs'

export const SEGMENT_CLASSES = [
  'background',
  'hair',
  'body skin',
  'face skin',
  'clothes',
  'other'
]
const BACKGROUND = 0
const HAIR = 1
const BODY_SKIN = 2
const FACE_SKIN = 3
const CLOTHES = 4
const OTHER = 5

// MediaPipe face-mesh indices. MediaPipe names sides from the subject's point
// of view and the portrait config from the image's, so the image-left eye is
// MediaPipe's right eye.
const EYES = {
  left: {
    outer: 33,
    inner: 133,
    upperLid: 159,
    lowerLid: 145,
    iris: 468,
    // Lower edge of the brow and the upper-lid crease: the orbital rim sits
    // between them.
    rim: [52, 27],
    brow: [70, 63, 105, 66, 107, 46, 53, 52, 65, 55]
  },
  right: {
    outer: 263,
    inner: 362,
    upperLid: 386,
    lowerLid: 374,
    iris: 473,
    rim: [282, 257],
    brow: [300, 293, 334, 296, 336, 276, 283, 282, 295, 285]
  }
}
const MOUTH = {
  left: 61,
  right: 291,
  upperLip: 0,
  upperInner: 13,
  lowerInner: 14,
  lowerLip: 17,
  chin: 18,
  bowLeft: 37,
  bowRight: 267,
  subnasale: 164
}
const CHEEKS = { left: 101, right: 330 }
const NOSE = { dorsum: 5, aboveTip: 4, tip: 1 }

// Amounts match the hand-placed selfie anchors; geometry ratios were fitted to
// them on the same photo (eye width `ew`, inter-ocular distance `iod` between
// socket centres, mouth width `mw` between the corners, all in pixels).
const FEATURE_AMOUNTS = {
  'left eye socket': -0.0256,
  'right eye socket': -0.0256,
  'left eye curvature': 0.032,
  'right eye curvature': 0.032,
  'left upper eyelid': 0.0208,
  'right upper eyelid': 0.0208,
  'left cheek contour': 0.0192,
  'right cheek contour': 0.0192,
  'upper lip': 0.024,
  'lip separation': -0.036,
  'lower lip': 0.0288,
  'left mouth corner': -0.0128,
  'right mouth corner': -0.0128,
  'left lower eyelid': 0.0152,
  'left orbital rim': 0.012,
  'right lower eyelid': 0.0152,
  'right orbital rim': 0.012,
  'under lower lip': -0.0144,
  'left upper lip ridge': 0.008,
  'right upper lip ridge': 0.008
}

/** Resolves the landmarks directory named by a config's `landmarks` field. */
export function landmarksDir(setting, photoPath, override) {
  if (override) return path.resolve(override)
  const dir = typeof setting === 'string' ? setting : setting?.dir
  const photoDir = path.dirname(photoPath)
  if (dir) return path.resolve(photoDir, dir)
  return path.join(photoDir, `${path.parse(photoPath).name}.landmarks`)
}

/** Landmarks in portrait pixels, plus the photo's segmentation classes. */
export async function loadLandmarks(dir, crop, W, H) {
  const data = JSON.parse(
    await fs.readFile(path.join(dir, 'landmarks.json'), 'utf8')
  )
  const cropH = Math.round(crop.width * 1.5)
  const sx = W / crop.width
  const sy = H / cropH
  const points = data.landmarks.map(([x, y, z]) => ({
    x: (x * data.width - crop.left) * sx,
    y: (y * data.height - crop.top) * sy,
    z: -z * data.width * sx
  }))
  const seg = await sharp(path.join(dir, data.segments.file))
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (seg.info.width !== data.width || seg.info.height !== data.height)
    throw new Error('segments.png does not match the landmarks photo size')
  return {
    dir,
    photo: { width: data.width, height: data.height },
    points,
    triangles: data.triangles,
    classes: seg.data,
    planes: segmentPlanes(seg.data, data.width, data.height, crop, W, H)
  }
}

// Soft per-class planes in portrait space (bilinear on the class indicators).
function segmentPlanes(classes, sw, sh, crop, W, H) {
  const cropH = Math.round(crop.width * 1.5)
  const planes = SEGMENT_CLASSES.map(() => new Float32Array(W * H))
  for (let y = 0; y < H; y++) {
    const fy = crop.top + ((y + 0.5) * cropH) / H - 0.5
    const y0 = Math.floor(fy)
    const ty = fy - y0
    for (let x = 0; x < W; x++) {
      const fx = crop.left + ((x + 0.5) * crop.width) / W - 0.5
      const x0 = Math.floor(fx)
      const tx = fx - x0
      const i = y * W + x
      for (const [xx, yy, w] of [
        [x0, y0, (1 - tx) * (1 - ty)],
        [x0 + 1, y0, tx * (1 - ty)],
        [x0, y0 + 1, (1 - tx) * ty],
        [x0 + 1, y0 + 1, tx * ty]
      ]) {
        const inside = xx >= 0 && yy >= 0 && xx < sw && yy < sh
        planes[inside ? classes[yy * sw + xx] : BACKGROUND][i] += w
      }
    }
  }
  return planes
}

// --- anchors -----------------------------------------------------------------

// A local frame along a line in portrait pixels: s runs along it, t across it
// (towards image-down when the line runs image-left to image-right).
function frame(origin, from, to, W, H) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  const ax = dx / len
  const ay = dy / len
  return {
    angle: Math.atan2(dy / H, dx / W),
    s: (q) => (q.x - origin.x) * ax + (q.y - origin.y) * ay,
    t: (q) => -(q.x - origin.x) * ay + (q.y - origin.y) * ax,
    at: (s, t) => ({
      x: origin.x + s * ax - t * ay,
      y: origin.y + s * ay + t * ax
    })
  }
}

const mean = (pts) => ({
  x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
  y: pts.reduce((a, p) => a + p.y, 0) / pts.length
})
const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
})
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * The 20 named anchors and the nose guard, from landmarks. Overrides (by
 * feature name, or 'nose guard') may set amount, center, radius or angle, or
 * nudge them with offset [du, dv] and scale (number or [sx, sy]).
 */
export function autoFeatures(points, W, H, overrides = {}) {
  const p = (i) => points[i]
  const sockets = {}
  for (const side of ['left', 'right']) {
    const e = EYES[side]
    sockets[side] = mean([e.outer, e.inner, e.upperLid, e.lowerLid].map(p))
  }
  const iod = dist(sockets.left, sockets.right)
  const raw = []
  const add = (name, center, radius, angle) =>
    raw.push({ name, center, radius, angle })

  for (const side of ['left', 'right']) {
    const e = EYES[side]
    const f = frame(sockets[side], sockets.left, sockets.right, W, H)
    const ew = dist(p(e.outer), p(e.inner))
    const rimT = e.rim.reduce((a, i) => a + f.t(p(i)), 0) / e.rim.length
    add(`${side} eye socket`, sockets[side], [0.62 * ew, 0.42 * ew], f.angle)
    add(`${side} eye curvature`, p(e.iris), [0.39 * ew, 0.17 * ew], f.angle)
    add(
      `${side} upper eyelid`,
      f.at(0, f.t(p(e.upperLid)) - 0.07 * ew),
      [0.46 * ew, 0.07 * ew],
      f.angle
    )
    add(
      `${side} lower eyelid`,
      f.at(0, f.t(p(e.lowerLid)) + 0.06 * ew),
      [0.44 * ew, 0.076 * ew],
      f.angle
    )
    add(`${side} orbital rim`, f.at(0, rimT), [0.57 * ew, 0.15 * ew], f.angle)
    add(
      `${side} cheek contour`,
      p(CHEEKS[side]),
      [0.285 * iod, 0.295 * iod],
      f.angle
    )
  }

  const m = frame(
    lerp(p(MOUTH.left), p(MOUTH.right), 0.5),
    p(MOUTH.left),
    p(MOUTH.right),
    W,
    H
  )
  const mw = dist(p(MOUTH.left), p(MOUTH.right))
  const t = (i) => m.t(p(i))
  add(
    'upper lip',
    m.at(0, t(MOUTH.upperLip)),
    [0.365 * mw, 0.0388 * iod],
    m.angle
  )
  add(
    'lip separation',
    m.at(0, (t(MOUTH.upperInner) + t(MOUTH.lowerInner)) / 2),
    [0.445 * mw, 0.0513 * iod],
    m.angle
  )
  add(
    'lower lip',
    m.at(0, (t(MOUTH.lowerInner) + t(MOUTH.lowerLip)) / 2),
    [0.328 * mw, 0.0627 * iod],
    m.angle
  )
  add(
    'under lower lip',
    m.at(0, t(MOUTH.lowerLip) + 0.2 * (t(MOUTH.chin) - t(MOUTH.lowerLip))),
    [0.2735 * mw, 0.0542 * iod],
    m.angle
  )
  for (const side of ['left', 'right']) {
    add(
      `${side} mouth corner`,
      p(MOUTH[side]),
      [0.061 * iod, 0.0685 * iod],
      m.angle
    )
    add(
      `${side} upper lip ridge`,
      lerp(
        p(MOUTH.subnasale),
        p(side === 'left' ? MOUTH.bowLeft : MOUTH.bowRight),
        0.35
      ),
      [0.068 * iod, 0.036 * iod],
      m.angle
    )
  }

  const normalise = (f) => {
    const o = overrides[f.name] ?? {}
    const scale = Array.isArray(o.scale)
      ? o.scale
      : [o.scale ?? 1, o.scale ?? 1]
    const offset = o.offset ?? [0, 0]
    const center = o.center ?? [
      f.center.x / W + offset[0],
      f.center.y / H + offset[1]
    ]
    const radius = o.radius ?? [
      (f.radius[0] / W) * scale[0],
      (f.radius[1] / H) * scale[1]
    ]
    return {
      name: f.name,
      center,
      radius,
      angle: o.angle ?? f.angle,
      amount: o.amount ?? FEATURE_AMOUNTS[f.name]
    }
  }
  const byName = Object.fromEntries(raw.map((f) => [f.name, f]))
  const features = Object.keys(FEATURE_AMOUNTS).map((name) =>
    normalise(byName[name])
  )
  const guard = normalise({
    name: 'nose guard',
    center: lerp(p(NOSE.dorsum), p(NOSE.aboveTip), 0.5),
    radius: [0.228 * iod, 0.257 * iod],
    angle: 0
  })
  return {
    noseGuard: { center: guard.center, radius: guard.radius },
    features
  }
}

/** Inside test shared with lib/faces/portrait.ts (normalised coordinates). */
export function ellipseQ(f, u, v) {
  const dx = u - f.center[0]
  const dy = v - f.center[1]
  const a = f.angle ?? 0
  const c = Math.cos(a)
  const s = Math.sin(a)
  return (
    ((dx * c + dy * s) / f.radius[0]) ** 2 +
    ((-dx * s + dy * c) / f.radius[1]) ** 2
  )
}

// --- mesh depth prior ----------------------------------------------------------

/**
 * Rasterises the face mesh's z into portrait pixels with barycentric
 * interpolation (nearest surface wins). The tessellation leaves the eyes and
 * mouth open; each opening is closed with a fan from its centroid at the mean
 * depth of its rim, so the eyeballs and lips read as surfaces.
 */
export function rasteriseMesh(points, triangles, W, H) {
  const pts = points.slice(0, 468).map((q) => ({ ...q }))
  const tris = triangles.map((tri) => tri.slice())
  const loops = boundaryLoops(tris).sort((a, b) => b.length - a.length)
  for (const loop of loops.slice(1)) {
    const hub = pts.length
    pts.push({
      x: loop.reduce((a, i) => a + pts[i].x, 0) / loop.length,
      y: loop.reduce((a, i) => a + pts[i].y, 0) / loop.length,
      z: loop.reduce((a, i) => a + pts[i].z, 0) / loop.length
    })
    for (let k = 0; k < loop.length; k++)
      tris.push([loop[k], loop[(k + 1) % loop.length], hub])
  }

  const depth = new Float32Array(W * H)
  const cover = new Uint8Array(W * H)
  for (const [ia, ib, ic] of tris) {
    const A = pts[ia]
    const B = pts[ib]
    const C = pts[ic]
    const den = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y)
    if (Math.abs(den) < 1e-9) continue
    const x0 = Math.max(0, Math.floor(Math.min(A.x, B.x, C.x)))
    const x1 = Math.min(W - 1, Math.ceil(Math.max(A.x, B.x, C.x)))
    const y0 = Math.max(0, Math.floor(Math.min(A.y, B.y, C.y)))
    const y1 = Math.min(H - 1, Math.ceil(Math.max(A.y, B.y, C.y)))
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5
        const l1 = ((B.y - C.y) * (px - C.x) + (C.x - B.x) * (py - C.y)) / den
        const l2 = ((C.y - A.y) * (px - C.x) + (A.x - C.x) * (py - C.y)) / den
        const l3 = 1 - l1 - l2
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue
        const z = l1 * A.z + l2 * B.z + l3 * C.z
        const i = y * W + x
        if (!cover[i] || z > depth[i]) {
          depth[i] = z
          cover[i] = 1
        }
      }
    }
  }
  return { depth, cover, holes: loops.length - 1 }
}

// Closed loops of edges that belong to exactly one triangle.
function boundaryLoops(tris) {
  const count = new Map()
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`)
  for (const [a, b, c] of tris)
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a]
    ])
      count.set(key(u, v), (count.get(key(u, v)) ?? 0) + 1)
  const next = new Map()
  for (const [k, n] of count) {
    if (n !== 1) continue
    const [a, b] = k.split(',').map(Number)
    if (!next.has(a)) next.set(a, [])
    if (!next.has(b)) next.set(b, [])
    next.get(a).push(b)
    next.get(b).push(a)
  }
  const used = new Set()
  const loops = []
  for (const start of next.keys()) {
    if (used.has(start)) continue
    const loop = [start]
    used.add(start)
    let prev = -1
    let cur = start
    for (;;) {
      const nb = next.get(cur).find((v) => v !== prev && !used.has(v))
      if (nb === undefined) break
      loop.push(nb)
      used.add(nb)
      prev = cur
      cur = nb
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

// Fusion settings (pixels unless noted); see fuseMeshDepth and fuseDepth.
const MESH_DEFAULTS = {
  calibration: 'anatomical',
  scale: 1,
  // Visible height as a fraction of the frame, for the anatomical scale.
  visibleSpan: 0.66,
  detail: 5,
  rim: 16,
  extend: 12,
  rolloff: 24
}

/**
 * The mesh prior fused with the model depth `D` (see fuseDepth), with the
 * mesh's scale set by `calibration`:
 *   'anatomical' (default)  relief at the same scale as the face's width once
 *                           shown at runtime, times `scale`;
 *   'fit'                   the least-squares slope against the model, times
 *                           `scale` (inherits the model's flatness).
 * masks: { calibration, subject, visible } where `visible` estimates the
 * pixels the sampler will see; the final stretch maps their nearest to 1.
 */
export function fuseMeshDepth(D, mesh, masks, options = {}, W, H) {
  const opts = { ...MESH_DEFAULTS, ...options }
  const fuse = (slope) =>
    fuseDepth(
      D,
      mesh,
      masks.calibration,
      masks.subject,
      { ...opts, slope },
      W,
      H
    )
  let fusion = fuse(undefined)
  if (opts.calibration === 'anatomical') {
    // lib/faces/portrait.ts shows the visible height (about 0.66 of the frame
    // for consistently framed portraits) as 2.65 units and maps depth to z at
    // 1.3 units per unit below its soft clip. The final stretch depends on the
    // fused result, so iterate.
    const target = (opts.scale * 2.65) / (opts.visibleSpan * H * 1.3)
    for (let k = 0; k < 6; k++) {
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < W * H; i++) {
        lo = Math.min(lo, fusion.depth[i])
        if (masks.visible[i]) hi = Math.max(hi, fusion.depth[i])
      }
      fusion = fuse(target * (hi - lo))
    }
  } else if (opts.scale !== 1) {
    fusion = fuse(fusion.fitted * opts.scale)
  }
  return { ...fusion, options: opts }
}

/**
 * Fuses the mesh prior with the depth model's (normalised) depth `D`.
 * The mesh is calibrated to the model over the face: D ≈ a·m + b by least
 * squares, or with a given `slope` a (then only b is fitted). Inside
 * the mesh the result takes everything coarser than `detail` px from the mesh
 * and everything finer (skin, beard, wrinkles) from the model:
 *   F = D + lowpass(a·m + b − D).
 * Outside, each pixel takes the correction of the nearest face pixel and, where
 * the face edge recedes, keeps receding at the edge's rate, easing off over
 * `rolloff` px (smoothed over `extend` px). Hair, ears and the top of the head
 * so continue the face's curvature instead of meeting it at a crease or
 * trench. `subject` (the matte) limits that to the person, so the background
 * keeps the model's depth.
 */
export function fuseDepth(D, mesh, calibration, subject, options, W, H) {
  const { detail, rim, extend, rolloff, slope } = {
    ...MESH_DEFAULTS,
    ...options
  }
  const n = W * H
  const inside = distanceInside(mesh.cover, W, H)

  let sw = 0
  let sm = 0
  let sd = 0
  let smm = 0
  let smd = 0
  for (let i = 0; i < n; i++) {
    if (inside[i] <= 4 || !calibration[i]) continue
    const m = mesh.depth[i]
    sw++
    sm += m
    sd += D[i]
    smm += m * m
    smd += m * D[i]
  }
  const fitted = (sw * smd - sm * sd) / (sw * smm - sm * sm)
  if (!(fitted > 0))
    throw new Error('mesh depth does not correlate with the model')
  const a = slope ?? fitted
  const b = (sd - a * sm) / sw

  const residual = new Float32Array(n)
  const cover = new Float32Array(n)
  const prior = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (!mesh.cover[i]) continue
    cover[i] = 1
    prior[i] = a * mesh.depth[i] + b
    residual[i] = prior[i] - D[i]
  }
  const fine = normalisedBlur(residual, cover, detail, W, H)
  // Skip the outermost, partly covered pixels when extending.
  const source = new Uint8Array(n)
  for (let i = 0; i < n; i++) source[i] = inside[i] >= 2 ? 1 : 0
  const nearest = nearestSource(source, W, H)
  const smooth = gaussianBlur(fine, W, H, 2)
  const extension = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const j = nearest[i]
    if (j < 0) continue
    const x = i % W
    const y = (i - x) / W
    const jx = j % W
    const jy = (j - jx) / W
    const d = Math.hypot(x - jx, y - jy)
    let r = fine[j]
    if (d > 0 && jx > 0 && jy > 0 && jx < W - 1 && jy < H - 1) {
      const gx = (smooth[j + 1] - smooth[j - 1]) / 2
      const gy = (smooth[j + W] - smooth[j - W]) / 2
      const outward = (gx * (x - jx) + gy * (y - jy)) / d
      r += Math.min(0, outward) * rolloff * (1 - Math.exp(-d / rolloff))
    }
    extension[i] = r
  }
  const extended = gaussianBlur(extension, W, H, extend)

  const fused = new Float32Array(n)
  const correction = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const w = smoothstep(0, rim, inside[i])
    const r =
      w * fine[i] + (1 - w) * extended[i] * (mesh.cover[i] ? 1 : subject[i])
    correction[i] = r
    fused[i] = D[i] + r
  }
  return { depth: fused, prior, correction, a, b, fitted, samples: sw }
}

// Index of the nearest source pixel for every pixel (two-pass propagation of
// nearest-source coordinates), or -1 without any source.
function nearestSource(source, W, H) {
  const n = W * H
  const sx = new Int32Array(n).fill(-1)
  const sy = new Int32Array(n).fill(-1)
  const d2 = new Float64Array(n).fill(Infinity)
  for (let i = 0; i < n; i++) {
    if (!source[i]) continue
    sx[i] = i % W
    sy[i] = (i - sx[i]) / W
    d2[i] = 0
  }
  const relax = (x, y, dx, dy) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return
    const j = ny * W + nx
    if (sx[j] < 0) return
    const i = y * W + x
    const d = (x - sx[j]) ** 2 + (y - sy[j]) ** 2
    if (d < d2[i]) {
      d2[i] = d
      sx[i] = sx[j]
      sy[i] = sy[j]
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      relax(x, y, -1, 0)
      relax(x, y, -1, -1)
      relax(x, y, 0, -1)
      relax(x, y, 1, -1)
    }
    for (let x = W - 1; x >= 0; x--) relax(x, y, 1, 0)
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      relax(x, y, 1, 0)
      relax(x, y, 1, 1)
      relax(x, y, 0, 1)
      relax(x, y, -1, 1)
    }
    for (let x = 0; x < W; x++) relax(x, y, -1, 0)
  }
  const out = new Int32Array(n)
  for (let i = 0; i < n; i++) out[i] = sx[i] < 0 ? -1 : sy[i] * W + sx[i]
  return out
}

function normalisedBlur(values, weights, sigma, W, H) {
  const num = gaussianBlur(values, W, H, sigma)
  const den = gaussianBlur(weights, W, H, sigma)
  return num.map((v, i) => (den[i] > 1e-4 ? v / den[i] : 0))
}

/** Two-pass chamfer distance from each mask pixel to the nearest non-mask pixel. */
export function distanceInside(mask, W, H) {
  const d = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? Infinity : 0
  const relax = (x, y, dx, dy, cost) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return
    const i = y * W + x
    d[i] = Math.min(d[i], d[ny * W + nx] + cost)
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      relax(x, y, -1, 0, 1)
      relax(x, y, 0, -1, 1)
      relax(x, y, -1, -1, Math.SQRT2)
      relax(x, y, 1, -1, Math.SQRT2)
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      relax(x, y, 1, 0, 1)
      relax(x, y, 0, 1, 1)
      relax(x, y, 1, 1, Math.SQRT2)
      relax(x, y, -1, 1, Math.SQRT2)
    }
  }
  return d
}

// --- masks for the grade ---------------------------------------------------------

/**
 * Region masks from the segmentation:
 *   remove  feathered body mask: clothes, neck and shoulder skin, accessories
 *           outside the face (straps, necklace) and background away from the
 *           head. Next to hair and face the matte decides the outer edge.
 *   face    face-skin core (skin, beard, eyes, brows), for the levels.
 *   skin    bare skin for tone statistics: face skin inside the mesh, above
 *           the nose tip, away from the eyes and brows.
 *   hair    hair class, feathered.
 */
export function regionMasks(lm, mesh, features, options, W, H) {
  const { grow = 10, feather = 2, edge = [0.2, 0.7] } = options
  const n = W * H
  const pl = lm.planes
  const keep = new Float32Array(n)
  for (let i = 0; i < n; i++) keep[i] = pl[HAIR][i] + pl[FACE_SKIN][i]
  const grown = dilate(keep, W, H, grow)
  const nearFace = dilate(Float32Array.from(mesh.cover), W, H, 6)
  const remove = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    remove[i] = clamp01(
      pl[BODY_SKIN][i] +
        pl[CLOTHES][i] +
        pl[OTHER][i] * (1 - nearFace[i]) +
        pl[BACKGROUND][i] * (1 - grown[i])
    )
  }
  const soft = gaussianBlur(remove, W, H, feather).map((v) =>
    smoothstep(edge[0], edge[1], v)
  )

  const face = Float32Array.from(pl[FACE_SKIN])
  // Feathered so a hair gain can't draw a line along the hairline.
  const hair = gaussianBlur(pl[HAIR], W, H, 3)

  const byName = Object.fromEntries(features.features.map((f) => [f.name, f]))
  const exclusions = ['left', 'right'].flatMap((side) => {
    const socket = byName[`${side} eye socket`]
    const brow = EYES[side].brow.map((i) => lm.points[i])
    const c = mean(brow)
    const xs = brow.map((q) => q.x)
    const ys = brow.map((q) => q.y)
    return [
      { ...socket, radius: socket.radius.map((r) => r * 1.3) },
      {
        center: [c.x / W, c.y / H],
        radius: [
          ((Math.max(...xs) - Math.min(...xs)) / 2 / W) * 1.15,
          ((Math.max(...ys) - Math.min(...ys)) / 2 / H) * 1.6 + 0.008
        ],
        angle: socket.angle
      }
    ]
  })
  const noseTipY = lm.points[NOSE.tip].y
  const skin = new Float32Array(n)
  for (let y = 0; y < H; y++) {
    if (y + 0.5 > noseTipY) break
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (!mesh.cover[i] || face[i] < 0.99) continue
      const u = (x + 0.5) / W
      const v = (y + 0.5) / H
      if (exclusions.some((f) => ellipseQ(f, u, v) < 1)) continue
      skin[i] = 1
    }
  }
  return { remove: soft, face, skin, hair }
}

// --- region-aware tone --------------------------------------------------------------

/** Values of `values` at the given percentiles over mask pixels. */
export function percentilesOver(values, mask, percentiles) {
  const v = []
  for (let i = 0; i < values.length; i++) if (mask[i]) v.push(values[i])
  v.sort((a, b) => a - b)
  return percentiles.map((p) => v[Math.floor((v.length - 1) * (p / 100))])
}

/**
 * A monotone tone curve through (0, 0) and the measured → target percentile
 * knots (Fritsch–Carlson cubic), with a soft shoulder above the last knot that
 * approaches `white` without clipping highlights (teeth, catchlights).
 */
export function toneCurve(sources, targets, white) {
  const xs = [0, ...sources]
  const ys = [0, ...targets]
  const k = xs.length
  for (let i = 1; i < k; i++) {
    if (!(xs[i] > xs[i - 1]) || !(ys[i] > ys[i - 1]))
      throw new Error('tone percentiles must increase')
  }
  const delta = []
  for (let i = 0; i < k - 1; i++)
    delta.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  const m = Array.from({ length: k }, () => 0)
  m[0] = delta[0]
  m[k - 1] = delta[k - 2]
  for (let i = 1; i < k - 1; i++) m[i] = (delta[i - 1] + delta[i]) / 2
  for (let i = 0; i < k - 1; i++) {
    const a = m[i] / delta[i]
    const b = m[i + 1] / delta[i]
    const h = Math.hypot(a, b)
    if (h > 3) {
      m[i] = (3 * a * delta[i]) / h
      m[i + 1] = (3 * b * delta[i]) / h
    }
  }
  const top = ys[k - 1]
  const room = Math.max(1e-3, white - top)
  const curve = (x) => {
    if (x <= 0) return 0
    if (x >= xs[k - 1])
      return top + room * (1 - Math.exp((-m[k - 1] * (x - xs[k - 1])) / room))
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    )
  }
  curve.slopes = delta
  return curve
}
