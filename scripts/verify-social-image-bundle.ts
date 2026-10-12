import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

for (const route of ['social-image/[slug]', 'link-preview/fallback']) {
  const tracePath = `.next/server/app/api/${route}/route.js.nft.json`
  const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as {
    files: string[]
  }
  const bindings = trace.files.filter(
    (file) => file.includes('takumi') && file.endsWith('.node')
  )
  if (
    !bindings.length ||
    bindings.some((file) => !existsSync(resolve(dirname(tracePath), file)))
  ) {
    throw new Error(
      `${route} is missing the native Takumi binding. Keep @takumi-rs/core installed directly and externalized in next.config.ts.`
    )
  }
}
console.log(
  'Social image and preview fallback functions include their native Takumi binding.'
)
