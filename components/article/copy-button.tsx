'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState('Copy')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <Button
      size='sm'
      variant='ghost'
      aria-label='Copy code'
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setStatus('Copied')
        } catch {
          setStatus('Select to copy')
        }
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setStatus('Copy'), 2200)
      }}
    >
      <span aria-live='polite'>{status}</span>
    </Button>
  )
}
