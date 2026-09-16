'use client'

import { useState } from 'react'
import Image from 'next/image'

export function TweetAvatar(props: {
  src: string
  alt: string
  width: number
  height: number
}) {
  const [failed, setFailed] = useState<string>()
  const highResolution = props.src.replace(
    /^(https:\/\/pbs\.twimg\.com\/profile_images\/.+)_normal(\.[^/?]+)(\?.*)?$/,
    '$1_400x400$2$3'
  )
  // Only optimize the known Twitter avatar shape; preserve other hosts and
  // the original URL if the larger upstream image or optimizer is unavailable.
  if (failed === props.src || highResolution === props.src)
    return <img {...props} />

  return (
    <Image
      {...props}
      src={highResolution}
      onError={() => setFailed(props.src)}
    />
  )
}
