// Everything the faces scene renders: the GPU swarm, its materials, the
// studio lighting, depth-of-field and bloom, pointer parallax and the
// portrait caption. React Three Fiber owns the canvas, renderer, camera and
// frame loop; this module owns the three.js objects inside them.

import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import {
  cameraWorldMatrix,
  float,
  instanceIndex,
  instancedBufferAttribute,
  mix,
  modelViewMatrix,
  mrt,
  normalLocal,
  output,
  pass,
  positionLocal,
  rotate,
  select,
  smoothstep,
  uniform,
  uv,
  varying,
  vec3,
  vec4
} from 'three/tsl'
import {
  BlendMode,
  Color,
  DirectionalLight,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MaterialBlending,
  MathUtils,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  RenderPipeline,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  type WebGPURenderer
} from 'three/webgpu'
import { createPortraitCaption } from './portrait-caption'
import { createPortraitShuffle } from './portrait-shuffle'
import type { PortraitAssignment } from './assignment'
import type { FacesWorkerRequest, FacesWorkerResponse } from './faces.worker'
import {
  createSwarmSimulation,
  stepInterval,
  type SwarmSimulation
} from './swarm-simulation'
import { createTimeline } from './timeline'

export type FacesPortrait = {
  /** Stable slug, shown in the debug label. */
  id: string
  name: string
  subtitle: string
  /** Public directory with portrait.webp, depth.bin, depth.json and features.json. */
  directory: string
}

const particleCount = 30_000
const background = '#090909'
const coreLightIntensity = 1.4

/** Bright soft boxes reflected in the particles, baked once into an envmap. */
function createEnvironment(renderer: WebGPURenderer) {
  const studio = new Scene()
  studio.background = new Color(0.006, 0.006, 0.006)
  const panel = new PlaneGeometry(1, 1)
  const glow = new MeshBasicNodeMaterial({
    color: new Color(2.5, 2.5, 2.5),
    side: DoubleSide
  })
  const panels: [number, number, number, number, number][] = [
    [-3, 4, 3, 2, 4],
    [4, 1, 2, 1, 3],
    [1, -2, -4, 2, 2]
  ]
  for (const [x, y, z, width, height] of panels) {
    const mesh = new Mesh(panel, glow)
    mesh.position.set(x, y, z)
    mesh.scale.set(width, height, 1)
    mesh.lookAt(0, 0, 0)
    studio.add(mesh)
  }
  const generator = new PMREMGenerator(renderer)
  const target = generator.fromScene(studio, 0.015)
  panel.dispose()
  glow.dispose()
  generator.dispose()
  return target
}

function createLights() {
  const key = new DirectionalLight(0xffffff, 3.4)
  key.position.set(-3, 4, 2.5)
  key.castShadow = true
  key.shadow.autoUpdate = false
  key.shadow.mapSize.set(2048, 2048)
  const shadowCamera = key.shadow.camera
  shadowCamera.left = shadowCamera.bottom = -2.1
  shadowCamera.right = shadowCamera.top = 2.1
  shadowCamera.near = 1
  shadowCamera.far = 12
  shadowCamera.updateProjectionMatrix()
  key.shadow.intensity = 0.85
  key.shadow.radius = 2.5
  key.shadow.normalBias = 8e-4
  key.shadow.bias = -2e-5

  const fill = new DirectionalLight(0xffffff, 0.35)
  fill.position.set(3, -1, -2)
  const front = new DirectionalLight(0xffffff, 0.28)
  front.position.set(0, 0.3, 5)
  // Warm glow from inside the swarm; it dims as the face forms.
  const core = new PointLight(0xffb878, coreLightIntensity, 2.2, 2)
  core.name = 'Swarm core light'
  return { key, fill, front, core }
}

function createUniforms() {
  return {
    /** Interpolation between the previous and current simulation step. */
    alpha: uniform(0),
    influence: uniform(0),
    releasing: uniform(0),
    focusDistance: uniform(4.8)
  }
}

