import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const tracePath = '.next/server/app/api/social-image/[slug]/route.js.nft.json'
const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as { files: string[] }
const bindings = trace.files.filter(
  (file) => file.includes('takumi') && file.endsWith('.node')
)
if (
  !bindings.length ||
  bindings.some((file) => !existsSync(resolve(dirname(tracePath), file)))
) {
  throw new Error(
    'Social image function is missing the native Takumi binding. Keep @takumi-rs/core installed directly and externalized in next.config.ts.'
  )
}
console.log('Social image function includes its native Takumi binding.')
