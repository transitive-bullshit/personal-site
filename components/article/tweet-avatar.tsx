'use client'

import { useState } from 'react'

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
  return (
    <img
      {...props}
      src={failed === props.src ? props.src : highResolution}
      onError={() => setFailed(props.src)}
    />
  )
}
