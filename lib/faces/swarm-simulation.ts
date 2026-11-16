// GPU particle swarm. Particles flock (separation, alignment, cohesion inside
// a breathing ellipsoid) while a gyroid-like folding field shears them into
// thin sheets. When a portrait is assigned, each particle is pulled toward
// its target with critically damped springs, staggered by its arrival delay.

import { instanceIndex, storage, uniform, wgslFn } from 'three/tsl'
import {
  StorageInstancedBufferAttribute,
  Vector3,
  Vector4,
  type WebGPURenderer
} from 'three/webgpu'
import type { PortraitAssignment } from './assignment'

/** Fixed simulation step. */
export const stepInterval = 1 / 30
/** The flow runs faster than real time; this is its per-step time advance. */
const flowStep = stepInterval * 3

const gridSize = 96
const gridSlots = 12

const clearGrid = wgslFn(`
fn clear_grid(
  id: u32,
  cells: ptr<storage, array<u32>, read_write>,
  grid: ptr<storage, array<atomic<u32>>, read_write>
) -> void {
  if (id >= arrayLength(cells)) { return; }
  let start = (*cells)[id] * ${gridSlots}u;
  for (var slot = 0u; slot < ${gridSlots}u; slot++) { atomicStore(&(*grid)[start + slot], 0u); }
}`)

const buildGrid = wgslFn(`
fn build_grid(
  id: u32,
  positions: ptr<storage, array<vec4f>, read_write>,
  cells: ptr<storage, array<u32>, read_write>,
  grid: ptr<storage, array<atomic<u32>>, read_write>
) -> void {
  if (id >= arrayLength(positions)) { return; }
  let cell = vec3u(clamp(floor(((*positions)[id].xyz + 1.92) / .04), vec3f(0), vec3f(${gridSize - 1})));
  let key = cell.x + cell.y * ${gridSize}u + cell.z * ${gridSize * gridSize}u;
  (*cells)[id] = key;
  // Keep each cell's slots sorted by index; the smallest overflow is dropped.
  var carry = id + 1u;
  for (var slot = 0u; slot < ${gridSlots}u; slot++) {
    let displaced = atomicMax(&(*grid)[key * ${gridSlots}u + slot], carry);
    carry = min(displaced, carry);
    if (carry == 0u) { break; }
  }
}`)

const integrate = wgslFn(`
fn integrate_swarm(
  id: u32,
  positions: ptr<storage, array<vec4f>, read_write>,
  previous: ptr<storage, array<vec4f>, read_write>,
  velocities: ptr<storage, array<vec4f>, read_write>,
  nextVelocity: ptr<storage, array<vec4f>, read_write>,
  dt: f32
) -> void {
  if (id >= arrayLength(positions)) { return; }
  (*previous)[id] = (*positions)[id];
  (*velocities)[id] = (*nextVelocity)[id];
  (*positions)[id] = vec4f((*positions)[id].xyz + (*nextVelocity)[id].xyz * dt, 0);
}`)

