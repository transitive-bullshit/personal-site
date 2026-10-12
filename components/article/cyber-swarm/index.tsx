import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import type { Heading } from '@/lib/content/headings'
import { sources } from '@/lib/content/essays/cyber-swarm/content'
import {
  essayOpening,
  essayParts,
  capabilityAside,
  releaseAside,
  finalPredictions,
  finalForecastPremise,
  finalClosing,
  essayChrome,
  furtherReading
} from '@/lib/content/essays/cyber-swarm/essay-content'
import type { EssayPart } from '@/lib/content/essays/cyber-swarm/essay-content'
import { expertQuotes } from '@/lib/content/essays/cyber-swarm/quotes'
import {
  sourceNumber,
  sourceOrder
} from '@/lib/content/essays/cyber-swarm/citation-labels'
import { TableOfContents } from '../table-of-contents'
import { ProtectionPaths } from './protection-paths'
import {
  OpenModelLag,
  PatchReleaseGap,
  DnsControlTimeline
} from './evidence-visuals'
import { DefenderWindow } from './defender-window'
import { EssayText } from './cited-text'
import { EssayImage } from './essay-images'
import styles from './essay.module.css'

const usedSources = sourceOrder.map((id) => sources.find((s) => s.id === id)!)

function Paragraph({
  text,
  id,
  className
}: {
  text: string
  id: string
  className?: string
}) {
  return <EssayText text={text} id={id} className={className} />
}
function Margin({ part }: { part: EssayPart }) {
  return (
    <aside id={`${part.id}-margin`} className='essay-margin'>
      <EssayText text={part.margin.label} className='eyebrow' plain />
      <EssayText text={part.margin.body} />
      {part.margin.refs.map((id) => (
        <a href={`#source-${id}`} key={id}>
          {sources.find((s) => s.id === id)?.title}{' '}
          <span>[{sourceNumber(id)}] ↗</span>
        </a>
      ))}
      {part.id === 'defenders' && (
        <div id='defense-optimism' className='margin-quote'>
          <p>Amodei’s optimism is conditional:</p>
          <blockquote>“{expertQuotes[4].text}”</blockquote>
          <a href='#source-22'>Dario Amodei [{sourceNumber(22)}] ↗</a>
        </div>
      )}
    </aside>
  )
}
function PullQuote({ index }: { index: 0 | 1 | 4 }) {
  const q = expertQuotes[index]
  return (
    <figure className='essay-pullquote'>
      <blockquote>“{q.text}”</blockquote>
      <figcaption>
        <a className='link' href={q.url}>
          {q.author} ↗
        </a>
      </figcaption>
    </figure>
  )
}
function Chapter({ part, index }: { part: EssayPart; index: number }) {
  return (
    <section
      id={part.id}
      className='essay-chapter'
      aria-labelledby={`${part.id}-heading`}
    >
      <header>
        <span className='chapter-number'>0{index + 2}</span>
        <EssayText
          as='h2'
          id={`${part.id}-heading`}

          text={part.title}
          plain
        />
      </header>
      <div className='essay-section-grid'>
        <div className='essay-copy'>
          {part.paragraphs.map((text, i) => (
            <div key={i}>
              <Paragraph
                text={text}
                id={`${part.id}-${i}`}
                className={
                  part.id === 'defenders' && i === part.paragraphs.length - 1
                    ? 'personal-turn'
                    : part.id === 'coverage' && i === 7
                      ? 'personal-turn'
                      : undefined
                }
              />
              {part.id === 'defenders' && i === 2 && <DefenderWindow />}
              {part.id === 'defenders' && i === 3 && <OpenModelLag />}
              {part.id === 'defenders' && i === 4 && <PullQuote index={1} />}
              {part.id === 'capability' && i === 1 && <PullQuote index={0} />}
              {part.id === 'coverage' && i === 1 && (
                <>
                  <Paragraph text={releaseAside} id='coverage-replay' />
                  <PatchReleaseGap />
                </>
              )}
              {part.id === 'coverage' && i === 6 && (
                <ProtectionPaths
                  sourceLabels={{
                    mandia: sourceNumber(6),
                    nist: sourceNumber(13),
                    dLink: sourceNumber(14)
                  }}
                />
              )}
              {part.id === 'accident' && i === 3 && <DnsControlTimeline />}
            </div>
          ))}
          {part.id === 'capability' && (
            <details className='research-aside'>
              <summary>
                The wave of game mods, reverse engineering, and software
                recreations
              </summary>
              <Paragraph text={capabilityAside} id='capability-aside' />
            </details>
          )}
        </div>
        <Margin part={part} />
      </div>
    </section>
  )
}
function SourceNotes() {
  return (
    <section
      id='sources'
      className='essay-sources'
      aria-labelledby='sources-heading'
    >
      <header>
        <p className='eyebrow'>References</p>
        <h2 id='sources-heading'>Sources</h2>
      </header>
      <ol>
        {usedSources.map((source) => {
          return (
            <li
              value={sourceNumber(source.id)}
              id={`source-${source.id}`}
              key={source.id}
            >
              <a className='link' href={source.url}>
                {source.title} ↗
              </a>
            </li>
          )
        })}
        {furtherReading.map((source) => (
          <li key={source.url}>
            <a className='link' href={source.url}>
              {source.title} ↗
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}
export function CyberSwarmTitle({ title }: { title: string }) {
  const match = /\bdrone\b/.exec(title)
  if (!match) return <>{title}</>
  return (
    <>
      {title.slice(0, match.index)}
      <s>{match[0]}</s>
      {title.slice(match.index + match[0].length)}
    </>
  )
}

export function CyberSwarmEssay({ headings }: { headings: Heading[] }) {
  return (
    <div
      className={`${styles.root} article-body`}
      data-link-preview-scope='article'
    >
      <p className='essay-meta'>
        First in a two-part series <span aria-hidden='true'>·</span> About 10
        minutes
      </p>
      <details className={styles.contents}>
        <summary>On this page</summary>
        <TableOfContents headings={headings} title={false} />
      </details>
      <section
        id='opening'
        className='essay-opening'
        aria-labelledby='opening-heading'
      >
        <h2 id='opening-heading' className='sr-only'>
          A new weapon changes the balance
        </h2>
        <figure id='original-photo' className='original-photo'>
          <EssayImage
            src='/essays/cyber-swarm/iron-dome-original.jpg'
            width={1024}
            height={576}
            priority
            sizes='(max-width: 1200px) calc(100vw - 48px), 1120px'
            alt='Night sky over northern Gaza, May 2021. Hamas rocket trails fan from the right; Israeli Iron Dome interceptor trails curve on the left. Buildings in Gaza fill the foreground.'
          />
          <figcaption>
            <a href='#source-20'>
              Anas Baba / AFP · 14 May 2021 [{sourceNumber(20)}]
            </a>
            <span>
              Northern Gaza Strip. Rockets right; interceptors left. Foreground:
              Gaza.
            </span>
          </figcaption>
        </figure>
        <div className='essay-section-grid'>
          <div className='essay-copy'>
            {essayOpening.map((text, i) => (
              <Paragraph
                key={i}

                text={text}
                id={`opening-${i}`}
                className={
                  i === essayOpening.length - 1 ? 'opening-thesis' : undefined
                }
              />
            ))}
          </div>
          <aside id='opening-margin' className='essay-margin opening-margin'>
            <EssayText
              text={essayChrome.openingMarginLabel}
              className='eyebrow'
              plain
            />
            <EssayText text={essayChrome.openingMarginBody} />
            <a href='#source-19'>
              RUSI: pressure and layered defense [{sourceNumber(19)}] ↗
            </a>
          </aside>
        </div>
        <figure id='swarm-illustration' className='swarm-illustration'>
          <EssayImage
            src='/essays/cyber-swarm/swarm.webp'
            width={1672}
            height={941}
            sizes='(max-width: 1200px) calc(100vw - 48px), 1120px'
            alt='AI swarm warfare, illustrated in the Iron Dome photograph’s composition: blue defensive AI agents curve upward on the left; plentiful red attacking bots fan in from the right above a night skyline.'
          />
          <figcaption>
            <EssayText
              as='span'

              text={essayChrome.swarmCaption}
            />
          </figcaption>
        </figure>
      </section>
      {essayParts.map((p, i) => (
        <Chapter part={p} index={i} key={p.id} />
      ))}
      <section
        id='predictions'
        className='essay-forecasts'
        aria-labelledby='predictions-heading'
      >
        <header>
          <span className='chapter-number'>06</span>
          <EssayText
            text={essayChrome.predictionsEyebrow}
            className='eyebrow'
            plain
          />
          <EssayText
            as='h2'

            text={essayChrome.predictionsTitle}
            id='predictions-heading'
            plain
          />
          <EssayText
            text={essayChrome.predictionsDates}
            className='forecast-dates'
            plain
          />
        </header>
        <div className='essay-section-grid'>
          <div className='essay-copy'>
            <EssayText text={finalForecastPremise} id='forecast-premise' />
            <EssayText
              text={essayChrome.predictionsIntro}
              id='predictions-intro'
            />
            <ol className='forecast-list'>
              {finalPredictions.map((p, i) => (
                <li id={`prediction-${p.id}`} key={p.id}>
                  <span className='forecast-index'>0{i + 1}</span>
                  <div>
                    <EssayText
                      as='h3'

                      text={p.title}
                      plain
                    />
                    <EssayText text={p.body} id={`body-${p.id}`} />
                    <details>
                      <summary>How I would judge this prediction</summary>
                      <Paragraph text={p.test} id={`test-${p.id}`} />
                    </details>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <aside id='predictions-margin' className='essay-margin'>
            <EssayText
              text={essayChrome.predictionsMarginLabel}
              className='eyebrow'
              plain
            />
            <EssayText text={essayChrome.predictionsMarginBody} />
            <a href='#source-24'>
              Historical damage benchmark [{sourceNumber(24)}] ↗
            </a>
          </aside>
        </div>
      </section>
      <section
        id='mental-model'
        className='essay-ending'
        aria-labelledby='mental-model-heading'
      >
        <EssayText
          as='h2'

          text={essayChrome.mentalModelTitle}
          id='mental-model-heading'
          plain
        />
        {finalClosing.map((text, i) => (
          <EssayText
            key={i}

            text={text}
            id={`closing-${i}`}
            className={i === 1 ? 'ending-thesis' : undefined}
          />
        ))}
      </section>
      <SourceNotes />
      <nav
        className='content-back'
        aria-label='More writing'
        data-link-preview='false'
      >
        <Link href='/writing'>
          <ArrowLeftIcon aria-hidden='true' size={16} />
          All writing
        </Link>
      </nav>
    </div>
  )
}
