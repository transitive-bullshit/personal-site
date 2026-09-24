import { Fragment } from 'react'
import type { Block, Snapshot } from '@/lib/content/schema'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { CodeBlock } from './code-block'
import { Bookmark } from './bookmark'
import { ZoomableImage, NotionIcon } from './media'
import { RichText } from './rich-text'
import { ArticleTweet } from './tweet'

export function Blocks({
  blocks,
  snapshot
}: {
  blocks: Block[]
  snapshot: Snapshot
}) {
  const groups = []
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index]!
    if (
      block.type === 'bulleted_list_item' ||
      block.type === 'numbered_list_item'
    ) {
      const items: Block[] = []
      while (blocks[index]?.type === block.type) items.push(blocks[index++]!)
      const Tag = block.type === 'numbered_list_item' ? 'ol' : 'ul'
      groups.push(
        <Tag key={block.id}>
          {items.map((item) => (
            <li
              id={item.id}
              key={item.id}
              data-notion-color={'color' in item ? item.color : undefined}
            >
              <RichText spans={'richText' in item ? item.richText : []} />
              <Blocks blocks={item.children} snapshot={snapshot} />
            </li>
          ))}
        </Tag>
      )
    } else {
      groups.push(
        <BlockView key={block.id} block={block} snapshot={snapshot} />
      )
      index++
    }
  }
  return groups
}

function embedUrl(url: string) {
  const parsed = new URL(url)
  if (
    ['www.youtube.com', 'youtube.com', 'youtu.be'].includes(parsed.hostname)
  ) {
    const id =
      parsed.hostname === 'youtu.be'
        ? parsed.pathname.slice(1)
        : (parsed.searchParams.get('v') ?? parsed.pathname.split('/').at(-1))
    if (id && /^[\w-]+$/.test(id))
      return 'https://www.youtube-nocookie.com/embed/' + id
  }
  if (
    ['vimeo.com', 'www.vimeo.com'].includes(parsed.hostname) &&
    /^\/\d+$/.test(parsed.pathname)
  )
    return 'https://player.vimeo.com/video' + parsed.pathname
  if (parsed.hostname === 'codesandbox.io') return url.replace('/s/', '/embed/')
  return undefined
}

