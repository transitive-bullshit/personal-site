// Turns a grayscale portrait on black plus a relative depth map into particle
// targets. Bright, detailed areas get denser samples; silhouette edges are
// feathered so the assembled face dissolves into the dark background.

export type FeatureAnchor = {
  name: string
  center: [number, number]
  radius: [number, number]
  amount: number
}

export type PortraitFeatures = {
  noseGuard: { center: [number, number]; radius: [number, number] }
  features: FeatureAnchor[]
}

export type PortraitSource = {
  /** Depth map size. */
  width: number
  height: number
  /** Relative inverse depth, 0 (far) to 1 (near), row-major from the top. */
  depth: Float32Array
  /** Portrait pixels, RGBA, row-major from the top. */
  pixels: Uint8ClampedArray
  imageWidth: number
  imageHeight: number
}

/** Particle targets in scene units, ready to hand to the swarm. */
export type PortraitCloud = {
  count: number
  /** Target xyz. */
  positions: Float32Array
  /** Linear luminance per particle. */
  tones: Float32Array
  /** Local spacing, used to size settled particles so they tile the face. */
  diameters: Float32Array
  /** Relative particle size, larger in sparse areas. */
  sizeFactors: Float32Array
  /** 1 near the silhouette outside the face, 0 elsewhere. */
  edges: Float32Array
  /** Negative values arrive earlier (eyes and nose), positive later. */
  assemblyBias: Float32Array
  /** Mean position of the eye-socket particles; the camera focuses here. */
  eyeFocus: [number, number, number]
  /** Lowest target y, for placing the caption under the chin. */
  bottom: number
}

/** Sampled portrait height in scene units before normalization. */
const portraitHeight = 3.7
/** The assembled portrait spans this many scene units vertically. */
const displayHeight = 2.65
/** Depth is foreshortened as if viewed from this distance. */
const viewDistance = 4.8
/** Pixels darker than this in every channel are background. */
const backgroundLevel = 9

const srgbToLinear = Float32Array.from({ length: 256 }, (_, index) => {
  const value = index / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
})

export function hash(seed: number) {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 16), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 4_294_967_296
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Compress the nearest relief so noses and chins don't spike forward. */
function softClipDepth(depth: number) {
  const knee = 0.65
  const softness = 0.2
  return (
    Math.min(depth, knee) -
    softness * Math.expm1(-Math.max(0, depth - knee) / softness)
  )
}

function sampleDepth(source: PortraitSource, u: number, v: number) {
  const x = Math.max(0, Math.min(1, u)) * (source.width - 1)
  const y = (1 - Math.max(0, Math.min(1, v))) * (source.height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, source.width - 1)
  const y1 = Math.min(y0 + 1, source.height - 1)
  const { depth, width } = source
  const top =
    depth[y0 * width + x0]! +
    (depth[y0 * width + x1]! - depth[y0 * width + x0]!) * (x - x0)
  const bottom =
    depth[y1 * width + x0]! +
    (depth[y1 * width + x1]! - depth[y1 * width + x0]!) * (x - x0)
  return top + (bottom - top) * (y - y0)
}

export type DetailRegion = {
  center: [number, number]
  radius: [number, number]
  strength: number
}

/**
 * Sampling density from local contrast, boosted inside detail regions so the
 * eyes, nostrils and mouth stay legible.
 */
