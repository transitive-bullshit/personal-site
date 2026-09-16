export function markdownPath(path: string) {
  return path === '/' ? '/index.md' : path + '.md'
}