function BlockView({ block, snapshot }: { block: Block; snapshot: Snapshot }) {
  const children = block.children.length ? (
    <Blocks blocks={block.children} snapshot={snapshot} />
  ) : null
  switch (block.type) {
    case 'paragraph':
      return (
        <div id={block.id} data-notion-color={block.color}>
          <p>
            <RichText spans={block.richText} />
          </p>
          {children}
        </div>
      )
    case 'heading': {
      const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
      return (
        <Fragment>
          <Tag id={block.id} data-notion-color={block.color}>
            <RichText spans={block.richText} />
            <a
              className='heading-anchor'
              href={'#' + block.id}
              aria-label={`Link to section: ${block.richText.map((span) => span.text).join('')}`}
            >
              #
            </a>
          </Tag>
          {children}
        </Fragment>
      )
    }
    case 'quote':
      return (
        <blockquote id={block.id} data-notion-color={block.color}>
          <p>
            <RichText spans={block.richText} />
          </p>
          {children}
        </blockquote>
      )
    case 'callout':
      return (
        <Alert
          id={block.id}
          role='note'
          className='article-callout'
          data-notion-color={block.color}
        >
          <NotionIcon icon={block.icon} snapshot={snapshot} />
          <AlertDescription>
            <p>
              <RichText spans={block.richText} />
            </p>
            {children}
          </AlertDescription>
        </Alert>
      )
    case 'toggle':
      return (
        <details
          id={block.id}
          className='article-toggle'
          data-notion-color={block.color}
        >
          <summary>
            <RichText spans={block.richText} />
          </summary>
          <div className='toggle-content'>{children}</div>
        </details>
      )
    case 'to_do':
      return (
        <div id={block.id} data-notion-color={block.color}>
          <div className='article-check'>
            <input
              type='checkbox'
              checked={block.checked}
              readOnly
              aria-label={block.richText.map((s) => s.text).join('')}
            />
            <span>
              <RichText spans={block.richText} />
            </span>
          </div>
          {children}
        </div>
      )
    case 'code':
      return <CodeBlock block={block} />
    case 'image': {
      const alt = block.caption.map((span) => span.text).join('')
      return (
        <figure id={block.id}>
          <ZoomableImage
            media={snapshot.media[block.media]!}
            alt={alt}
            caption={alt}
          />
          {block.caption.length ? (
            <figcaption>
              <RichText spans={block.caption} />
            </figcaption>
          ) : null}
          {children}
        </figure>
      )
    }
    case 'video': {
      const url = block.url ? embedUrl(block.url) : undefined
      return (
        <figure id={block.id}>
          {block.media ? (
            <video
              controls
              preload='metadata'
              className='embed-frame'
              src={snapshot.media[block.media]!.original.url}
            >
              <a href={snapshot.media[block.media]!.original.url}>
                Download video
              </a>
            </video>
          ) : url ? (
            <iframe
              title='Embedded video'
              src={url}
              className='embed-frame video-embed'
              loading='lazy'
              allow='fullscreen; picture-in-picture'
              allowFullScreen
            />
          ) : null}
          {block.url || block.caption.length ? (
            <figcaption>
              {block.url ? <a href={block.url}>Watch original video</a> : null}
              {block.caption.length ? (
                <>
                  <br />
                  <RichText spans={block.caption} />
                </>
              ) : null}
            </figcaption>
          ) : null}
        </figure>
      )
    }
    case 'audio':
      return (
        <figure id={block.id}>
          <audio
            controls
            preload='metadata'
            src={snapshot.media[block.media]!.original.url}
          />
          <figcaption>
            <RichText spans={block.caption} />
          </figcaption>
        </figure>
      )
    case 'file':
      return (
        <p id={block.id}>
          <a href={snapshot.media[block.media]!.original.url} download>
            {block.name}
          </a>
          <RichText spans={block.caption} />
        </p>
      )
    case 'embed': {
      if (block.tweetId)
        return (
          <div id={block.id}>
            <ArticleTweet
              id={block.tweetId}
              tweet={snapshot.tweets[block.tweetId]}
            />
          </div>
        )
      const url = embedUrl(block.url)
      return (
        <figure id={block.id}>
          {url ? (
            <iframe
              title='Embedded example'
              src={url}
              className='embed-frame code-embed'
              loading='lazy'
              sandbox='allow-scripts allow-same-origin allow-forms allow-popups'
            />
          ) : null}
          <figcaption>
            <a href={block.url}>Open original embed</a>
            <RichText spans={block.caption} />
          </figcaption>
        </figure>
      )
    }
    case 'bookmark':
      return <Bookmark block={block} snapshot={snapshot} />
    case 'table': {
      const named = block.columns.some(Boolean)
      const header = named
        ? block.columns.map((title) => [
            {
              text: title,
              bold: false,
              italic: false,
              strike: false,
              underline: false,
              code: false,
              color: 'default'
            }
          ])
        : block.columnHeader
          ? block.rows[0]
          : undefined
      const rows =
        !named && block.columnHeader ? block.rows.slice(1) : block.rows
      return (
        <div id={block.id} className='article-table'>
          <Table aria-label='Article comparison table'>
            {header ? (
              <TableHeader>
                <TableRow>
                  {header.map((cell, index) => (
                    <TableHead key={index} scope='col'>
                      <RichText spans={cell} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            ) : null}
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, col) =>
                    block.rowHeader && col === 0 ? (
                      <TableHead key={col} scope='row'>
                        <RichText spans={cell} />
                      </TableHead>
                    ) : (
                      <TableCell key={col}>
                        <RichText spans={cell} />
                      </TableCell>
                    )
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )
    }
    case 'column_list':
      return (
        <div id={block.id} className='notion-columns'>
          {children}
        </div>
      )
    case 'column':
      return (
        <div id={block.id} className='notion-column'>
          {children}
        </div>
      )
    case 'divider':
      return (
        <Separator
          id={block.id}
          decorative={false}
          className='article-divider'
        />
      )
    case 'table_of_contents':
      return <span id={block.id} />
    case 'equation':
      return (
        <div id={block.id} className='equation'>
          {block.expression}
        </div>
      )
    case 'synced_block':
      return <div id={block.id}>{children}</div>
    case 'bulleted_list_item':
    case 'numbered_list_item':
      return null
  }
}
