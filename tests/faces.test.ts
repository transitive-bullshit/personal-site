import { describe, expect, it } from 'vitest'
import { assignPortrait, matchClouds } from '../lib/faces/assignment'
import {
  buildPortraitCloud,
  samplePortrait,
  type PortraitFeatures,
  type PortraitSource
} from '../lib/faces/portrait'
import { createTimeline } from '../lib/faces/timeline'
import { validateSlug } from '../lib/content/routes'

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

function randomCloud(count: number, random: () => number) {
  return Float32Array.from({ length: count * 3 }, () => random() * 2 - 1)
}

/** A bright oval "face" on black with a soft depth bump. */
function syntheticPortrait(width: number, height: number): PortraitSource {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const depth = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x + 0.5) / width - 0.5
      const ny = (y + 0.5) / height - 0.45
      const radius = (nx / 0.3) ** 2 + (ny / 0.35) ** 2
      const index = x + y * width
      const value = radius < 1 ? 60 + Math.round(160 * (1 - radius)) : 0
      pixels.set([value, value, value, 255], index * 4)
      depth[index] = Math.max(0, 1 - radius * 0.6)
    }
  }
  return {
    width,
    height,
    depth,
    pixels,
    imageWidth: width,
    imageHeight: height
  }
}

const features: PortraitFeatures = {
  noseGuard: { center: [0.5, 0.5], radius: [0.05, 0.05] },
  features: [
    {
      name: 'left eye socket',
      center: [0.4, 0.4],
      radius: [0.06, 0.03],
      amount: -0.026
    },
    {
      name: 'right eye socket',
      center: [0.6, 0.4],
      radius: [0.06, 0.03],
      amount: -0.026
    },
    {
      name: 'lip separation',
      center: [0.5, 0.6],
      radius: [0.07, 0.004],
      amount: -0.036
    }
  ]
}

describe('faces timeline', () => {
  it('loops swarm, assemble, hold and release', () => {
    const timeline = createTimeline()
    const phases: string[] = []
    let assigned = 0
    for (let step = 0; step < 300; step++) {
      const { phase, assign } = timeline.advance(1 / 30, true)
      if (assign) assigned++
      if (phases.at(-1) !== phase) phases.push(phase)
    }
    expect(phases).toEqual(['swarm', 'assemble', 'hold', 'release', 'swarm'])
    expect(assigned).toBe(1)
  })

  it('keeps swarming until a portrait is ready', () => {
    const timeline = createTimeline()
    for (let step = 0; step < 200; step++) {
      expect(timeline.advance(1 / 30, false)).toMatchObject({
        phase: 'swarm',
        influence: 0
      })
    }
    expect(timeline.advance(1 / 30, true)).toMatchObject({
      phase: 'assemble',
      assign: true
    })
  })

  it('ramps influence up while assembling and down while releasing', () => {
    const timeline = createTimeline({
      swarm: 1,
      assemble: 1,
      hold: 1,
      release: 1
    })
    expect(timeline.advance(1.5, true)).toMatchObject({
      phase: 'assemble',
      influence: 0.5
    })
    expect(timeline.advance(1, true)).toMatchObject({
      phase: 'hold',
      influence: 1
    })
    expect(timeline.advance(1.25, true)).toMatchObject({
      phase: 'release',
      influence: 0.25
    })
  })
})

describe('faces particle matching', () => {
  it('assigns every target exactly once', () => {
    const random = seeded(7)
    const mapping = matchClouds(
      randomCloud(500, random),
      randomCloud(500, random),
      1
    )
    expect(new Set(mapping).size).toBe(500)
    expect(Math.max(...mapping)).toBe(499)
  })

  it('keeps particles in place when the clouds already coincide', () => {
    const cloud = randomCloud(300, seeded(3))
    const mapping = matchClouds(cloud, cloud.slice(), 2)
    expect(Array.from(mapping)).toEqual(
      Array.from({ length: 300 }, (_, index) => index)
    )
  })

  it('beats an arbitrary assignment on total travel', () => {
    const random = seeded(11)
    const sources = randomCloud(400, random)
    const targets = randomCloud(400, random)
    const mapping = matchClouds(sources, targets, 0.5)
    const travel = (pick: (index: number) => number) => {
      let total = 0
      for (let index = 0; index < 400; index++) {
        const target = pick(index)
        total += Math.hypot(
          sources[index * 3]! - targets[target * 3]!,
          sources[index * 3 + 1]! - targets[target * 3 + 1]!
        )
      }
      return total
    }
    expect(travel((index) => mapping[index]!)).toBeLessThan(
      travel((index) => index) * 0.3
    )
  })
})

describe('faces portrait sampling', () => {
  const source = syntheticPortrait(64, 96)
  const sampled = samplePortrait(source, 600, [])
  const cloud = buildPortraitCloud(
    sampled,
    features,
    source.width / source.height
  )

  it('samples only visible pixels', () => {
    expect(sampled.count).toBe(600)
    for (let index = 0; index < sampled.count; index++) {
      const u = sampled.points[index * 4]! / (3.7 * (64 / 96)) + 0.5
      const v = 0.5 - sampled.points[index * 4 + 1]! / 3.7
      expect(
        (u - 0.5) ** 2 / 0.3 ** 2 + (v - 0.45) ** 2 / 0.35 ** 2
      ).toBeLessThan(1.1)
    }
  })

  it('normalizes the portrait to a fixed height around the origin', () => {
    let minY = Infinity
    let maxY = -Infinity
    for (let index = 0; index < cloud.count; index++) {
      minY = Math.min(minY, cloud.positions[index * 3 + 1]!)
      maxY = Math.max(maxY, cloud.positions[index * 3 + 1]!)
    }
    expect(maxY - minY).toBeGreaterThan(2.2)
    expect(maxY - minY).toBeLessThan(2.8)
    expect(cloud.bottom).toBeCloseTo(minY)
    expect(cloud.eyeFocus[1]).toBeGreaterThan(0)
  })

  it('builds GPU buffers for every particle', () => {
    const swarm = randomCloud(600, seeded(5))
    const assignment = assignPortrait(swarm, cloud, 1)
    expect(assignment.targets).toHaveLength(2400)
    expect(assignment.arrivals).toHaveLength(2400)
    expect(assignment.gather).toHaveLength(2400)
    for (let index = 0; index < 600; index++) {
      const delay = assignment.arrivals[index * 4]!
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(0.5)
    }
  })
})

describe('faces route', () => {
  it('reserves /faces so content cannot shadow it', () => {
    expect(() => validateSlug('faces')).toThrow('faces')
  })
})
