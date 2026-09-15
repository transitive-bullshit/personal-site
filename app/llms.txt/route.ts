import { articles } from '@/lib/content/load'
import { site } from '@/lib/site'

export const dynamic = 'force-static'

export function GET() {
  const body =
    [
      '# ' + site.name,
      '',
      '> ' + site.description,
      '',
      '## Articles',
      '',
      ...articles.map(
        (article) =>
          '- [' +
          article.title.replace(/[[\]\n]/g, '') +
          '](' +
          site.origin +
          '/' +
          article.slug +
          '): ' +
          article.description.replaceAll('\n', ' ')
      )
    ].join('\n') + '\n'
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
