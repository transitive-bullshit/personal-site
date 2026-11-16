// Decides which swarm particle flies to which portrait target. A near-optimal
// screen-space matching keeps flight paths short and parallel, so the face
// condenses out of the swarm instead of scrambling across it.

import { hash, type PortraitCloud } from './portrait'

/** Buffers in the layout the swarm compute shader reads. */
export type PortraitAssignment = {
  /** Target xyz and tone. */
  targets: Float32Array
  /** Arrival delay, settled diameter, release delay, size factor. */
  arrivals: Float32Array
  /** Loose "gathering" position near the target, plus edge mobility. */
  gather: Float32Array
}

type Point = { x: Float32Array; y: Float32Array; z: Float32Array }

function split(positions: Float32Array): Point {
  const count = positions.length / 3
  const point = {
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count)
  }
  for (let index = 0; index < count; index++) {
    point.x[index] = positions[index * 3]!
    point.y[index] = positions[index * 3 + 1]!
    point.z[index] = positions[index * 3 + 2]! * 0.06
  }
  return point
}

/** Partially sorts `order[low..high]` so the k-th element is in place. */
function select(
  order: Uint32Array,
  key: Float32Array,
  low: number,
  high: number,
  k: number
) {
  while (low < high) {
    const pivot = key[order[(low + high) >>> 1]!]!
    let left = low
    let right = high
    while (left <= right) {
      while (key[order[left]!]! < pivot) left++
      while (key[order[right]!]! > pivot) right--
      if (left <= right) {
        const swap = order[left]!
        order[left++] = order[right]!
        order[right--] = swap
      }
    }
    if (k <= right) high = right
    else if (k >= left) low = left
    else break
  }
}

/**
 * Matches sources to targets with recursive bisection, exact Hungarian
 * assignment within small leaves, then local swaps that shorten paths.
 * Returns `mapping[source] = target`.
 */