export function detailDensity(
  source: PortraitSource,
  regions: readonly DetailRegion[] = []
) {
  const { imageWidth: width, imageHeight: height, pixels } = source
  const stride = width + 1
  const integral = new Float64Array(stride * (height + 1))
  for (let y = 0; y < height; y++) {
    let row = 0
    for (let x = 0; x < width; x++) {
      const pixel = (x + y * width) * 4
      row +=
        (pixels[pixel]! * 0.2126 +
          pixels[pixel + 1]! * 0.7152 +
          pixels[pixel + 2]! * 0.0722) /
        255
      integral[x + 1 + (y + 1) * stride] = row + integral[x + 1 + y * stride]!
    }
  }

  const radius = Math.max(1, Math.round(width / 300))
  const boxMean = (cx: number, cy: number) => {
    const x0 = Math.max(0, cx - radius)
    const x1 = Math.min(width, cx + radius + 1)
    const y0 = Math.max(0, cy - radius)
    const y1 = Math.min(height, cy + radius + 1)
    return (
      (integral[x1 + y1 * stride]! -
        integral[x0 + y1 * stride]! -
        integral[x1 + y0 * stride]! +
        integral[x0 + y0 * stride]!) /
      ((x1 - x0) * (y1 - y0))
    )
  }

  const density = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gradientX =
        boxMean(Math.min(width - 1, x + radius * 2), y) -
        boxMean(Math.max(0, x - radius * 2), y)
      const gradientY =
        boxMean(x, Math.min(height - 1, y + radius * 2)) -
        boxMean(x, Math.max(0, y - radius * 2))

      let boost = 0
      for (const region of regions) {
        const distance =
          (((x + 0.5) / width - region.center[0]) / region.radius[0]) ** 2 +
          (((y + 0.5) / height - region.center[1]) / region.radius[1]) ** 2
        if (distance < 9) {
          const falloff = Math.min(1, (9 - distance) / 5)
          boost = Math.max(
            boost,
            region.strength *
              Math.exp(-distance * 0.5) *
              falloff *
              falloff *
              (3 - 2 * falloff)
          )
        }
      }

      const regional = regions.length ? 0.65 + boost : 1
      density[x + y * width] =
        (0.5 + Math.min(1, Math.hypot(gradientX, gradientY) * 3.5) * 2) *
        regional
    }
  }
  return density
}

/**
 * Feathers the silhouette: fewer samples right at the edge, and an edge weight
 * for the hair and shoulders (not the face) that lets those particles drift.
 */
export function silhouetteFeather(source: PortraitSource) {
  const { imageWidth: width, imageHeight: height, pixels } = source
  const distance = new Float32Array(width * height)
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = x + y * width
      const pixel = index * 4
      if (
        Math.max(pixels[pixel]!, pixels[pixel + 1]!, pixels[pixel + 2]!) <
        backgroundLevel
      ) {
        continue
      }
      distance[index] = Math.min(
        x + 0.5,
        y + 0.5,
        width - x - 0.5,
        height - y - 0.5
      )
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  // Two-pass chamfer distance to the nearest background pixel.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = x + y * width
      if (x > 0)
        distance[index] = Math.min(distance[index]!, distance[index - 1]! + 1)
      if (y > 0) {
        distance[index] = Math.min(
          distance[index]!,
          distance[index - width]! + 1
        )
        if (x > 0) {
          distance[index] = Math.min(
            distance[index]!,
            distance[index - width - 1]! + Math.SQRT2
          )
        }
        if (x + 1 < width) {
          distance[index] = Math.min(
            distance[index]!,
            distance[index - width + 1]! + Math.SQRT2
          )
        }
      }
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const index = x + y * width
      if (x + 1 < width) {
        distance[index] = Math.min(distance[index]!, distance[index + 1]! + 1)
      }
      if (y + 1 < height) {
        distance[index] = Math.min(
          distance[index]!,
          distance[index + width]! + 1
        )
        if (x > 0) {
          distance[index] = Math.min(
            distance[index]!,
            distance[index + width - 1]! + Math.SQRT2
          )
        }
        if (x + 1 < width) {
          distance[index] = Math.min(
            distance[index]!,
            distance[index + width + 1]! + Math.SQRT2
          )
        }
      }
    }
  }

  const density = new Float32Array(distance.length)
  const edges = new Float32Array(distance.length)
  const size = Math.min(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = x + y * width
      if (distance[index] === 0) continue
      const border = Math.min(
        x + 0.5,
        y + 0.5,
        width - x - 0.5,
        height - y - 0.5
      )
      density[index] =
        smoothstep(0, size * 0.1, border) *
        (0.2 + 0.8 * smoothstep(0, size * 0.012, distance[index]!))

      // Keep the central face crisp; only the outer silhouette drifts.
      const u = (x - minX) / Math.max(1, maxX - minX)
      const v = (y - minY) / Math.max(1, maxY - minY)
      const face =
        1 -
        smoothstep(0.85, 1.25, Math.hypot((u - 0.52) / 0.28, (v - 0.42) / 0.27))
      edges[index] =
        (1 - smoothstep(0, size * 0.09, distance[index]!)) * (1 - face)
    }
  }
  return { density, edges }
}

