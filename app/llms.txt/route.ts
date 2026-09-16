import { articles, projects } from '@/lib/content/load'
import { site } from '@/lib/site'

export const dynamic = 'force-static'

export function GET() {
  const body =
    [
      '# ' + site.name,
      '',
      '> ' + site.description,
      '',
      'This is Travis Fischer’s personal portfolio and writing archive. The projects are separate products and experiments; this site is not an API platform or developer service.',
      '',
      '## When to use this site',
      '',
      'Use this site to learn about Travis, explore his software and open source projects, or read his articles on AI, software development, and entrepreneurship. Follow each project’s Website or Source link to use that project.',
      '',
      '## Reading content',
      '',
      'HTML pages are server-rendered. For clean Markdown, append .md to an article or project URL. The homepage is /index.md. Markdown uses separate URLs; Accept: text/markdown on an HTML URL does not change its representation.',
      '',
      '- [Home in Markdown](' + site.origin + '/index.md)',
      '- [Project index in Markdown](' + site.origin + '/projects.md)',
      '- [Writing index in Markdown](' + site.origin + '/writing.md)',
      '',
      '## Main pages',
      '',
      '- [Home](' + site.origin + '/): ' + site.description,
      '- [Projects](' + site.origin + '/projects): All projects.',
      '- [Writing](' + site.origin + '/writing): All articles.',
      '- [Sitemap](' + site.origin + '/sitemap.xml): Canonical page URLs.',
      '',
      '## Projects',
      '',
      ...projects.map(
        (project) =>
          '- [' +
          project.title.replace(/[[\]\n]/g, '') +
          '](' +
          site.origin +
          '/projects/' +
          project.slug +
          '): ' +
          project.description.replaceAll('\n', ' ') +
          ' [Markdown](' +
          site.origin +
          '/projects/' +
          project.slug +
          '.md)'
      ),
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
          article.description.replaceAll('\n', ' ') +
          ' [Markdown](' +
          site.origin +
          '/' +
          article.slug +
          '.md)'
      )
    ].join('\n') + '\n'
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