type ParticleUniforms = ReturnType<typeof createUniforms>

/**
 * Instanced low-poly spheres driven by the simulation buffers, plus faint
 * motion streaks. Settled particles shrink to tile the face and take its
 * tone; their out-of-focus light is split into separate MRT targets.
 */
function createParticles(
  simulation: SwarmSimulation,
  uniforms: ParticleUniforms
) {
  const sphere = new SphereGeometry(0.5, 8, 6)
  const geometry = new InstancedBufferGeometry()
  geometry.index = sphere.index
  geometry.setAttribute('position', sphere.getAttribute('position'))
  geometry.setAttribute('normal', sphere.getAttribute('normal'))
  geometry.instanceCount = particleCount

  // Per-particle tumble angles and base diameter.
  const randoms = new Float32Array(particleCount * 4)
  for (let index = 0; index < particleCount; index++) {
    randoms.set(
      [
        Math.random() * 6.28,
        Math.random() * 6.28,
        Math.random() * 6.28,
        0.006_359_04 + Math.random() * 0.002_384_64
      ],
      index * 4
    )
  }
  const random = instancedBufferAttribute<'vec4'>(
    new InstancedBufferAttribute(randoms, 4),
    'vec4'
  )

  const { alpha, influence, releasing, focusDistance } = uniforms
  const previous = simulation.previous.element(instanceIndex).xyz
  const current = simulation.positions.element(instanceIndex).xyz
  const center = mix(previous, current, alpha)
  const target = simulation.targets.element(instanceIndex)
  const arrival = simulation.arrivals.element(instanceIndex)
  const delay = arrival.x

  // 1 once a particle has landed on its portrait target.
  const landed = mix(
    smoothstep(delay, delay.add(0.5), influence),
    smoothstep(arrival.z, arrival.z.add(0.38), influence.oneMinus()).oneMinus(),
    releasing
  )
  const detailStart = delay.mul(0.8).add(0.22)
  const detail = mix(
    smoothstep(detailStart, detailStart.add(0.38), influence),
    1,
    releasing
  )
  const settled = smoothstep(0.02, 0.22, center.sub(target.xyz).length())
    .oneMinus()
    .mul(landed)
    .mul(detail)

  // Nearer settled particles stay a little larger.
  const depthScale = smoothstep(-0.33, 0.5, target.z).mul(0.5).add(0.75)
  const baseDiameter = random.w.mul(1.749_006_25)
  const diameter = mix(
    baseDiameter,
    baseDiameter
      .mul(depthScale)
      .mul(arrival.w)
      .mul(0.8)
      .min(arrival.y.mul(0.9)),
    settled
  )
  const tumble = random.xyz.add(
    vec3(center.y.mul(0.21), center.z.mul(0.17), center.x.mul(-0.13))
  )

  const material = new MeshStandardNodeMaterial({
    color: 0xaaaaaa,
    metalness: 0.12,
    roughness: 0.4
  })
  material.positionNode = center.add(
    rotate(positionLocal.mul(diameter), tumble)
  )
  material.normalNode = modelViewMatrix
    .mul(vec4(rotate(normalLocal, tumble), 0))
    .xyz.normalize()

  // Free particles are lit from above; settled ones take the portrait tone.
  const shade = mix(
    center
      .normalize()
      .dot(vec3(-0.4, 0.7, 0.6).normalize())
      .max(0)
      .mul(0.12)
      .add(0.28),
    target.w.clamp(0, 1).mul(1.35).min(1),
    settled
  )
  material.colorNode = vec3(shade)
  material.roughnessNode = random.x.div(6.28).mul(0.08).add(0.36)

  // Depth of field: route light in front of and behind the focal plane into
  // separate targets so post-processing can blur each.
  const viewDepth = modelViewMatrix.mul(vec4(center, 1)).z.negate()
  const defocus = viewDepth
    .sub(focusDistance)
    .mul(focusDistance)
    .div(viewDepth.max(0.1))
  const blur = smoothstep(0.08, 0.85, defocus.abs()).mul(mix(1, 0.28, settled))
  const nearBlur = select(defocus.lessThan(0), blur, float(0))
  const farBlur = select(defocus.greaterThan(0), blur, float(0))
  material.mrtNode = mrt({
    nearLight: vec4(output.rgb.mul(nearBlur), nearBlur.oneMinus()),
    farLight: vec4(output.rgb.mul(farBlur), smoothstep(0, 0.15, farBlur))
  })

  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.castShadow = true
  mesh.receiveShadow = true

  const plane = new PlaneGeometry(1, 1)
  const trailGeometry = new InstancedBufferGeometry()
  trailGeometry.index = plane.index
  trailGeometry.setAttribute('position', plane.getAttribute('position'))
  trailGeometry.setAttribute('uv', plane.getAttribute('uv'))
  trailGeometry.instanceCount = particleCount
  const velocity = current.sub(previous).div(float(stepInterval).max(0.016))
  const speed = velocity.length()
  const viewVelocity = modelViewMatrix.mul(vec4(velocity, 0)).xyz
  const screenSpeed = viewVelocity.xy.length()
  const sideways = cameraWorldMatrix.mul(
    vec4(
      vec3(viewVelocity.y.negate(), viewVelocity.x, 0).div(
        screenSpeed.max(1e-4)
      ),
      0
    )
  ).xyz
  const streak = speed.mul(0.016).min(diameter.mul(1.2))
  const trailMaterial = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    side: DoubleSide
  })
  trailMaterial.positionNode = center
    .add(
      velocity
        .div(speed.max(1e-4))
        .mul(streak)
        .mul(positionLocal.x.add(0.5))
        .negate()
    )
    .add(sideways.mul(positionLocal.y).mul(diameter).mul(0.3))
  trailMaterial.colorNode = vec3(shade.mul(0.6).add(0.02))
  const visibility = varying(
    smoothstep(0.9, 1.7, screenSpeed),
    'trailVisibility'
  )
  const taper = float(1).sub(smoothstep(0.25, 1, uv().y.sub(0.5).mul(2).abs()))
  trailMaterial.opacityNode = uv()
    .x.oneMinus()
    .pow(2)
    .mul(taper)
    .mul(visibility)
    .mul(0.06)
  const trails = new Mesh(trailGeometry, trailMaterial)
  trails.frustumCulled = false

  return {
    mesh,
    trails,
    dispose() {
      sphere.dispose()
      geometry.dispose()
      material.dispose()
      plane.dispose()
      trailGeometry.dispose()
      trailMaterial.dispose()
    }
  }
}

