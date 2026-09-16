import type { Article, Block, Project, RichText, Snapshot } from './schema'
import { normalizeHeadingLevels } from './headings'
import { markdownPath } from './markdown-path'
import { site } from '../site'

function escapeText(text: string) {
  return text
    .replaceAll(/([\\`*_[\]<>|~])/g, '\\$1')
    .replaceAll(/^(\s*)([#+-])(?=\s)/gm, '$1\\$2')
    .replaceAll(/^(\s*)(\d+)([.)])(?=\s)/gm, '$1$2\\$3')
}

function codeSpan(text: string) {
  const length =
    Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length)) + 1
  const fence = '`'.repeat(length)
  return fence + ' ' + text.replaceAll('\n', ' ') + ' ' + fence
}

function destination(href: string, pagePath: string) {
  try {
    const url = new URL(href, site.origin + pagePath)
    if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return
    return url.href.replaceAll(/[<>\s\\]/g, (value) =>
      encodeURIComponent(value)
    )
  } catch {
    return
  }
}

export function markdownText(spans: RichText[], pagePath: string) {
  return spans
    .map((span) => {
      let text = span.code ? codeSpan(span.text) : escapeText(span.text)
      const decorate = (marker: string) => {
        text = text.replace(/^(\s*)(.*?)(\s*)$/s, (_, before, body, after) =>
          body ? before + marker + body + marker + after : before + after
        )
      }
      if (span.bold) decorate('**')
      if (span.italic) decorate('*')
      if (span.strike) decorate('~~')
      const href = span.href && destination(span.href, pagePath)
      return href ? '[' + text + '](<' + href + '>)' : text
    })
    .join('')
}

export function markdownBlocks(
  blocks: Block[],
  snapshot: Snapshot,
  pagePath: string
): string {
  const text = (spans: RichText[]) => markdownText(spans, pagePath)
  const link = (label: string, href: string) => {
    const url = destination(href, pagePath)
    return url
      ? '[' + escapeText(label) + '](<' + url + '>)'
      : escapeText(label)
  }
  const indent = (value: string, spaces: number) =>
    value
      .split('\n')
      .map((line) => ' '.repeat(spaces) + line)
      .join('\n')
  const listKind = (block: Block) =>
    block.type === 'numbered_list_item'
      ? 'ordered'
      : ['bulleted_list_item', 'to_do'].includes(block.type)
        ? 'unordered'
        : undefined

  function render(items: Block[]): string {
    return items
      .map((block, index) => {
        const children = render(block.children)
        let body = ''
        switch (block.type) {
          case 'paragraph':
            body = text(block.richText)
            break
          case 'heading':
            body =
              `<a id="${block.id}"></a>\n\n` +
              '#'.repeat(block.level + 1) +
              ' ' +
              text(block.richText)
            break
          case 'bulleted_list_item':
          case 'numbered_list_item':
          case 'to_do': {
            const marker = block.type === 'numbered_list_item' ? '1. ' : '- '
            const checked =
              block.type === 'to_do' ? (block.checked ? '[x] ' : '[ ] ') : ''
            body =
              marker +
              (checked + text(block.richText)).replaceAll(
                '\n',
                '\n' + ' '.repeat(marker.length)
              )
            if (children) body += '\n\n' + indent(children, marker.length)
            break
          }
          case 'quote':
          case 'callout':
            body = [text(block.richText), children]
              .filter(Boolean)
              .join('\n\n')
              .split('\n')
              .map((line) => '> ' + line)
              .join('\n')
            break
          case 'toggle':
            body = '**' + text(block.richText) + '**'
            break
          case 'code': {
            const source = block.richText.map((span) => span.text).join('')
            const fence = '`'.repeat(
              Math.max(
                2,
                ...[...source.matchAll(/`+/g)].map((m) => m[0].length)
              ) + 1
            )
            const language = /^[\w+-]+$/.test(block.language)
              ? block.language
              : ''
            body = fence + language + '\n' + source + '\n' + fence
            break
          }
          case 'image': {
            const media = snapshot.media[block.media]
            if (media)
              body =
                '!' +
                link(
                  block.caption.map((span) => span.text).join(''),
                  media.original.url
                )
            break
          }
          case 'file':
          case 'audio':
          case 'video': {
            const url = block.media
              ? snapshot.media[block.media]?.original.url
              : block.type === 'video'
                ? block.url
                : undefined
            if (url)
              body = link(
                block.type === 'file'
                  ? block.name
                  : block.type === 'audio'
                    ? 'Listen to audio'
                    : 'Watch video',
                url
              )
            break
          }
          case 'embed': {
            const tweet = block.tweetId
              ? snapshot.tweets[block.tweetId]
              : undefined
            body = link(
              block.tweetId ? 'View original post' : 'Open embedded content',
              block.url
            )
            if (tweet?.status === 'available') {
              body =
                escapeText(
                  tweet.data.user.name +
                    ' (@' +
                    tweet.data.user.screen_name +
                    ')'
                ) +
                ':\n\n' +
                escapeText(tweet.data.text)
                  .split('\n')
                  .map((line) => '> ' + line)
                  .join('\n') +
                '\n\n' +
                body
            }
            break
          }
          case 'bookmark': {
            const preview = snapshot.bookmarks?.[block.url]
            body = link(preview?.title || block.url, block.url)
            if (preview?.description)
              body += '\n\n' + escapeText(preview.description)
            break
          }
          case 'table': {
            const width = Math.max(
              block.columns.length,
              ...block.rows.map((row) => row.length)
            )
            if (!width) break
            const row = (cells: RichText[][]) =>
              '| ' +
              Array.from({ length: width }, (_, i) =>
                text(
                  (cells[i] ?? []).map((span) =>
                    span.code
                      ? { ...span, text: span.text.replaceAll('|', '\\|') }
                      : span
                  )
                ).replaceAll(/\r?\n/g, '<br>')
              ).join(' | ') +
              ' |'
            const header = block.columnHeader ? (block.rows[0] ?? []) : []
            body = [
              row(header),
              '| ' +
                Array.from({ length: width }, () => '---').join(' | ') +
                ' |',
              ...block.rows.slice(block.columnHeader ? 1 : 0).map(row)
            ].join('\n')
            break
          }
          case 'equation':
            body = '$$\n' + block.expression + '\n$$'
            break
          case 'divider':
            body = '---'
            break
          case 'table_of_contents':
          case 'column_list':
          case 'column':
          case 'synced_block':
            break
          default: {
            const exhaustive: never = block
            throw new Error('Unsupported Markdown block: ' + String(exhaustive))
          }
        }
        if ('caption' in block && block.caption.length)
          body += '\n\n' + text(block.caption)
        if (
          children &&
          !listKind(block) &&
          block.type !== 'quote' &&
          block.type !== 'callout'
        )
          body = [body, children].filter(Boolean).join('\n\n')
        const previous = items[index - 1]
        const separator =
          previous && listKind(block) && listKind(block) === listKind(previous)
            ? '\n'
            : '\n\n'
        return (index ? separator : '') + body
      })
      .join('')
  }
  return render(normalizeHeadingLevels(blocks)).trim()
}

export function entryMarkdown(entry: Article | Project, snapshot: Snapshot) {
  const project = 'authors' in entry
  const path = (project ? '/projects/' : '/') + entry.slug
  const author = project
    ? entry.authors
        .flatMap((author) => (author.name ? [author.name] : []))
        .join(', ')
    : entry.author
  const lines = [
    '# ' + escapeText(entry.title),
    entry.description ? escapeText(entry.description) : '',
    'Canonical URL: ' + site.origin + path,
    author ? 'Author: ' + escapeText(author) : '',
    entry.published ? 'Published: ' + entry.published : '',
    'Updated: ' + entry.modified,
    entry.tags.length ? 'Tags: ' + entry.tags.map(escapeText).join(', ') : ''
  ]
  if (project) {
    for (const [label, href] of [
      ['Website', entry.website],
      ['Source', entry.source],
      ['Original post', entry.tweet]
    ]) {
      if (href) lines.push(`[${label}](<${href}>)`)
    }
  }
  if (entry.cover && snapshot.media[entry.cover])
    lines.push(
      `![${escapeText(entry.title)}](<${snapshot.media[entry.cover]!.original.url}>)`
    )
  lines.push(markdownBlocks(entry.blocks, snapshot, path))
  return lines.filter(Boolean).join('\n\n') + '\n'
}

export function indexMarkdown(
  path: '/' | '/projects' | '/writing',
  articles: Article[],
  projects: Project[]
) {
  const title =
    path === '/' ? site.name : path === '/projects' ? 'Projects' : 'Writing'
  const lines = [
    '# ' + title,
    '',
    site.description,
    '',
    'Canonical URL: ' + site.origin + path,
    '',
    'This is Travis Fischer’s personal portfolio and writing archive. Projects listed here are separate products and experiments, not APIs offered by this website.',
    '',
    `[Agent guide](${site.origin}/llms.txt)`
  ]
  if (path !== '/writing') {
    lines.push('', '## Projects', '')
    for (const entry of projects)
      lines.push(
        `- [${escapeText(entry.title)}](${site.origin}${markdownPath('/projects/' + entry.slug)}): ${escapeText(entry.description).replaceAll('\n', ' ')}`
      )
  }
  if (path !== '/projects') {
    lines.push('', '## Writing', '')
    for (const entry of articles)
      lines.push(
        `- [${escapeText(entry.title)}](${site.origin}${markdownPath('/' + entry.slug)}): ${escapeText(entry.description).replaceAll('\n', ' ')}`
      )
  }
  return lines.join('\n') + '\n'
}