export type SampledPortrait = {
  count: number
  /** x, y in portrait units, then raw and soft-clipped depth. */
  points: Float32Array
  /** Linear RGB. */
  colors: Float32Array
  edges: Float32Array
}

/**
 * Variable-radius Poisson-disc sampling over the visible pixels, weighted by
 * detail and feathered at the silhouette.
 */
export function samplePortrait(
  source: PortraitSource,
  count: number,
  regions: readonly DetailRegion[]
): SampledPortrait {
  const { pixels, imageWidth: width, imageHeight: height } = source
  const visible: number[] = []
  for (let index = 0; index < width * height; index++) {
    const pixel = index * 4
    if (
      Math.max(pixels[pixel]!, pixels[pixel + 1]!, pixels[pixel + 2]!) >=
      backgroundLevel
    ) {
      visible.push(index)
    }
  }
  if (!visible.length) throw new Error('The portrait has no visible pixels.')

  const feather = silhouetteFeather(source)
  const density = detailDensity(source, regions)
  for (const [index, value] of feather.density.entries()) {
    density[index] = density[index]! * value
  }

  const cumulative = new Float64Array(visible.length)
  let total = 0
  for (const [index, pixel] of visible.entries()) {
    total += density[pixel]!
    cumulative[index] = total
  }
  const meanDensity = total / visible.length
  const radiusScale = (pixel: number) =>
    Math.max(0.7, Math.min(1.4, Math.sqrt(meanDensity / density[pixel]!)))

  const samples = new Float64Array(count * 2)
  const samplePixels = new Uint32Array(count)
  const sampleScales = new Float32Array(count)
  let spacing = Math.sqrt(visible.length / count) * 0.68
  let cellSize = 0
  let columns = 0
  let rows = 0
  let grid = new Int32Array(0)
  let accepted = 0

  const rebuildGrid = () => {
    cellSize = (spacing * 0.7) / Math.SQRT2
    columns = Math.ceil(width / cellSize)
    rows = Math.ceil(height / cellSize)
    grid = new Int32Array(columns * rows).fill(-1)
    for (let index = 0; index < accepted; index++) {
      grid[
        Math.floor(samples[index * 2]! / cellSize) +
          Math.floor(samples[index * 2 + 1]! / cellSize) * columns
      ] = index
    }
  }
  rebuildGrid()

  let attempt = 0
  let failures = 0
  while (accepted < count) {
    if (++failures > count * 24) {
      spacing *= 0.85
      rebuildGrid()
      failures = 0
    }
    const seed = attempt++ * 3
    const target = hash(seed) * total
    let low = 0
    let high = visible.length - 1
    while (low < high) {
      const middle = (low + high) >>> 1
      if (cumulative[middle]! < target) low = middle + 1
      else high = middle
    }

    const pixel = visible[low]!
    const scale = radiusScale(pixel)
    const x = (pixel % width) + hash(seed + 1)
    const y = Math.floor(pixel / width) + hash(seed + 2)
    const column = Math.floor(x / cellSize)
    const row = Math.floor(y / cellSize)

    let free = true
    search: for (
      let r = Math.max(0, row - 3);
      r <= Math.min(rows - 1, row + 3);
      r++
    ) {
      for (
        let c = Math.max(0, column - 3);
        c <= Math.min(columns - 1, column + 3);
        c++
      ) {
        const other = grid[c + r * columns]!
        if (other < 0) continue
        const minimum = spacing * (scale + sampleScales[other]!) * 0.5
        if (
          (samples[other * 2]! - x) ** 2 + (samples[other * 2 + 1]! - y) ** 2 <
          minimum * minimum
        ) {
          free = false
          break search
        }
      }
    }
    if (!free) continue

    samples[accepted * 2] = x
    samples[accepted * 2 + 1] = y
    samplePixels[accepted] = pixel
    sampleScales[accepted] = scale
    grid[column + row * columns] = accepted++
  }

  const aspect = source.width / source.height
  const points = new Float32Array(count * 4)
  const colors = new Float32Array(count * 3)
  const edges = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const u = samples[index * 2]! / width
    const v = 1 - samples[index * 2 + 1]! / height
    const pixel = samplePixels[index]!
    const depth = sampleDepth(source, u, v)
    points.set(
      [
        (u - 0.5) * portraitHeight * aspect,
        (v - 0.5) * portraitHeight,
        depth,
        softClipDepth(depth)
      ],
      index * 4
    )
    colors.set(
      [
        srgbToLinear[pixels[pixel * 4]!]!,
        srgbToLinear[pixels[pixel * 4 + 1]!]!,
        srgbToLinear[pixels[pixel * 4 + 2]!]!
      ],
      index * 3
    )
    edges[index] = feather.edges[pixel]!
  }
  return { count, points, colors, edges }
}