export function matchClouds(
  sourcePositions: Float32Array,
  targetPositions: Float32Array,
  phase = 0
) {
  const count = sourcePositions.length / 3
  if (targetPositions.length !== count * 3) {
    throw new Error('Particle clouds must have the same size.')
  }

  const source = split(sourcePositions)
  const target = split(targetPositions)
  const sources = Uint32Array.from({ length: count }, (_, index) => index)
  const targets = sources.slice()
  const mapping = new Uint32Array(count)
  const sourceKey = new Float32Array(count)
  const targetKey = new Float32Array(count)

  const planar = (from: number, to: number) =>
    (source.x[from]! - target.x[to]!) ** 2 +
    (source.y[from]! - target.y[to]!) ** 2
  const cost = (from: number, to: number) => {
    const squared = planar(from, to)
    return (
      squared + squared * squared * 4 + (source.z[from]! - target.z[to]!) ** 2
    )
  }

  const hungarian = (start: number, end: number) => {
    const size = end - start
    const matrix = new Float64Array(size * size)
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        matrix[row * size + column] = cost(
          sources[start + row]!,
          targets[start + column]!
        )
      }
    }
    const rowPotential = new Float64Array(size + 1)
    const columnPotential = new Float64Array(size + 1)
    const matchedRow = new Uint32Array(size + 1)
    const way = new Uint32Array(size + 1)
    const minimum = new Float64Array(size + 1)
    const used = new Uint8Array(size + 1)
    for (let row = 1; row <= size; row++) {
      matchedRow[0] = row
      minimum.fill(Infinity)
      used.fill(0)
      let column = 0
      do {
        used[column] = 1
        const current = matchedRow[column]!
        let delta = Infinity
        let nextColumn = 0
        for (let candidate = 1; candidate <= size; candidate++) {
          if (used[candidate]) continue
          const reduced =
            matrix[(current - 1) * size + candidate - 1]! -
            rowPotential[current]! -
            columnPotential[candidate]!
          if (reduced < minimum[candidate]!) {
            minimum[candidate] = reduced
            way[candidate] = column
          }
          if (minimum[candidate]! < delta) {
            delta = minimum[candidate]!
            nextColumn = candidate
          }
        }
        for (let candidate = 0; candidate <= size; candidate++) {
          if (used[candidate]) {
            rowPotential[matchedRow[candidate]!]! += delta
            columnPotential[candidate]! -= delta
          } else {
            minimum[candidate]! -= delta
          }
        }
        column = nextColumn
      } while (matchedRow[column])
      do {
        const previous = way[column]!
        matchedRow[column] = matchedRow[previous]!
        column = previous
      } while (column)
    }
    for (let column = 1; column <= size; column++) {
      mapping[sources[start + matchedRow[column]! - 1]!] =
        targets[start + column - 1]!
    }
  }

  const bisect = (start: number, end: number) => {
    if (end - start <= 16) {
      hungarian(start, end)
      return
    }

    let sourceMinX = Infinity
    let sourceMaxX = -Infinity
    let sourceMinY = Infinity
    let sourceMaxY = -Infinity
    let targetMinX = Infinity
    let targetMaxX = -Infinity
    let targetMinY = Infinity
    let targetMaxY = -Infinity
    for (let index = start; index < end; index++) {
      const from = sources[index]!
      const to = targets[index]!
      sourceMinX = Math.min(sourceMinX, source.x[from]!)
      sourceMaxX = Math.max(sourceMaxX, source.x[from]!)
      sourceMinY = Math.min(sourceMinY, source.y[from]!)
      sourceMaxY = Math.max(sourceMaxY, source.y[from]!)
      targetMinX = Math.min(targetMinX, target.x[to]!)
      targetMaxX = Math.max(targetMaxX, target.x[to]!)
      targetMinY = Math.min(targetMinY, target.y[to]!)
      targetMaxY = Math.max(targetMaxY, target.y[to]!)
    }
    const spanX = sourceMaxX - sourceMinX + targetMaxX - targetMinX
    const spanY = sourceMaxY - sourceMinY + targetMaxY - targetMinY
    const axis = spanX >= spanY ? 0 : 1

    // Cut along a slightly wavy, tilted line so the leaf regions are
    // irregular; straight cuts leave visible seams in the flight paths.
    const seed = start * 17 + end * 31 + Math.floor(phase * 1e6)
    const angle = (axis * Math.PI) / 2 + (hash(seed) - 0.5) * 1.3
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const extent = Math.max(0.02, spanX + spanY)
    const wave = hash(seed + 1) * Math.PI * 2
    const project = (x: number, y: number) =>
      x * cos +
      y * sin +
      Math.sin(((-x * sin + y * cos) * 6) / extent + wave) * extent * 0.035
    for (let index = start; index < end; index++) {
      const from = sources[index]!
      const to = targets[index]!
      sourceKey[from] = project(source.x[from]!, source.y[from]!)
      targetKey[to] = project(target.x[to]!, target.y[to]!)
    }

    const middle = (start + end) >>> 1
    select(sources, sourceKey, start, end - 1, middle)
    select(targets, targetKey, start, end - 1, middle)
    bisect(start, middle)
    bisect(middle, end)
  }
  bisect(0, count)

  // Swap partners when it shortens the total path without making either
  // particle travel further than before.
  const trySwap = (a: number, b: number) => {
    const targetA = mapping[a]!
    const targetB = mapping[b]!
    if (
      Math.max(planar(a, targetB), planar(b, targetA)) >
      Math.max(planar(a, targetA), planar(b, targetB)) + 1e-10
    ) {
      return
    }
    if (
      cost(a, targetB) + cost(b, targetA) + 1e-10 <
      cost(a, targetA) + cost(b, targetB)
    ) {
      mapping[a] = targetB
      mapping[b] = targetA
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let index = 0; index < count; index++) {
      for (const offset of [1, 4, 16, 64]) {
        if (index + offset < count)
          trySwap(sources[index]!, sources[index + offset]!)
      }
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < count; index++) {
    minX = Math.min(minX, source.x[index]!)
    maxX = Math.max(maxX, source.x[index]!)
    minY = Math.min(minY, source.y[index]!)
    maxY = Math.max(maxY, source.y[index]!)
  }
  const cell = Math.max(
    0.015,
    Math.sqrt(((maxX - minX) * (maxY - minY)) / count) * 2.5
  )
  const columns = Math.floor((maxX - minX) / cell) + 1
  const rows = Math.floor((maxY - minY) / cell) + 1
  const heads = new Map<number, number>()
  const next = new Int32Array(count).fill(-1)
  for (let index = 0; index < count; index++) {
    const key =
      Math.floor((source.x[index]! - minX) / cell) +
      Math.floor((source.y[index]! - minY) / cell) * columns
    next[index] = heads.get(key) ?? -1
    heads.set(key, index)
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let index = 0; index < count; index++) {
      const column = Math.floor((source.x[index]! - minX) / cell)
      const row = Math.floor((source.y[index]! - minY) / cell)
      for (
        let r = Math.max(0, row - 1);
        r <= Math.min(rows - 1, row + 1);
        r++
      ) {
        for (
          let c = Math.max(0, column - 1);
          c <= Math.min(columns - 1, column + 1);
          c++
        ) {
          let other = heads.get(c + r * columns) ?? -1
          for (let visited = 0; other !== -1 && visited < 8; visited++) {
            if (other > index) trySwap(index, other)
            other = next[other]!
          }
        }
      }
    }
  }

  return mapping
}

/** Arrival order: outside in, with a little ripple and per-particle jitter. */
function arrivalDelay(
  x: number,
  y: number,
  z: number,
  phase: number,
  index: number
) {
  const ripple =
    0.5 +
    0.22 * Math.sin(x * 3 + y * 2 + phase) +
    0.18 * Math.sin(y * 3 - z * 2 + phase * 1.7) +
    0.1 * Math.sin(z * 2 - x + phase * 0.7)
  const jitter = hash((index + 1) ^ Math.floor(phase * 1e6))
  return Math.max(
    0,
    Math.min(
      0.5,
      Math.min(1, Math.hypot(x, y)) * 0.42 + ripple * 0.02 + jitter * 0.06
    )
  )
}

