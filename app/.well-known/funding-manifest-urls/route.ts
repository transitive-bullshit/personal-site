// FLOSS/fund verifies that the funding.json manifests naming this site as
// their entity or project webpage are listed here, one URL per line.
const fundingManifestUrls = [
  'https://github.com/NotionX/react-notion-x/blob/master/funding.json'
]

export const dynamic = 'force-static'

export function GET() {
  return new Response(fundingManifestUrls.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