/** Denser sampling in the eye sockets, the mouth line and the nostrils. */
export function featureDetailRegions(
  features: PortraitFeatures
): DetailRegion[] {
  const regions: DetailRegion[] = features.features
    .filter((feature) => feature.name.endsWith('eye socket'))
    .map((feature) => ({
      center: feature.center,
      radius: [feature.radius[0], feature.radius[1] * 0.85],
      strength: 2.8
    }))
  const lips = features.features.find(
    (feature) => feature.name === 'lip separation'
  )
  if (lips) {
    regions.push({
      center: lips.center,
      radius: [lips.radius[0], 0.025],
      strength: 2.4
    })
  }
  for (const side of [-1, 1]) {
    regions.push({
      center: [
        features.noseGuard.center[0] +
          side * features.noseGuard.radius[0] * 0.6,
        features.noseGuard.center[1] + 0.008
      ],
      radius: [0.018, 0.014],
      strength: 2.6
    })
  }
  return regions
}

/** Eyes and nose land first, the mouth a little later. */
function assemblyBias(u: number, v: number, features: PortraitFeatures) {
  const gaussian = (
    center: readonly [number, number],
    radius: readonly [number, number],
    spread: number
  ) =>
    Math.exp(
      -0.5 *
        (((u - center[0]) / (radius[0] * spread)) ** 2 +
          ((v - center[1]) / (radius[1] * spread)) ** 2)
    )

  let early = gaussian(
    features.noseGuard.center,
    features.noseGuard.radius,
    1.1
  )
  let cheeks = 0
  let mouth = 0
  for (const feature of features.features) {
    if (feature.name.endsWith('eye socket')) {
      early = Math.max(early, gaussian(feature.center, feature.radius, 1.25))
    } else if (feature.name.endsWith('cheek contour')) {
      cheeks = Math.max(cheeks, gaussian(feature.center, feature.radius, 1))
    } else if (feature.name === 'lip separation') {
      mouth = gaussian(feature.center, [feature.radius[0], 0.028], 1.2)
    }
  }
  return -0.17 * early + 0.025 * cheeks + 0.09 * mouth
}

