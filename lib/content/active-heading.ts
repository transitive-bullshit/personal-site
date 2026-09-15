export function activeHeading(
  headings: { id: string; top: number }[],
  viewport: {
    articleBottom: number
    documentBottom: number
    height: number
    scrollY: number
  }
) {
  if (!headings.length) return undefined
  if (
    viewport.scrollY > 0 &&
    Math.min(viewport.articleBottom, viewport.documentBottom) <=
      viewport.height + 2
  )
    return headings.at(-1)!.id
  let active = headings[0]!.id
  for (const heading of headings) if (heading.top <= 140) active = heading.id
  return active
}
