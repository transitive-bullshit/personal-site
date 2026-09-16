'use client'

import { SearchIcon } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'

const SearchPalette = dynamic(() => import('./search-palette'), { ssr: false })

export function SiteSearch() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() === 'k' &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        !event.repeat &&
        !event.isComposing
      ) {
        event.preventDefault()
        setOpen((value) => !value)
      } else if (event.key === 'Escape') {
        // Also dismiss during the first-load window before the dialog mounts.
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          aria-label='Search pages and articles (Command K or Control K)'
          aria-keyshortcuts='Meta+K Control+K'
          title='Search (⌘K / Ctrl K)'
        >
          <SearchIcon aria-hidden='true' data-icon='inline-start' />
        </Button>
      </DialogTrigger>
      {open && <SearchPalette onClose={() => setOpen(false)} />}
    </Dialog>
  )
}