const solveForces = wgslFn(`
fn solve_forces(
  id: u32,
  positions: ptr<storage, array<vec4f>, read_write>,
  velocities: ptr<storage, array<vec4f>, read_write>,
  offsets: ptr<storage, array<vec4f>, read_write>,
  grid: ptr<storage, array<atomic<u32>>, read_write>,
  targets: ptr<storage, array<vec4f>, read>,
  arrivals: ptr<storage, array<vec4f>, read>,
  gather: ptr<storage, array<vec4f>, read>,
  nextVelocity: ptr<storage, array<vec4f>, read_write>,
  clock: vec4f, phases: vec4f, frequencies: vec4f, strengths: vec4f, phase: vec4f,
  spin: vec3f, inverse: vec3f, bounds: vec4f, dt: f32
) -> void {
  if (id >= arrayLength(positions)) { return; }
  let p = (*positions)[id].xyz;
  let velocity = (*velocities)[id].xyz;
  let destination = (*targets)[id].xyz;
  let arrival = (*arrivals)[id];
  let staging = (*gather)[id];
  let influence = clock.z;
  let releasing = clock.w > .5;
  let hasPortrait = bounds.z > .5;
  let gathering = hasPortrait && !releasing;

  // How strongly this particle belongs to the portrait right now, and how
  // far it has moved from its loose staging spot to its exact target.
  var detail = 1.0;
  var weight = 0.0;
  if (hasPortrait) {
    if (releasing) {
      weight = 1.0 - smoothstep(arrival.z, arrival.z + .38, 1.0 - influence);
    } else {
      detail = smoothstep(.22 + arrival.x * .8, .60 + arrival.x * .8, influence);
      weight = max(smoothstep(arrival.x, arrival.x + .5, influence),
        smoothstep(arrival.x * .6, arrival.x * .6 + .38, influence) * .65);
    }
  }
  let mobility = select(0.0, staging.w, hasPortrait);
  let error = destination - p;
  if (hasPortrait && weight == 1.0 && detail == 1.0 && mobility == 0.0 &&
    dot(error, error) <= .0000000025 && dot(velocity, velocity) <= .00000025) {
    (*nextVelocity)[id] = vec4f(0); (*offsets)[id] = vec4f(0); return;
  }

  // Flocking from neighbors within 0.04 units.
  let freeWeight = (1.0 - weight) * (1.0 - weight);
  var separation = vec3f(0);
  var sumVelocity = vec3f(0);
  var neighbors = 0.0;
  if (freeWeight > 0.0) {
    let cell = vec3i(clamp(floor((p + 1.92) / .04), vec3f(0), vec3f(${gridSize - 1})));
    let low = max(vec3f(0), p - (vec3f(cell) * .04 - 1.92));
    let high = max(vec3f(0), (vec3f(cell) + 1.0) * .04 - 1.92 - p);
    let lo = max(cell - 1, vec3i(0));
    let hi = min(cell + 1, vec3i(${gridSize - 1}));
    for (var z = lo.z; z <= hi.z; z++) {
      let dz = select(select(0.0, high.z, z > cell.z), low.z, z < cell.z);
      for (var y = lo.y; y <= hi.y; y++) {
        let dy = select(select(0.0, high.y, y > cell.y), low.y, y < cell.y);
        let yz = dz * dz + dy * dy;
        if (yz >= .0016) { continue; }
        for (var x = lo.x; x <= hi.x; x++) {
          let dx = select(select(0.0, high.x, x > cell.x), low.x, x < cell.x);
          if (yz + dx * dx >= .0016) { continue; }
          let start = u32(x + y * ${gridSize} + z * ${gridSize * gridSize}) * ${gridSlots}u;
          for (var slot = 0u; slot < ${gridSlots}u; slot++) {
            let entry = atomicLoad(&(*grid)[start + slot]);
            if (entry == 0u) { break; }
            let other = entry - 1u;
            if (other == id) { continue; }
            let delta = p - (*positions)[other].xyz;
            let squared = dot(delta, delta);
            if (squared >= .0016) { continue; }
            let otherVelocity = (*velocities)[other].xyz;
            sumVelocity += otherVelocity; neighbors += 1.0;
            if (squared < .000576 && squared > .0000000001) {
              let distance = sqrt(squared);
              let overlap = 1.0 - distance / .024;
              let contact = overlap * overlap * (3.0 - 2.0 * overlap);
              let closing = dot(velocity - otherVelocity, delta) / distance;
              separation += delta * ((contact * 1.8 - closing * overlap * 1.2) / distance);
            }
          }
        }
      }
    }
  }

  // Ambient air: slow rotation plus layered sine currents.
  var air = cross(spin, p) + vec3f(sin(p.y * frequencies.x + phase.x) * strengths.x,
    sin(p.z * frequencies.y + phase.y) * strengths.y + cos(p.x * frequencies.z + phase.z) * .1,
    sin(p.y * frequencies.w + phase.w) * strengths.w);

  // A warped gyroid surface the swarm folds onto, giving thin curling sheets.
  let time = clock.x;
  let scale = 3.8 / (1.0 + clock.y * .18);
  let warp = p.yzx * vec3f(1.7, 1.5, 1.6) + phases.wxy;
  let uvw = p * scale + sin(warp) * vec3f(.5, .45, .5) + phases.xyz + time * vec3f(.065, -.055, .045);
  let s = sin(uvw); let c = cos(uvw);
  let derivative = vec3f(c.x * c.y - s.z * s.x, -s.x * s.y + c.y * c.z, -s.y * s.z + c.z * c.x);
  let gradient = derivative * scale + derivative.zxy * cos(warp.zxy) * vec3f(.8, .85, .675);
  let inverseGradient = 1.0 / max(.25, length(gradient));
  let normal = gradient * inverseGradient;
  let surface = (dot(s, c.yzx) - sin(time * .09 + phases.w) * .18) * inverseGradient;
  let offset = sign(surface) * max(0.0, abs(surface) - .025);
  let foldForce = -clamp(offset, -.3, .3) * 4.5 - dot(velocity, normal) * 1.1;

  // Eddies slide along the sheet instead of punching through it.
  let throughSheet = dot(air, normal);
  let eddy = p * vec3f(5.3, 4.7, 5.1) + phase.yzx;
  let sine = sin(eddy);
  let curl = cos(eddy) * (sine.yzx + sine.zxy) * vec3f(1.06, .94, 1.02);
  air += cross(normal, curl) * .3 - normal * throughSheet * .85;
  let peeling = select(0.0, 4.0 * weight * (1.0 - weight), releasing);
  air *= .8 + .35 * (1.0 - weight) + .3 * peeling;

  // Silhouette particles drift a little while the face holds.
  var drift = (*offsets)[id].xyz;
  drift += (air * mobility * weight * .7 - drift * .9) * dt;
  let maxDrift = select(0.0, .012 + .108 * mobility, mobility > 0.0);
  drift *= min(1.0, maxDrift / max(.0001, length(drift)));
  (*offsets)[id] = vec4f(drift, 0);

  var displacement = vec3f(0);
  if (hasPortrait) {
    displacement = destination + drift - p;
    if (gathering) { displacement += (staging.xyz - destination) * (1.0 - detail); }
  }
  let targetDistance = length(displacement);
  let direction = displacement / max(.0001, targetDistance);
  let radialSpeed = dot(velocity, direction);
  let landing = (1.0 - smoothstep(.025, .225, targetDistance)) * (.25 + detail * .75);

  let envelope = sqrt(dot(p * p, inverse));
  let cohesion = bounds.y + max(0.0, envelope - bounds.x) * 1.9;
  let average = select(velocity, sumVelocity / max(1.0, neighbors), neighbors > 0.0);
  let swarmForce = separation + normal * foldForce + (air - velocity) * 1.3 - p * cohesion + (average - velocity) * .8;
  let portraitForce = displacement * (8.0 + detail * 4.0) - direction * radialSpeed * (3.5 + landing * 3.4)
    - (velocity - direction * radialSpeed) * (.9 + landing * 6.0)
    + ((air - direction * dot(air, direction)) * 1.4 + cross(spin, displacement) * 2.2) * (1.0 - landing);
  let force = swarmForce * freeWeight + portraitForce * weight + air * (peeling * 1.2 + (1.0 - detail) * weight * .8);
  var next = velocity + clamp(force, vec3f(-4), vec3f(4)) * dt;
  next *= min(1.0, .75 / max(.0000001, length(next)));
  (*nextVelocity)[id] = vec4f(next, 0);
}`)

