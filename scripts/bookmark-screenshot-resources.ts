import { load, loadBuffer } from 'cheerio'
import { parse } from 'postcss'
import valueParser from 'postcss-value-parser'

const charset = (contentType: string) =>
  /charset\s*=\s*["']?([^\s;"']+)/i.exec(contentType)?.[1]

export function rebaseScreenshotHtml(
  html: string | Buffer,
  documentUrl: string,
  contentType = 'text/html'
) {
  const $ =
    typeof html === 'string'
      ? load(html)
      : loadBuffer(html, {
          encoding: { transportLayerEncodingLabel: charset(contentType) }
        })
  const base = $('base[href]').first()
  if (base.length)
    base.attr('href', new URL(base.attr('href')!, documentUrl).href)
  else $('head').prepend($('<base>').attr('href', documentUrl))
  $('meta[charset]').attr('charset', 'utf-8')
  $('meta[http-equiv]').each((_, element) => {
    if ($(element).attr('http-equiv')?.toLowerCase() === 'content-type')
      $(element).attr('content', 'text/html; charset=utf-8')
  })
  $('head').prepend('<meta charset="utf-8">')
  return $.html()
}

export function rebaseScreenshotCss(
  css: string | Buffer,
  stylesheetUrl: string,
  contentType = 'text/css'
) {
  if (Buffer.isBuffer(css)) {
    const bom =
      css[0] === 0xff && css[1] === 0xfe
        ? 'utf-16le'
        : css[0] === 0xfe && css[1] === 0xff
          ? 'utf-16be'
          : undefined
    const encoding =
      bom ??
      charset(contentType) ??
      /^@charset\s+"([^"]+)"/i.exec(
        css.subarray(0, 100).toString('ascii')
      )?.[1] ??
      'utf-8'
    css = new TextDecoder(encoding).decode(css)
  }
  const absolute = (value: string) => {
    if (!value || /^(?:data:|#)/i.test(value) || value.includes('\\'))
      return value
    return new URL(value, stylesheetUrl).href
  }
  const rewrite = (value: string, isImport = false) => {
    const parsed = valueParser(value)
    const first = parsed.nodes.find(
      (node) => !['space', 'comment'].includes(node.type)
    )
    if (isImport && first?.type === 'string')
      first.value = absolute(first.value)
    parsed.walk((node) => {
      if (node.type !== 'function') return
      const name = node.value.toLowerCase()
      if (['image-set', '-webkit-image-set'].includes(name)) {
        for (const child of node.nodes)
          if (child.type === 'string') child.value = absolute(child.value)
        return
      }
      if (name !== 'url') return
      const child = node.nodes[0]
      if (
        node.nodes.length !== 1 ||
        !child ||
        !['string', 'word'].includes(child.type)
      )
        return
      node.nodes = [
        {
          type: 'string',
          quote: '"',
          value: absolute(child.value),
          sourceIndex: child.sourceIndex,
          sourceEndIndex: child.sourceEndIndex
        }
      ]
      return false
    })
    return valueParser.stringify(parsed.nodes)
  }
  const root = parse(css)
  root.walkAtRules(/^charset$/i, (rule) => {
    rule.params = '"UTF-8"'
  })
  root.walkDecls((decl) => {
    decl.value = rewrite(decl.value)
  })
  root.walkAtRules(/^import$/i, (rule) => {
    rule.params = rewrite(rule.params, true)
  })
  return root.toString()
}
