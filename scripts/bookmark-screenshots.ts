import { createHash } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import type { BookmarkScreenshot } from '../lib/content/schema'
import { publicFetch, validatePublicUrl } from './public-fetch'
import {
  rebaseScreenshotHtml,
  rebaseScreenshotCss
} from './bookmark-screenshot-resources'

export async function saveBookmarkScreenshot(
  png: Buffer,
  directory = 'public/bookmarks'
): Promise<BookmarkScreenshot> {
  const { data, info } = await sharp(png)
    .resize({
      width: 640,
      height: 480,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 78, effort: 6 })
    .toBuffer({ resolveWithObject: true })
  const hash = createHash('sha256').update(data).digest('hex')
  await mkdir(directory, { recursive: true })
  const path = join(directory, hash + '.webp')
  const temp = path + '.' + process.pid + '.tmp'
  await writeFile(temp, data)
  await rename(temp, path)
  return {
    url: `/bookmarks/${hash}.webp`,
    width: info.width,
    height: info.height
  }
}

async function capture(url: string) {
  await validatePublicUrl(new URL(url))
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true, timeout: 15_000 })
  const deadline = setTimeout(() => void browser.close(), 30_000)
  const signal = AbortSignal.timeout(30_000)
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      javaScriptEnabled: false,
      serviceWorkers: 'block',
      acceptDownloads: false
    })
    let requests = 0
    let totalBytes = 0
    // Fetch through the existing public-only transport, including subresources
    // and redirects. The isolated browser never makes direct network requests.
    await context.route('**/*', async (route) => {
      const request = route.request()
      if (
        ++requests > 100 ||
        !['document', 'stylesheet', 'image', 'font'].includes(
          request.resourceType()
        )
      ) {
        await route.abort()
        return
      }
      try {
        const response = await publicFetch(request.url(), { signal })
        const reader = response.body?.getReader()
        const chunks: Uint8Array[] = []
        let bytes = 0
        try {
          if (reader)
            for (;;) {
              const chunk = await reader.read()
              if (chunk.done) break
              bytes += chunk.value.length
              totalBytes += chunk.value.length
              if (bytes > 4 * 1024 * 1024 || totalBytes > 32 * 1024 * 1024)
                throw new Error('Screenshot resource budget exceeded')
              chunks.push(chunk.value)
            }
        } finally {
          await reader?.cancel().catch(() => {})
        }
        if (
          request.isNavigationRequest() &&
          request.frame() === context.pages()[0]?.mainFrame()
        ) {
          if (
            !response.ok ||
            !(response.headers.get('content-type') ?? '').includes('html')
          )
            throw new Error(
              'Screenshot page unavailable: HTTP ' + response.status
            )
        }
        let body = Buffer.concat(chunks)
        let contentType =
          response.headers.get('content-type') ?? 'application/octet-stream'
        if (request.resourceType() === 'document') {
          body = Buffer.from(
            rebaseScreenshotHtml(
              body,
              response.url || request.url(),
              contentType
            )
          )
          contentType = 'text/html; charset=utf-8'
        } else if (
          request.resourceType() === 'stylesheet' &&
          response.url &&
          response.url !== request.url()
        ) {
          body = Buffer.from(
            rebaseScreenshotCss(body, response.url, contentType)
          )
          contentType = 'text/css; charset=utf-8'
        }
        await route.fulfill({
          status: response.status,
          contentType,
          body
        })
      } catch {
        await route.abort().catch(() => {})
      }
    })
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'load', timeout: 25_000 })
    const text = await page.locator('body').innerText({ timeout: 2000 })
    if (
      text.trim().length < 80 ||
      /^(access denied|just a moment|attention required)/i.test(
        await page.title()
      )
    )
      throw new Error('Screenshot page is empty or blocked')
    const png = await page.screenshot({ animations: 'disabled', timeout: 5000 })
    return await saveBookmarkScreenshot(png)
  } finally {
    clearTimeout(deadline)
    await browser.close()
  }
}

// Bound capture concurrency independently of bookmark metadata workers.
let queue: Promise<unknown> = Promise.resolve()
export function captureBookmarkScreenshot(
  url: string
): Promise<BookmarkScreenshot> {
  const next = queue.then(() => capture(url))
  queue = next.catch(() => {})
  return next
}