/** Initial swarm: a squashed ball with a gentle swirl. */
export function createInitialSwarm(count: number, random = Math.random) {
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) {
    const angle = random() * Math.PI * 2
    const height = random() * 2 - 1
    const radius = Math.cbrt(random())
    const ring = Math.sqrt(1 - height * height) * radius
    const x = Math.cos(angle) * ring * 1.05
    const y = height * radius * 0.78
    const z = Math.sin(angle) * ring * 0.66
    positions.set([x, y, z], index * 3)
    velocities.set([-z * 0.35, Math.sin(x * 3) * 0.08, x * 0.35], index * 3)
  }
  return { positions, velocities }
}

/**
 * Slowly varying flow parameters. The swarm alternates between opening up
 * and clumping together every few seconds.
 */
export function createFlowDriver(random = Math.random) {
  const theta = random() * Math.PI * 2
  const height = random() * 2 - 1
  const ring = Math.sqrt(1 - height * height)
  const spinAxis = [
    Math.cos(theta) * ring * 0.38,
    height * 0.38,
    Math.sin(theta) * ring * 0.38
  ]
  const phases = Array.from({ length: 4 }, () => random() * Math.PI * 2)
  const frequencies = Array.from({ length: 4 }, () => 1.8 + random() * 1.4)
  const rates = Array.from(
    { length: 4 },
    () => (0.2 + random() * 0.2) * (random() < 0.5 ? -1 : 1)
  )
  const strengths = Array.from({ length: 4 }, () => 0.12 + random() * 0.08)
  const spread = spinAxis.map((component) => Math.abs(component) / 0.38)

  let time = random() * 20
  let elapsed = 0
  let duration = 3.5 + random() * 3
  let from = 0.35
  let to = 0.8 + random() * 0.2
  let opening = true

  return {
    phases,
    frequencies,
    strengths,
    advance(influence: number) {
      time += flowStep * (1.12 - 0.47 * influence)
      elapsed += stepInterval
      if (elapsed >= duration) {
        elapsed -= duration
        from = to
        opening = !opening
        to = opening ? 0.8 + random() * 0.2 : 0.05 + random() * 0.2
        duration = 3.5 + random() * 3
      }
      const t = Math.min(1, elapsed / duration)
      const eased = t * t * t * (t * (t * 6 - 15) + 10)
      const openness = from + (to - from) * eased
      const inverse = (base: number, axis: number) =>
        1 / (base * (1 + 0.2 * openness * spread[axis]!) ** 2)
      return {
        time,
        openness,
        inverse: [
          inverse(1.21, 0),
          inverse(0.81, 1),
          inverse(0.64, 2)
        ] as const,
        boundary: 0.78 + 0.24 * openness,
        inwardPull: 0.17 - 0.115 * openness,
        phase: phases.map((value, index) => value + time * rates[index]!),
        spin: [
          spinAxis[0]! + Math.sin(time * 0.11 + phases[0]!) * 0.07,
          spinAxis[1]! + Math.sin(time * 0.13 + phases[1]!) * 0.07,
          spinAxis[2]! + Math.sin(time * 0.09 + phases[2]!) * 0.07
        ] as const
      }
    }
  }
}