/**
 * Splits sharp light from the blurred near and far layers, recombines them
 * and adds a restrained bloom.
 */
function createPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: PerspectiveCamera
) {
  const scenePass = pass(scene, camera)
  const materialBlending = new BlendMode(MaterialBlending)
  scenePass.setMRT(
    mrt({ output, nearLight: vec4(0), farLight: vec4(0) })
      .setBlendMode('nearLight', materialBlending)
      .setBlendMode('farLight', materialBlending)
  )
  const color = scenePass.getTextureNode('output')
  const near = scenePass.getTextureNode('nearLight')
  const far = scenePass.getTextureNode('farLight')
  const pixelRatio = renderer.getPixelRatio()
  const nearBlurred = gaussianBlur(near, 0.95 * pixelRatio, 3)
  const farBlurred = gaussianBlur(far, 0.75 * pixelRatio, 2)
  const sharp = color.rgb
    .sub(near.rgb)
    .sub(far.rgb)
    .max(0)
    .add(farBlurred.rgb.mul(far.a))
  const nearCoverage = near.a.sub(nearBlurred.a).max(0)
  const composite = vec4(
    sharp.mul(nearCoverage.oneMinus()).add(nearBlurred.rgb),
    1
  )
  const glow = bloom(composite, 0.12, 0.1, 0.9)
  const pipeline = new RenderPipeline(renderer, composite.add(glow))
  return {
    render: () => pipeline.render(),
    dispose() {
      glow.dispose()
      nearBlurred.dispose()
      farBlurred.dispose()
      scenePass.dispose()
      pipeline.dispose()
    }
  }
}

