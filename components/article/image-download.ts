// Public local originals can be fetched directly. Remote originals still use
// the snapshot-backed endpoint, which only permits imported stored assets.
export function imageDownloadSource(original: string) {
  const base = 'https://local.invalid'
  const url = new URL(original, base)
  const filename = url.pathname.split('/').at(-1)!
  return {
    filename,
    src:
      original.startsWith('/') && url.origin === base
        ? url.pathname + url.search
        : `/api/media-download/${filename}`
  }
}