/** Mean distance to the three nearest neighbors on screen, per particle. */
function localSpacing(positions: Float32Array) {
  const count = positions.length / 3
  const projected = new Float32Array(count * 2)
  const scales = new Float32Array(count)
  const maximum = 0.025
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < count; index++) {
    const scale = Math.max(
      0.1,
      (viewDistance - positions[index * 3 + 2]!) / viewDistance
    )
    scales[index] = scale
    const x = positions[index * 3]! / scale
    const y = positions[index * 3 + 1]! / scale
    projected[index * 2] = x
    projected[index * 2 + 1] = y
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  const columns = Math.floor((maxX - minX) / maximum) + 1
  const rows = Math.floor((maxY - minY) / maximum) + 1
  const heads = new Map<number, number>()
  const next = new Int32Array(count).fill(-1)
  for (let index = 0; index < count; index++) {
    const cell =
      Math.floor((projected[index * 2]! - minX) / maximum) +
      Math.floor((projected[index * 2 + 1]! - minY) / maximum) * columns
    next[index] = heads.get(cell) ?? -1
    heads.set(cell, index)
  }

  const diameters = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const x = projected[index * 2]!
    const y = projected[index * 2 + 1]!
    const column = Math.floor((x - minX) / maximum)
    const row = Math.floor((y - minY) / maximum)
    const nearest = [Infinity, Infinity, Infinity]
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
      for (
        let c = Math.max(0, column - 1);
        c <= Math.min(columns - 1, column + 1);
        c++
      ) {
        for (
          let other = heads.get(c + r * columns) ?? -1;
          other !== -1;
          other = next[other]!
        ) {
          if (other === index) continue
          const squared =
            (projected[other * 2]! - x) ** 2 +
            (projected[other * 2 + 1]! - y) ** 2
          if (squared < nearest[0]!) nearest.unshift(squared)
          else if (squared < nearest[1]!) nearest.splice(1, 0, squared)
          else if (squared < nearest[2]!) nearest.splice(2, 0, squared)
          nearest.length = 3
        }
      }
    }
    const finite = nearest.filter(Number.isFinite)
    const spacing = finite.length
      ? Math.sqrt(finite.reduce((sum, value) => sum + value, 0) / finite.length)
      : maximum
    diameters[index] = Math.max(
      1e-5,
      Math.min(maximum, spacing * 1.3) * scales[index]!
    )
  }
  return diameters
}

function relativeSizes(diameters: Float32Array) {
  if (!diameters.length) return new Float32Array()
  const sorted = diameters.slice().sort()
  const median = Math.max(1e-5, sorted[Math.floor(sorted.length / 2)]!)
  return Float32Array.from(diameters, (diameter) =>
    Math.max(0.58, Math.min(1.05, 0.75 * (diameter / median) ** 0.65))
  )
}

/** Places sampled portrait points in scene space, centered and foreshortened. */
export function buildPortraitCloud(
  sampled: SampledPortrait,
  features: PortraitFeatures,
  aspect: number
): PortraitCloud {
  const { count, points, colors } = sampled
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < count; index++) {
    minX = Math.min(minX, points[index * 4]!)
    maxX = Math.max(maxX, points[index * 4]!)
    minY = Math.min(minY, points[index * 4 + 1]!)
    maxY = Math.max(maxY, points[index * 4 + 1]!)
  }

  const scale = displayHeight / Math.max(0.1, maxY - minY)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const sockets = features.features.filter((feature) =>
    feature.name.endsWith('eye socket')
  )
  const eyeSum = [0, 0, 0]
  let eyeCount = 0
  let bottom = Infinity

  const positions = new Float32Array(count * 3)
  const tones = new Float32Array(count)
  const bias = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const depth = points[index * 4 + 2]!
    const clipped = points[index * 4 + 3]!
    const z = (clipped * 0.8 + depth * 0.2 - 0.45) * 1.3
    const perspective = (viewDistance - z) / viewDistance
    const x = (points[index * 4]! - centerX) * scale * perspective
    const y = (points[index * 4 + 1]! - centerY) * scale * perspective
    positions.set([x, y, z], index * 3)
    bottom = Math.min(bottom, y)
    tones[index] =
      colors[index * 3]! * 0.2126 +
      colors[index * 3 + 1]! * 0.7152 +
      colors[index * 3 + 2]! * 0.0722

    const u = points[index * 4]! / (portraitHeight * aspect) + 0.5
    const v = 0.5 - points[index * 4 + 1]! / portraitHeight
    if (
      sockets.some(
        (socket) =>
          ((u - socket.center[0]) / socket.radius[0]) ** 2 +
            ((v - socket.center[1]) / socket.radius[1]) ** 2 <
          0.5
      )
    ) {
      eyeSum[0]! += x
      eyeSum[1]! += y
      eyeSum[2]! += z
      eyeCount++
    }
    bias[index] = assemblyBias(u, v, features)
  }

  const diameters = localSpacing(positions)
  const divisor = Math.max(1, eyeCount)
  return {
    count,
    positions,
    tones,
    diameters,
    sizeFactors: relativeSizes(diameters),
    edges: sampled.edges,
    assemblyBias: bias,
    eyeFocus: [
      eyeSum[0]! / divisor,
      eyeSum[1]! / divisor,
      eyeSum[2]! / divisor
    ],
    bottom
  }
}
