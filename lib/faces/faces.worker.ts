// Portrait sampling and particle matching run here so the swarm keeps
// animating while a face is prepared.

import { assignPortrait } from './assignment'
import {
  buildPortraitCloud,
  featureDetailRegions,
  samplePortrait,
  type PortraitCloud,
  type PortraitFeatures
} from './portrait'

export type FacesWorkerRequest =
  | { type: 'load'; directory: string; count: number }
  | { type: 'assign'; id: number; positions: Float32Array }

export type FacesWorkerResponse =
  | {
      type: 'loaded'
      eyeFocus: [number, number, number]
      bottom: number
    }
  | {
      type: 'assigned'
      id: number
      targets: Float32Array
      arrivals: Float32Array
      gather: Float32Array
    }
  | { type: 'error'; message: string }

type DepthMetadata = {
  width: number
  height: number
  encoding: string
  nearIsWhite: boolean
}

// The project compiles against the DOM lib, so describe just the worker scope
// this file uses.
const scope = globalThis as unknown as {
  postMessage(message: FacesWorkerResponse, transfer: Transferable[]): void
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<FacesWorkerRequest>) => void
  ): void
}

let portrait: PortraitCloud | undefined

async function fetchOk(url: string) {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Could not load ${url} (${response.status}).`)
  return response
}

async function loadPortrait(directory: string, count: number) {
  const [metadata, depthBuffer, image, features] = await Promise.all([
    fetchOk(`${directory}/depth.json`).then(
      (response) => response.json() as Promise<DepthMetadata>
    ),
    fetchOk(`${directory}/depth.bin`).then((response) =>
      response.arrayBuffer()
    ),
    fetchOk(`${directory}/portrait.webp`).then((response) => response.blob()),
    fetchOk(`${directory}/features.json`).then(
      (response) => response.json() as Promise<PortraitFeatures>
    )
  ])

  const { width, height } = metadata
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    metadata.encoding !== 'uint16-le' ||
    !metadata.nearIsWhite ||
    depthBuffer.byteLength !== width * height * 2
  ) {
    throw new Error('The portrait depth data is invalid.')
  }

  const bitmap = await createImageBitmap(image)
  if (Math.abs(bitmap.width / bitmap.height - width / height) > 0.01) {
    bitmap.close()
    throw new Error(
      'The portrait and depth map must have the same aspect ratio.'
    )
  }
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read the portrait pixels.')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const view = new DataView(depthBuffer)
  const depth = new Float32Array(width * height)
  for (let index = 0; index < depth.length; index++) {
    depth[index] = view.getUint16(index * 2, true) / 65_535
  }

  const source = {
    width,
    height,
    depth,
    pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
    imageWidth: canvas.width,
    imageHeight: canvas.height
  }
  const sampled = samplePortrait(source, count, featureDetailRegions(features))
  return buildPortraitCloud(sampled, features, width / height)
}

function post(message: FacesWorkerResponse, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer)
}

scope.addEventListener('message', async ({ data }) => {
  try {
    if (data.type === 'load') {
      portrait = await loadPortrait(data.directory, data.count)
      post({
        type: 'loaded',
        eyeFocus: portrait.eyeFocus,
        bottom: portrait.bottom
      })
      return
    }
    if (!portrait) throw new Error('The portrait has not loaded yet.')
    const { targets, arrivals, gather } = assignPortrait(
      data.positions,
      portrait
    )
    post({ type: 'assigned', id: data.id, targets, arrivals, gather }, [
      targets.buffer,
      arrivals.buffer,
      gather.buffer
    ])
  } catch (err) {
    post({
      type: 'error',
      message:
        err instanceof Error ? err.message : 'Could not prepare the portrait.'
    })
  }
})
