'use client'

import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type {
  LinkPreviewData,
  LinkPreviewScope,
  LinkPreviewTarget
} from '@/lib/link-preview'
import { resolveLinkPreviewTarget } from '@/lib/link-preview'

const externalCacheKey = 'personal-site:link-previews:v1'
const externalCacheAge = 24 * 60 * 60_000
const failureCacheAge = 5 * 60_000
const cacheLimit = 128

type CacheEntry = {
  data?: LinkPreviewData
  expires: number
}

type ActivePreview = {
  anchor: DOMRect
  cacheKey: string
  data?: LinkPreviewData
  fallbackTitle: string
  loading: boolean
  pointerX?: number
  url: string
}

type Candidate = {
  anchor: HTMLAnchorElement
  target: LinkPreviewTarget
}

const externalCache = new Map<string, CacheEntry>()
const externalRequests = new Map<string, Promise<LinkPreviewData | undefined>>()
const imageRequests = new Map<string, Promise<void>>()
let storageLoaded = false

function trimCache<T>(cache: Map<string, T>, limit = cacheLimit) {
  while (cache.size > limit) cache.delete(cache.keys().next().value!)
}

function loadStoredCache() {
  if (storageLoaded || typeof window === 'undefined') return
  storageLoaded = true
  try {
    const saved = JSON.parse(
      window.sessionStorage.getItem(externalCacheKey) ?? '[]'
    ) as [string, CacheEntry][]
    const now = Date.now()
    for (const [url, entry] of saved.slice(-cacheLimit)) {
      if (entry.expires > now) externalCache.set(url, entry)
    }
  } catch {
    window.sessionStorage.removeItem(externalCacheKey)
  }
}

function storeCache() {
  try {
    window.sessionStorage.setItem(
      externalCacheKey,
      JSON.stringify([...externalCache.entries()])
    )
  } catch {
    // Memory caching remains available when storage is blocked or full.
  }
}

function cachedExternal(url: string) {
  loadStoredCache()
  const entry = externalCache.get(url)
  if (!entry) return undefined
  if (entry.expires <= Date.now()) {
    externalCache.delete(url)
    return undefined
  }
  externalCache.delete(url)
  externalCache.set(url, entry)
  return entry
}

function resolveExternalPreview(url: string) {
  const cached = cachedExternal(url)
  if (cached) return Promise.resolve(cached.data)
  const pending = externalRequests.get(url)
  if (pending) return pending

  const request = fetch('/api/link-preview?url=' + encodeURIComponent(url), {
    headers: { Accept: 'application/json' }
  })
    .then(async (response) => {
      if (!response.ok) return undefined
      return (await response.json()) as LinkPreviewData
    })
    .catch(() => undefined)
    .then((data) => {
      externalCache.set(url, {
        data,
        expires: Date.now() + (data ? externalCacheAge : failureCacheAge)
      })
      trimCache(externalCache)
      storeCache()
      return data
    })
    .finally(() => externalRequests.delete(url))
  externalRequests.set(url, request)
  return request
}

function preloadImage(src?: string) {
  if (!src || typeof window === 'undefined') return Promise.resolve()
  const existing = imageRequests.get(src)
  if (existing) return existing
  const request = new Promise<void>((resolve) => {
    const image = new Image()
    image.decoding = 'async'
    image.fetchPriority = 'low'
    image.referrerPolicy = 'no-referrer'
    const complete = () => resolve()
    image.addEventListener('load', () => {
      void image
        .decode?.()
        .catch(() => {})
        .finally(complete)
    })
    image.addEventListener('error', complete)
    image.src = src
  })
  imageRequests.set(src, request)
  trimCache(imageRequests)
  return request
}

