'use client'

import { Canvas } from '@react-three/fiber'
import type { RefObject } from 'react'
import { WebGPURenderer } from 'three/webgpu'
import type { FacesPortrait } from '@/lib/faces/faces-stage'
import { SwarmScene } from './swarm-scene'

export default function FacesCanvas({
  portraits,
  captionRef,
  onError,
  onPortraitShown,
  shortcuts = false
}: {
  portraits: readonly FacesPortrait[]
  captionRef: RefObject<HTMLParagraphElement | null>
  onError: (message: string) => void
  onPortraitShown?: (
    portrait: FacesPortrait,
    index: number,
    pinned: boolean
  ) => void
  shortcuts?: boolean
}) {
  return (
    <Canvas
      className='faces-canvas'
      role='img'
      aria-label={`A swarm of small reflective spheres that assembles into a portrait of ${portraits[0]?.name ?? 'a person'}`}
      dpr={[1, 1.5]}
      shadows='percentage'
      camera={{ fov: 38, near: 0.1, far: 40, position: [0, 0.1, 5.8] }}
      gl={async ({ canvas }) => {
        const renderer = new WebGPURenderer({
          canvas: canvas as HTMLCanvasElement,
          antialias: true,
          alpha: false
        })
        await renderer.init()
        if (
          !(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
        ) {
          void renderer.dispose()
          onError('This prototype needs a browser with WebGPU compute support.')
        }
        return renderer
      }}
    >
      <SwarmScene
        portraits={portraits}
        captionRef={captionRef}
        onError={onError}
        onPortraitShown={onPortraitShown}
        shortcuts={shortcuts}
      />
    </Canvas>
  )
}