export function createFacesStage({
  renderer,
  scene,
  camera,
  portraits,
  captionElement,
  onError,
  onPortraitShown,
  shortcuts = false
}: {
  renderer: WebGPURenderer
  scene: Scene
  camera: PerspectiveCamera
  /** Faces to cycle through in random order. */
  portraits: readonly FacesPortrait[]
  captionElement: HTMLElement | null
  onError: (message: string) => void
  /** Called as each portrait starts assembling. */
  onPortraitShown?: (
    portrait: FacesPortrait,
    index: number,
    pinned: boolean
  ) => void
  /**
   * Debug keys: ←/→ jump to the previous/next face with a shortened
   * transition and hold it there; Esc resumes the random loop.
   */
  shortcuts?: boolean
}) {
  renderer.toneMappingExposure = 0.95
  scene.background = new Color(background)
  const environment = createEnvironment(renderer)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.3

  const simulation = createSwarmSimulation(renderer, particleCount)
  const uniforms = createUniforms()
  const particles = createParticles(simulation, uniforms)
  const lights = createLights()
  scene.add(
    particles.mesh,
    particles.trails,
    lights.key,
    lights.fill,
    lights.front,
    lights.core
  )
  const pipeline = createPipeline(renderer, scene, camera)
  const caption = captionElement
    ? createPortraitCaption(captionElement)
    : undefined

  // Undisturbed framing; parallax orbits around it.
  const baseCamera = new PerspectiveCamera(38, 1, 0.1, 40)
  let width = 1
  let height = 1

  // Pointer parallax (mouse and pen only; touch would fight scrolling).
  const pointer = new Vector2()
  const smoothedPointer = new Vector2()
  const element = renderer.domElement
  const onPointerMove = (event: PointerEvent) => {
    if (!event.isPrimary || event.pointerType === 'touch') return
    const bounds = element.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    pointer.set(
      MathUtils.clamp(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -1,
        1
      ),
      MathUtils.clamp(
        1 - ((event.clientY - bounds.top) / bounds.height) * 2,
        -1,
        1
      )
    )
  }
  const resetPointer = () => pointer.set(0, 0)
  element.addEventListener('pointermove', onPointerMove, { passive: true })
  element.addEventListener('pointerleave', resetPointer)
  element.addEventListener('pointercancel', resetPointer)
  window.addEventListener('blur', resetPointer)

  // Portrait sampling and matching run in a worker. Portraits load one at a
  // time in random order; each swarm phase asks for a fresh assignment of the
  // particles' current positions to the next face in the shuffle.
  const timeline = createTimeline()
  const shuffle = createPortraitShuffle(portraits.length)
  const loaded = new Map<
    number,
    { eyeFocus: Vector3; captionAnchor: Vector3 }
  >()
  const failed = new Set<number>()
  const loadOrder = createPortraitShuffle(portraits.length)
  let requested = false
  let request = 0
  let prepared: { portrait: number; assignment: PortraitAssignment } | undefined
  let shown: FacesPortrait | undefined
  let shownIndex = -1
  // A face picked with the arrow keys, assembled next instead of the shuffle.
  let forced: number | undefined
  const eyeFocus = new Vector3()
  const captionAnchor = new Vector3()
  const worker = new Worker(new URL('./faces.worker.ts', import.meta.url), {
    type: 'module'
  })

  const loadNext = () => {
    const next = loadOrder.next(
      (index) => !loaded.has(index) && !failed.has(index)
    )
    if (next < 0) return
    const message: FacesWorkerRequest = {
      type: 'load',
      portrait: next,
      directory: new URL(portraits[next]!.directory, window.location.href).href,
      count: particleCount
    }
    worker.postMessage(message)
  }

  worker.addEventListener(
    'message',
    ({ data }: MessageEvent<FacesWorkerResponse>) => {
      if (data.type === 'error') {
        if (data.request === 'assign') {
          requested = false
          return
        }
        // Skip a broken portrait; give up only when none can load.
        failed.add(data.portrait)
        if (failed.size === portraits.length) onError(data.message)
        else loadNext()
      } else if (data.type === 'loaded') {
        loaded.set(data.portrait, {
          eyeFocus: new Vector3().fromArray(data.eyeFocus),
          captionAnchor: new Vector3(0, data.bottom - 0.13, 0)
        })
        loadNext()
      } else if (data.id === request) {
        prepared = {
          portrait: data.portrait,
          assignment: {
            targets: data.targets,
            arrivals: data.arrivals,
            gather: data.gather
          }
        }
      }
    }
  )
  worker.addEventListener('error', () =>
    onError('Could not prepare the portrait.')
  )
  loadNext()

  let accumulator = 0
  let previousInfluence = 0
  let currentInfluence = 0
  let lastTime = 0
  let clock = 0
  let nextShadowUpdate = 0
  let captionVisible = false
  const focusTarget = new Vector3()
  const focus = new Vector3()
  const projected = new Vector3()

  const requestAssignment = () => {
    const portrait = forced ?? shuffle.next((index) => loaded.has(index))
    if (portrait < 0 || !loaded.has(portrait)) return
    requested = true
    const id = ++request
    simulation
      .snapshot()
      .then((positions) => {
        const message: FacesWorkerRequest = {
          type: 'assign',
          id,
          portrait,
          positions
        }
        worker.postMessage(message, [positions.buffer])
      })
      .catch(() => {
        requested = false
      })
  }

  /** Step to the previous or next loaded face, cutting the cycle short. */
  const jump = (direction: 1 | -1) => {
    const count = portraits.length
    const base = forced ?? Math.max(0, shownIndex)
    for (let offset = 1; offset <= count; offset++) {
      const next = (((base + direction * offset) % count) + count) % count
      if (!loaded.has(next)) continue
      forced = next
      // Drop any assignment made for the face that was coming up.
      request++
      prepared = undefined
      requested = false
      timeline.jump()
      return
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable]'))
    ) {
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      jump(event.key === 'ArrowRight' ? 1 : -1)
    } else if (event.key === 'Escape') {
      timeline.resume()
      if (shown) onPortraitShown?.(shown, shownIndex, false)
    }
  }
  if (shortcuts) window.addEventListener('keydown', onKeyDown)

  return {
    resize(nextWidth: number, nextHeight: number) {
      width = Math.max(1, nextWidth)
      height = Math.max(1, nextHeight)
      camera.fov = 38
      camera.near = 0.1
      camera.far = 40
      camera.aspect = width / height
      // Pull back on narrow screens so the face never crops.
      camera.position.set(0, 0.1, Math.max(5.8, 3.87 / camera.aspect))
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      baseCamera.copy(camera)
    },
    frame() {
      const now = performance.now()
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0
      lastTime = now
      clock += delta

      lights.key.position.set(
        -3 + Math.sin(clock * 0.16) * 0.65,
        4 + Math.sin(clock * 0.13) * 0.25,
        2.5 + Math.sin(clock * 0.11) * 0.45
      )

      // Fixed 30 Hz simulation steps, interpolated for rendering.
      accumulator = Math.min(accumulator + delta, stepInterval * 3)
      while (accumulator >= stepInterval) {
        const step = timeline.advance(stepInterval, prepared !== undefined)
        if (step.assign && prepared) {
          simulation.setPortrait(prepared.assignment)
          const anchors = loaded.get(prepared.portrait)!
          eyeFocus.copy(anchors.eyeFocus)
          captionAnchor.copy(anchors.captionAnchor)
          shown = portraits[prepared.portrait]
          shownIndex = prepared.portrait
          if (forced === shownIndex) forced = undefined
          if (shown) onPortraitShown?.(shown, shownIndex, step.pinned)
          prepared = undefined
          requested = false
        }
        captionVisible =
          step.phase === 'hold' ||
          (step.phase === 'assemble' && step.influence >= 0.93)
        previousInfluence = currentInfluence
        currentInfluence = step.influence
        uniforms.releasing.value = step.phase === 'release' ? 1 : 0
        simulation.step(step.influence, step.phase === 'release')
        // Snapshot late in the swarm so the matching reflects where the
        // particles will be when assembly starts.
        if (
          step.phase === 'swarm' &&
          loaded.size > 0 &&
          !requested &&
          !prepared &&
          step.elapsed >= (step.quick ? 0 : 0.9)
        ) {
          requestAssignment()
        }
        accumulator -= stepInterval
      }

      uniforms.alpha.value = accumulator / stepInterval
      const influence =
        previousInfluence +
        (currentInfluence - previousInfluence) * uniforms.alpha.value
      uniforms.influence.value = influence
      lights.core.intensity = MathUtils.lerp(
        coreLightIntensity,
        coreLightIntensity * 0.35,
        MathUtils.smoothstep(influence, 0, 1)
      )

      // Focus moves from the swarm's center to the eyes as the face forms.
      focusTarget.copy(eyeFocus).multiplyScalar(influence)
      focus.lerp(focusTarget, 1 - Math.exp(-delta * 5))

      smoothedPointer.lerp(pointer, 1 - Math.exp(-delta * 10))
      const yaw = -smoothedPointer.x * 0.36 * influence
      const pitch =
        Math.atan2(baseCamera.position.y, baseCamera.position.z) -
        smoothedPointer.y * 0.21 * influence
      const distance = baseCamera.position.length()
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * distance,
        Math.sin(pitch) * distance,
        Math.cos(yaw) * Math.cos(pitch) * distance
      )
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      uniforms.focusDistance.value = Math.max(
        camera.near,
        -projected.copy(focus).applyMatrix4(camera.matrixWorldInverse).z
      )

      if (caption) {
        caption.update(
          shown?.name ?? '',
          shown?.subtitle ?? '',
          captionVisible && shown !== undefined,
          delta
        )
        if (captionVisible) {
          projected.copy(captionAnchor).project(baseCamera)
          caption.position(
            (projected.x * 0.5 + 0.5) * width,
            MathUtils.clamp(
              (0.5 - projected.y * 0.5) * height + 16,
              20,
              height - 58
            )
          )
        }
      }

      // Shadows re-render while particles move, then at 15 fps once settled.
      if (influence < 1 || now >= nextShadowUpdate) {
        lights.key.shadow.needsUpdate = true
        nextShadowUpdate = now + 1000 / 15
      }

      pipeline.render()
    },
    dispose() {
      worker.terminate()
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('pointerleave', resetPointer)
      element.removeEventListener('pointercancel', resetPointer)
      window.removeEventListener('blur', resetPointer)
      window.removeEventListener('keydown', onKeyDown)
      caption?.dispose()
      scene.remove(
        particles.mesh,
        particles.trails,
        lights.key,
        lights.fill,
        lights.front,
        lights.core
      )
      particles.dispose()
      pipeline.dispose()
      simulation.dispose()
      lights.key.shadow.dispose()
      lights.core.dispose()
      scene.environment = null
      environment.dispose()
    }
  }
}

export type FacesStage = ReturnType<typeof createFacesStage>