function toVec4(values: Float32Array) {
  const padded = new Float32Array((values.length / 3) * 4)
  for (let index = 0; index < values.length / 3; index++) {
    padded[index * 4] = values[index * 3]!
    padded[index * 4 + 1] = values[index * 3 + 1]!
    padded[index * 4 + 2] = values[index * 3 + 2]!
  }
  return padded
}

export function createSwarmSimulation(renderer: WebGPURenderer, count: number) {
  const initial = createInitialSwarm(count)
  const buffer = (array = new Float32Array(count * 4)) =>
    new StorageInstancedBufferAttribute(array, 4)
  const buffers = {
    positions: buffer(toVec4(initial.positions)),
    previous: buffer(toVec4(initial.positions)),
    velocities: buffer(toVec4(initial.velocities)),
    nextVelocity: buffer(),
    offsets: buffer(),
    targets: buffer(),
    arrivals: buffer(),
    gather: buffer(),
    cells: new StorageInstancedBufferAttribute(new Uint32Array(count), 1),
    grid: new StorageInstancedBufferAttribute(
      new Uint32Array(gridSize ** 3 * gridSlots),
      1
    )
  }

  const positions = storage(buffers.positions, 'vec4', count)
  const previous = storage(buffers.previous, 'vec4', count)
  const velocities = storage(buffers.velocities, 'vec4', count)
  const nextVelocity = storage(buffers.nextVelocity, 'vec4', count)
  const offsets = storage(buffers.offsets, 'vec4', count)
  const targets = storage(buffers.targets, 'vec4', count).toReadOnly()
  const arrivals = storage(buffers.arrivals, 'vec4', count).toReadOnly()
  const gather = storage(buffers.gather, 'vec4', count).toReadOnly()
  const cells = storage(buffers.cells, 'uint', count)
  const grid = storage(
    buffers.grid,
    'uint',
    gridSize ** 3 * gridSlots
  ).toAtomic()

  const clock = uniform(new Vector4())
  const phase = uniform(new Vector4())
  const phases = uniform(new Vector4())
  const frequencies = uniform(new Vector4())
  const strengths = uniform(new Vector4())
  const spin = uniform(new Vector3())
  const inverse = uniform(new Vector3())
  const bounds = uniform(new Vector4())
  const dt = uniform(flowStep)

  const flow = createFlowDriver()
  phases.value.fromArray(flow.phases)
  frequencies.value.fromArray(flow.frequencies)
  strengths.value.fromArray(flow.strengths)
  let hasPortrait = false

  const clearPass = clearGrid({ id: instanceIndex, cells, grid }).compute(count)
  const gridPass = buildGrid({
    id: instanceIndex,
    positions,
    cells,
    grid
  }).compute(count)
  const forcePass = solveForces({
    id: instanceIndex,
    positions,
    velocities,
    offsets,
    grid,
    targets,
    arrivals,
    gather,
    nextVelocity,
    clock,
    phase,
    phases,
    frequencies,
    strengths,
    spin,
    inverse,
    bounds,
    dt
  }).compute(count)
  const integratePass = integrate({
    id: instanceIndex,
    positions,
    previous,
    velocities,
    nextVelocity,
    dt
  }).compute(count)
  const fullStep = [clearPass, gridPass, forcePass, integratePass]
  // Once every particle is pinned to the portrait, neighbors don't matter.
  const pinnedStep = [forcePass, integratePass]

  return {
    /** Current and previous positions, for interpolating between steps. */
    positions: storage(buffers.positions, 'vec4', count).toReadOnly(),
    previous: storage(buffers.previous, 'vec4', count).toReadOnly(),
    targets,
    arrivals,
    setPortrait(assignment: PortraitAssignment) {
      const sources = [
        [buffers.targets, assignment.targets],
        [buffers.arrivals, assignment.arrivals],
        [buffers.gather, assignment.gather]
      ] as const
      for (const [attribute, values] of sources) {
        if (values.length !== count * 4) {
          throw new Error(
            'Portrait particle count does not match the simulation.'
          )
        }
        attribute.array.set(values)
        attribute.needsUpdate = true
      }
      hasPortrait = true
    },
    step(influence: number, releasing: boolean) {
      const state = flow.advance(influence)
      clock.value.set(state.time, state.openness, influence, releasing ? 1 : 0)
      phase.value.fromArray(state.phase)
      spin.value.set(...state.spin)
      inverse.value.set(...state.inverse)
      bounds.value.set(state.boundary, state.inwardPull, hasPortrait ? 1 : 0, 0)
      void renderer.compute(
        hasPortrait && influence === 1 ? pinnedStep : fullStep
      )
    },
    /** Reads positions back from the GPU as xyz triples. */
    async snapshot() {
      const data = new Float32Array(
        await renderer.getArrayBufferAsync(buffers.positions)
      )
      const xyz = new Float32Array(count * 3)
      for (let index = 0; index < count; index++) {
        xyz[index * 3] = data[index * 4]!
        xyz[index * 3 + 1] = data[index * 4 + 1]!
        xyz[index * 3 + 2] = data[index * 4 + 2]!
      }
      return xyz
    },
    dispose() {
      for (const node of fullStep) node.dispose()
    }
  }
}

export type SwarmSimulation = ReturnType<typeof createSwarmSimulation>
