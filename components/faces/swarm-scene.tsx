'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import type { PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu'
import {
  createFacesStage,
  type FacesPortrait,
  type FacesStage
} from '@/lib/faces/faces-stage'

export function SwarmScene({
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
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const getState = useThree((state) => state.get)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const stage = useRef<FacesStage | null>(null)

  useEffect(() => {
    const instance = createFacesStage({
      renderer: gl as unknown as WebGPURenderer,
      scene: scene as unknown as Scene,
      camera: camera as PerspectiveCamera,
      portraits,
      captionElement: captionRef.current,
      onError,
      onPortraitShown,
      shortcuts
    })
    const { size } = getState()
    instance.resize(size.width, size.height)
    stage.current = instance
    return () => {
      instance.dispose()
      stage.current = null
    }
  }, [
    gl,
    scene,
    camera,
    getState,
    portraits,
    captionRef,
    onError,
    onPortraitShown,
    shortcuts
  ])

  useEffect(() => {
    stage.current?.resize(width, height)
  }, [width, height])

  // Priority 1 takes over rendering from R3F; the stage renders through its
  // own post-processing pipeline.
  useFrame(() => stage.current?.frame(), 1)

  return null
}