/** Release order: the feathered silhouette peels away before the face. */
function releaseDelay(
  x: number,
  y: number,
  z: number,
  edge: number,
  phase: number
) {
  const ripple =
    0.5 +
    0.25 * Math.sin(x * 3.1 + y * 2.3 + phase) +
    0.25 * Math.sin(y * 2.6 - z * 3.7 - phase * 0.8)
  return 0.04 + (1 - Math.max(0, Math.min(1, edge))) * 0.42 + ripple * 0.16
}

/** Loose, flattened staging positions the swarm gathers into before landing. */
function gatherPositions(positions: Float32Array, phase: number) {
  const count = positions.length / 3
  const gathered = new Float32Array(positions.length)
  if (!count) return gathered
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let meanZ = 0
  for (let index = 0; index < count; index++) {
    minX = Math.min(minX, positions[index * 3]!)
    maxX = Math.max(maxX, positions[index * 3]!)
    minY = Math.min(minY, positions[index * 3 + 1]!)
    maxY = Math.max(maxY, positions[index * 3 + 1]!)
    meanZ += positions[index * 3 + 2]! / count
  }
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const halfWidth = Math.max(0.1, (maxX - minX) / 2)
  const halfHeight = Math.max(0.1, (maxY - minY) / 2)
  const seed = Math.floor(phase * 1e6)
  for (let index = 0; index < count; index++) {
    const x = positions[index * 3]!
    const y = positions[index * 3 + 1]!
    const z = positions[index * 3 + 2]!
    const nx = (x - centerX) / halfWidth
    const ny = (y - centerY) / halfHeight
    const thickness = Math.sqrt(
      Math.max(0.06, 1 - nx * nx * 0.65 - ny * ny * 0.6)
    )
    gathered[index * 3] =
      x +
      (hash(seed + index * 3) - 0.5) * 0.14 +
      Math.sin(y * 2 + phase) * 0.025
    gathered[index * 3 + 1] = y + (hash(seed + index * 3 + 1) - 0.5) * 0.1
    gathered[index * 3 + 2] =
      meanZ +
      (z - meanZ) * 0.3 +
      (hash(seed + index * 3 + 2) * 2 - 1) * 0.42 * thickness
  }
  return gathered
}

/** Builds the per-particle portrait buffers for the current swarm positions. */
export function assignPortrait(
  swarmPositions: Float32Array,
  portrait: PortraitCloud,
  phase = Math.random() * Math.PI * 2
): PortraitAssignment {
  const count = portrait.count
  const mapping = matchClouds(swarmPositions, portrait.positions, phase)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let index = 0; index < count; index++) {
    minX = Math.min(minX, portrait.positions[index * 3]!)
    maxX = Math.max(maxX, portrait.positions[index * 3]!)
    minY = Math.min(minY, portrait.positions[index * 3 + 1]!)
    maxY = Math.max(maxY, portrait.positions[index * 3 + 1]!)
  }
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const halfWidth = Math.max(0.1, (maxX - minX) / 2)
  const halfHeight = Math.max(0.1, (maxY - minY) / 2)

  const assigned = new Float32Array(count * 3)
  const targets = new Float32Array(count * 4)
  const arrivals = new Float32Array(count * 4)
  const mobility = new Float32Array(count)
  for (let index = 0; index < count; index++) {
    const destination = mapping[index]!
    const x = portrait.positions[destination * 3]!
    const y = portrait.positions[destination * 3 + 1]!
    const z = portrait.positions[destination * 3 + 2]!
    assigned.set([x, y, z], index * 3)
    targets.set([x, y, z, portrait.tones[destination]!], index * 4)

    const delay = Math.max(
      0,
      Math.min(
        0.5,
        arrivalDelay(
          (x - centerX) / halfWidth,
          (y - centerY) / halfHeight,
          z,
          phase,
          destination
        ) + portrait.assemblyBias[destination]!
      )
    )
    const edge = portrait.edges[destination]!
    const drift = Math.max(0, Math.min(1, (edge - 0.85) / 0.15))
    mobility[index] =
      drift *
      drift *
      (3 - 2 * drift) *
      0.21 *
      (0.9 + hash(destination + 5831) * 0.2)
    arrivals.set(
      [
        delay,
        portrait.diameters[destination]!,
        releaseDelay(x, y, z, edge, phase),
        portrait.sizeFactors[destination]!
      ],
      index * 4
    )
  }

  const staged = gatherPositions(assigned, phase)
  const gather = new Float32Array(count * 4)
  for (let index = 0; index < count; index++) {
    gather.set(staged.subarray(index * 3, index * 3 + 3), index * 4)
    gather[index * 4 + 3] = mobility[index]!
  }
  return { targets, arrivals, gather }
}
