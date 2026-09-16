'use client'

import { Command } from 'cmdk'
import { SearchIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import { loadSearchIndex } from '@/lib/load-search-index'
import { searchDocuments, type SearchIndex } from '@/lib/search'
import './search-palette.css'

const styles = ['Vercel', 'Linear', 'Raycast', 'Framer'] as const
type SearchStyle = (typeof styles)[number]
const styleKey = 'cmdk-preview-style'
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

function savedStyle(): SearchStyle {
  try {
    const saved = localStorage.getItem(styleKey)
    return styles.find((style) => style === saved) ?? 'Vercel'
  } catch {
    return 'Vercel'
  }
}

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const prefetched = useRef(new Set<string>())
  const [index, setIndex] = useState<SearchIndex>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState('')
  const [style, setStyle] = useState(savedStyle)
  const results = useMemo(
    () => searchDocuments(index?.documents ?? [], query),
    [index, query]
  )
  const activeHref = results.some((result) => result.href === selection)
    ? selection
    : (results[0]?.href ?? '')
  const topHref = results[0]?.href

  useEffect(() => {
    let cancelled = false
    loadSearchIndex().then(
      (loaded) => {
        if (!cancelled) setIndex(loaded)
      },
      () => {
        if (!cancelled) setFailed(true)
      }
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  useEffect(() => {
    // Explicitly prefetch both the best match and any keyboard/hover selection.
    for (const href of [topHref, activeHref]) {
      if (!href || prefetched.current.has(href)) continue
      prefetched.current.add(href)
      router.prefetch(href)
    }
  }, [topHref, activeHref, router])

  function changeQuery(value: string) {
    setQuery(value)
    setSelection('')
  }

  function changeStyle(value: SearchStyle) {
    setStyle(value)
    try {
      localStorage.setItem(styleKey, value)
    } catch {
      // Previewing still works if browser storage is unavailable.
    }
    inputRef.current?.focus()
  }

  return (
    <DialogContent
      className='search-dialog'
      overlayClassName='search-overlay'
      data-search-style={style.toLowerCase()}
      showCloseButton={false}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        inputRef.current?.focus()
      }}
    >
      <DialogTitle className='sr-only'>Search projects and writing</DialogTitle>
      <DialogDescription className='sr-only'>
        Search by title or keyword. Use the arrow keys to choose a result and
        Enter to open it. Escape closes search.
      </DialogDescription>
      <Command
        label='Search projects and writing'
        shouldFilter={false}
        value={activeHref}
        onValueChange={setSelection}
        loop
        vimBindings={false}
      >
        <div className='search-input-row'>
          <SearchIcon aria-hidden='true' className='size-4' />
          <Command.Input
            ref={inputRef}
            placeholder='Search projects and writing…'
            value={query}
            onValueChange={changeQuery}
          />
          {query ? (
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className='search-clear'
              aria-label='Clear search'
              onKeyDown={(event) => event.stopPropagation()}
              onClick={() => {
                changeQuery('')
                inputRef.current?.focus()
              }}
            >
              <XIcon aria-hidden='true' data-icon='inline-start' />
            </Button>
          ) : (
            <kbd className='search-shortcut' aria-hidden='true'>
              ⌘K
            </kbd>
          )}
          <Button
            type='button'
            variant='ghost'
            size='xs'
            className='search-escape'
            aria-label='Close search'
            onKeyDown={(event) => event.stopPropagation()}
            onClick={onClose}
          >
            esc
          </Button>
        </div>
        <Command.List label='Projects, writing, and pages'>
          {!index && !failed && (
            <Command.Loading label='Loading search index'>
              <div className='search-message'>Loading search…</div>
            </Command.Loading>
          )}
          {failed && (
            <div className='search-message' role='status'>
              <span>Search couldn’t load.</span>
              <Button
                variant='outline'
                size='sm'
                onKeyDown={(event) => event.stopPropagation()}
                onClick={() => {
                  setFailed(false)
                  setAttempt((value) => value + 1)
                  inputRef.current?.focus()
                }}
              >
                Try again
              </Button>
            </div>
          )}
          {index && (
            <>
              <Command.Empty>
                No matches. Try another title or keyword.
              </Command.Empty>
              <Command.Group value='site-content'>
                {results.map((result, position) => (
                  <Command.Item
                    key={result.href}
                    value={result.href}
                    onSelect={() => {
                      onClose()
                      router.push(result.href)
                    }}
                  >
                    <Link
                      href={result.href}
                      className='search-result-link'
                      tabIndex={-1}
                      prefetch={position === 0 ? true : false}
                      onClick={(event) => event.stopPropagation()}
                      onNavigate={onClose}
                    >
                      {result.kind === 'project' ? (
                        <span className='search-result-kind'>Project</span>
                      ) : result.published ? (
                        <time dateTime={result.published}>
                          {dateFormatter.format(new Date(result.published))}
                        </time>
                      ) : (
                        <span className='search-result-kind'>Page</span>
                      )}
                      <span className='search-result-title'>
                        {result.title}
                      </span>
                    </Link>
                  </Command.Item>
                ))}
              </Command.Group>
            </>
          )}
        </Command.List>
      </Command>
      <footer className='search-footer'>
        <div className='search-keyboard-hint' aria-hidden='true'>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> choose
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
        </div>
        <div
          className='search-style-preview'
          role='group'
          aria-label='Debug: cmdk style preview'
        >
          <span className='search-style-label'>Preview style</span>
          {styles.map((option) => (
            <Button
              key={option}
              type='button'
              variant='ghost'
              size='xs'
              aria-pressed={style === option}
              onClick={() => changeStyle(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </footer>
    </DialogContent>
  )
}
