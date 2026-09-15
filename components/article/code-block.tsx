import { bundledLanguages, codeToHtml } from 'shiki'
import type { Block } from '@/lib/content/schema'
import { CopyButton } from './copy-button'
import { RichText } from './rich-text'

export async function CodeBlock({
  block
}: {
  block: Extract<Block, { type: 'code' }>
}) {
  const text = block.richText.map((span) => span.text).join('')
  const language = block.language.toLowerCase()
  const aliases = {
    'plain text': 'text',
    shell: 'bash',
    'c++': 'cpp',
    'c#': 'csharp',
    'java/c/c++/c#': 'java'
  } satisfies Record<string, string>
  const requested = Object.hasOwn(aliases, language)
    ? aliases[language as keyof typeof aliases]
    : language
  const lang = Object.hasOwn(bundledLanguages, requested)
    ? (requested as keyof typeof bundledLanguages)
    : 'text'
  const html = await codeToHtml(text, {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' }
  })
  return (
    <figure>
      <div className='code-frame' id={block.id}>
        <div className='code-toolbar'>
          <span>{block.language}</span>
          <CopyButton text={text} />
        </div>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {block.caption.length ? (
        <figcaption>
          <RichText spans={block.caption} />
        </figcaption>
      ) : null}
    </figure>
  )
}