function host(url: string) {
  try {
    return new URL(url, window.location.origin).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function PreviewCard({ preview }: { preview: ActivePreview }) {
  const ref = useRef<HTMLElement>(null)
  const [height, setHeight] = useState(160)
  const [imageReady, setImageReady] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const width = Math.min(320, Math.max(0, window.innerWidth - 24))
  const left = Math.max(
    12,
    Math.min(
      preview.pointerX ?? preview.anchor.left,
      window.innerWidth - width - 12
    )
  )
  const roomAbove = preview.anchor.top - 24
  const roomBelow = window.innerHeight - preview.anchor.bottom - 24
  const above = roomAbove > roomBelow
  const top = Math.max(
    12,
    above
      ? preview.anchor.top - height - 12
      : Math.min(window.innerHeight - height - 12, preview.anchor.bottom + 12)
  )
  const image = preview.data?.image

  useLayoutEffect(() => {
    const card = ref.current
    if (!card) return
    const measure = () => setHeight(card.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    return () => observer.disconnect()
  }, [preview])

  const title =
    preview.data?.title || preview.fallbackTitle || host(preview.url)
  const description = preview.data?.description
  const showImage = Boolean(image && !imageFailed)
  return (
    <aside
      ref={ref}
      className='link-preview-card'
      aria-hidden='true'
      data-placement={above ? 'top' : 'bottom'}
      style={{
        left,
        top,
        width,
        transformOrigin: `${Math.max(0, Math.min(width, (preview.pointerX ?? preview.anchor.left) - left))}px ${above ? 'bottom' : 'top'}`
      }}
    >
      {showImage ? (
        <div className='link-preview-media' data-ready={imageReady}>
          <div className='link-preview-image-skeleton' />
          {/* The endpoint validates and caches remote image bytes server-side. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={preview.data?.imageAlt ?? ''}
            decoding='async'
            referrerPolicy='no-referrer'
            onLoad={() => setImageReady(true)}
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : null}
      <div className='link-preview-content'>
        <div className='link-preview-source'>
          {preview.data?.siteName || host(preview.data?.url || preview.url)}
        </div>
        {preview.loading ? (
          <div className='link-preview-text-skeleton'>
            <span />
            <span />
          </div>
        ) : (
          <>
            <div className='link-preview-title'>{title}</div>
            {description ? (
              <div className='link-preview-description'>{description}</div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  )
}

export function LinkPreviewProvider({
  internalPreviews
}: {
  internalPreviews: LinkPreviewData[]
}) {
  const router = useRouter()
  const [active, setActive] = useState<ActivePreview>()
  const activeElement = useRef<HTMLAnchorElement | undefined>(undefined)
  const dismissed = useRef<HTMLAnchorElement | undefined>(undefined)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const keyboardInput = useRef(true)
  const internal = useMemo(
    () => new Map(internalPreviews.map((preview) => [preview.url, preview])),
    [internalPreviews]
  )
  const internalPaths = useMemo(() => new Set(internal.keys()), [internal])

  const candidateFor = useCallback(
    (anchor: HTMLAnchorElement): Candidate | undefined => {
      if (anchor.closest('[data-link-preview="false"]')) return undefined
      const scope = anchor.closest<HTMLElement>('[data-link-preview-scope]')
        ?.dataset.linkPreviewScope as LinkPreviewScope | undefined
      if (!scope) return undefined
      const target = resolveLinkPreviewTarget(
        anchor.href,
        window.location.origin,
        scope,
        internalPaths
      )
      return target ? { anchor, target } : undefined
    },
    [internalPaths]
  )

  const close = useCallback(() => {
    clearTimeout(openTimer.current)
    activeElement.current = undefined
    setActive(undefined)
  }, [])

  const open = useCallback(
    (candidate: Candidate, pointerX?: number) => {
      const { anchor, target } = candidate
      if (dismissed.current === anchor || activeElement.current === anchor)
        return
      const internalData = target.internal
        ? internal.get(target.cacheKey)
        : undefined
      const externalData = target.internal
        ? undefined
        : cachedExternal(target.cacheKey)?.data
      activeElement.current = anchor
      setActive({
        anchor: anchor.getBoundingClientRect(),
        cacheKey: target.cacheKey,
        data: internalData ?? externalData,
        fallbackTitle: anchor.textContent?.trim() ?? '',
        loading: !internalData && !externalData,
        pointerX,
        url: target.href
      })
      if (target.internal) {
        router.prefetch(target.href)
        void preloadImage(internalData?.image)
        return
      }
      void resolveExternalPreview(target.href).then((data) => {
        if (activeElement.current !== anchor) return
        setActive((current) =>
          current?.cacheKey === target.cacheKey
            ? { ...current, data, loading: false }
            : current
        )
        void preloadImage(data?.image)
      })
    },
    [internal, router]
  )

  useEffect(() => {
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)')
    const anchorFrom = (event: Event) =>
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>('a[href]')
        : null
    const within = (anchor: HTMLAnchorElement, related: EventTarget | null) =>
      related instanceof Node && anchor.contains(related)
    const pointerOver = (event: PointerEvent) => {
      if (!hover.matches || event.pointerType !== 'mouse' || event.buttons)
        return
      const anchor = anchorFrom(event)
      if (!anchor || within(anchor, event.relatedTarget)) return
      const candidate = candidateFor(anchor)
      if (!candidate) return
      clearTimeout(openTimer.current)
      openTimer.current = setTimeout(() => open(candidate, event.clientX), 180)
    }
    const pointerOut = (event: PointerEvent) => {
      const anchor = anchorFrom(event)
      if (!anchor || within(anchor, event.relatedTarget)) return
      if (dismissed.current === anchor) dismissed.current = undefined
      if (activeElement.current === anchor) close()
      else clearTimeout(openTimer.current)
    }
    const focusIn = (event: FocusEvent) => {
      if (!keyboardInput.current) return
      const anchor = anchorFrom(event)
      const candidate = anchor && candidateFor(anchor)
      if (candidate) open(candidate)
    }
    const focusOut = (event: FocusEvent) => {
      const anchor = anchorFrom(event)
      if (!anchor || within(anchor, event.relatedTarget)) return
      if (dismissed.current === anchor) dismissed.current = undefined
      if (activeElement.current === anchor) close()
    }
    const keyDown = (event: KeyboardEvent) => {
      keyboardInput.current = true
      if (event.key !== 'Escape' || !activeElement.current) return
      dismissed.current = activeElement.current
      close()
    }
    const pointerDown = () => {
      keyboardInput.current = false
      close()
    }
    const events = new AbortController()
    const options = { signal: events.signal, passive: true }
    document.addEventListener('pointerover', pointerOver, options)
    document.addEventListener('pointerout', pointerOut, options)
    document.addEventListener('focusin', focusIn, options)
    document.addEventListener('focusout', focusOut, options)
    document.addEventListener('keydown', keyDown, options)
    document.addEventListener('pointerdown', pointerDown, {
      ...options,
      capture: true
    })
    document.addEventListener('scroll', close, {
      ...options,
      capture: true
    })
    window.addEventListener('resize', close, options)
    return () => events.abort()
  }, [candidateFor, close, open])

  useEffect(() => {
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)')
    const connection = (
      navigator as Navigator & {
        connection?: EventTarget & {
          effectiveType?: string
          saveData?: boolean
        }
      }
    ).connection
    const visible = new Map<string, Map<HTMLAnchorElement, Candidate>>()
    const observed = new Map<HTMLAnchorElement, string>()
    const warmed = new Set<string>()
    const events = new AbortController()
    let running = false
    let loaded = document.readyState === 'complete'
    let quietUntil = Date.now() + 500
    let timer: ReturnType<typeof setTimeout> | undefined
    let idle: number | undefined

    const available = () =>
      hover.matches &&
      loaded &&
      document.visibilityState === 'visible' &&
      navigator.onLine !== false &&
      !connection?.saveData &&
      !['slow-2g', '2g'].includes(connection?.effectiveType ?? '')

    const cancelScheduled = () => {
      clearTimeout(timer)
      timer = undefined
      if (idle !== undefined) window.cancelIdleCallback(idle)
      idle = undefined
    }

    const nextCandidate = () => {
      for (const [key, candidates] of visible) {
        if (warmed.has(key)) continue
        for (const candidate of candidates.values()) {
          if (candidate.anchor.isConnected) return candidate
        }
      }
    }

    const warm = async (candidate: Candidate) => {
      const { target } = candidate
      if (target.internal) {
        router.prefetch(target.href)
        await preloadImage(internal.get(target.cacheKey)?.image)
      } else {
        const data = await resolveExternalPreview(target.href)
        await preloadImage(data?.image)
      }
      warmed.add(target.cacheKey)
    }

    const schedule = () => {
      if (timer || idle !== undefined || running || !available()) return
      if (!nextCandidate()) return
      timer = setTimeout(
        () => {
          timer = undefined
          if (!available()) return
          const run = async () => {
            idle = undefined
            const candidate = nextCandidate()
            if (!candidate) return
            running = true
            try {
              await warm(candidate)
            } finally {
              running = false
              quietUntil = Date.now() + 300
              schedule()
            }
          }
          if (typeof window.requestIdleCallback === 'function') {
            idle = window.requestIdleCallback(() => void run(), {
              timeout: 1500
            })
          } else void run()
        },
        Math.max(0, quietUntil - Date.now())
      )
    }

    const quiet = () => {
      quietUntil = Date.now() + 500
      cancelScheduled()
      schedule()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const anchor = entry.target as HTMLAnchorElement
          const candidate = candidateFor(anchor)
          if (!candidate) continue
          let candidates = visible.get(candidate.target.cacheKey)
          if (!entry.isIntersecting || entry.intersectionRatio < 0.01) {
            candidates?.delete(anchor)
            if (!candidates?.size) visible.delete(candidate.target.cacheKey)
            continue
          }
          candidates ??= new Map()
          candidates.set(anchor, candidate)
          visible.set(candidate.target.cacheKey, candidates)
        }
        quiet()
      },
      { threshold: 0.01 }
    )

    const scan = () => {
      for (const [anchor, cacheKey] of observed) {
        const candidate = candidateFor(anchor)
        if (anchor.isConnected && candidate?.target.cacheKey === cacheKey)
          continue
        observer.unobserve(anchor)
        observed.delete(anchor)
        const candidates = visible.get(cacheKey)
        candidates?.delete(anchor)
        if (!candidates?.size) visible.delete(cacheKey)
      }
      for (const anchor of document.querySelectorAll<HTMLAnchorElement>(
        '[data-link-preview-scope] a[href]'
      )) {
        if (observed.has(anchor)) continue
        const candidate = candidateFor(anchor)
        if (!candidate) continue
        observed.set(anchor, candidate.target.cacheKey)
        observer.observe(anchor)
      }
    }

    const mutations = new MutationObserver(() => {
      scan()
      quiet()
    })
    scan()
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'data-link-preview', 'data-link-preview-scope']
    })
    const options = { signal: events.signal, passive: true }
    for (const type of ['scroll', 'pointerdown', 'keydown', 'input'])
      document.addEventListener(type, quiet, { ...options, capture: true })
    window.addEventListener('resize', quiet, options)
    window.addEventListener(
      'load',
      () => {
        loaded = true
        quiet()
      },
      options
    )
    window.addEventListener('online', quiet, options)
    connection?.addEventListener('change', quiet, options)
    document.addEventListener('visibilitychange', quiet, options)
    hover.addEventListener('change', quiet)
    let resources: PerformanceObserver | undefined
    try {
      resources = new PerformanceObserver(quiet)
      resources.observe({ type: 'resource' })
    } catch {
      resources?.disconnect()
      resources = undefined
    }
    schedule()
    return () => {
      cancelScheduled()
      events.abort()
      mutations.disconnect()
      observer.disconnect()
      resources?.disconnect()
      hover.removeEventListener('change', quiet)
    }
  }, [candidateFor, internal, router])

  return active ? (
    <div className='link-preview-layer'>
      <PreviewCard
        key={active.cacheKey + ':' + (active.data?.image ?? '')}
        preview={active}
      />
    </div>
  ) : null
}
