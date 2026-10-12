import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import type { Heading } from '@/lib/content/headings'
import { sources, sourceUrl } from '@/lib/content/essays/cyber-swarm/content'
import {
  essayOpening,
  essayParts,
  capabilityAside,
  releaseAside,
  finalPredictions,
  finalForecastPremise,
  finalClosing,
  essayChrome,
  furtherReading,
  policyVideo
} from '@/lib/content/essays/cyber-swarm/essay-content'
import type { EssayPart } from '@/lib/content/essays/cyber-swarm/essay-content'
import { expertQuotes } from '@/lib/content/essays/cyber-swarm/quotes'
import {
  sourceNumber,
  sourceOrder
} from '@/lib/content/essays/cyber-swarm/citation-labels'
import { TableOfContents } from '../table-of-contents'
import {
  OpenModelLag,
  PatchReleaseGap,
  DnsControlTimeline
} from './evidence-visuals'
import { DefenderWindow } from './defender-window'
import { EssayText } from './cited-text'
import { EssayImage } from './essay-images'
import { SourceDisclosure } from './source-disclosure'
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
        <a
          className='link'
          href={sourceUrl(id)}
          key={id}
          target='_blank'
          rel='noopener noreferrer'
        >
          {sources.find((s) => s.id === id)?.title}{' '}
          <span>[{sourceNumber(id)}] ↗</span>
        </a>
      ))}
      {part.id === 'defenders' && (
        <div id='defense-optimism' className='margin-quote'>
          <p>Amodei’s optimism is conditional:</p>
          <blockquote>“{expertQuotes[4].text}”</blockquote>
          <a
            className='link'
            href={sourceUrl(22)}
            target='_blank'
            rel='noopener noreferrer'
          >
            Dario Amodei [{sourceNumber(22)}] ↗
          </a>
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
        <a
          className='link'
          href={q.url}
          target='_blank'
          rel='noopener noreferrer'
        >
          {q.author} ↗
        </a>
      </figcaption>
    </figure>
  )
}
function Chapter({ part }: { part: EssayPart }) {
  return (
    <section
      id={part.id}
      className='essay-chapter'
      aria-labelledby={`${part.id}-heading`}
    >
      <header>
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
              {part.id === 'coverage' && i === 5 && (
                <figure id='policy-video' className='essay-policy-video'>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${policyVideo.id}`}
                    title={policyVideo.title}
                    loading='lazy'
                    allow='encrypted-media; picture-in-picture; fullscreen'
                    referrerPolicy='strict-origin-when-cross-origin'
                    allowFullScreen
                  />
                  <figcaption>
                    {policyVideo.caption}{' '}
                    <a
                      className='link'
                      href={sourceUrl(policyVideo.sourceId)}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {policyVideo.title} [{sourceNumber(policyVideo.sourceId)}]
                      ↗
                    </a>
                  </figcaption>
                </figure>
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
  const sourceItems = usedSources.map((source) => (
    <li
      value={sourceNumber(source.id)}
      id={`source-${source.id}`}
      tabIndex={-1}
      key={source.id}
    >
      <a
        className='link'
        href={source.url}
        target='_blank'
        rel='noopener noreferrer'
      >
        {source.title} ↗
      </a>
    </li>
  ))
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
      <ol>{sourceItems.slice(0, 10)}</ol>
      <SourceDisclosure count={usedSources.length - 10 + furtherReading.length}>
        <ol start={11}>
          {sourceItems.slice(10)}
          {furtherReading.map((source) => (
            <li key={source.url}>
              <a
                className='link'
                href={source.url}
                target='_blank'
                rel='noopener noreferrer'
              >
                {source.title} ↗
              </a>
            </li>
          ))}
        </ol>
      </SourceDisclosure>
    </section>
  )
}
export function CyberSwarmHeaderText({ text }: { text: string }) {
  const match = /\bdrone\b/.exec(text)
  if (!match) return <>{text}</>
  return (
    <>
      {text.slice(0, match.index)}
      <s>{match[0]}</s>
      {text.slice(match.index + match[0].length)}
    </>
  )
}

export function CyberSwarmEssay({ headings }: { headings: Heading[] }) {
  return (
    <div
      className={`${styles.root} article-body`}
      data-link-preview-scope='article'
    >
      <div className={styles.contents}>
        <TableOfContents headings={headings} />
      </div>
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
            <a
              className='link'
              href={sourceUrl(20)}
              target='_blank'
              rel='noopener noreferrer'
            >
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
            <a
              className='link'
              href={sourceUrl(19)}
              target='_blank'
              rel='noopener noreferrer'
            >
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
      {essayParts.map((p) => (
        <Chapter part={p} key={p.id} />
      ))}
      <section
        id='predictions'
        className='essay-forecasts'
        aria-labelledby='predictions-heading'
      >
        <header>
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
        </header>
        <div className='essay-section-grid'>
          <div className='essay-copy'>
            <EssayText text={finalForecastPremise} id='forecast-premise' />
            <EssayText
              text={essayChrome.predictionsIntro}
              id='predictions-intro'
            />
            <ol className='forecast-list'>
              {finalPredictions.map((p) => (
                <li
                  id={`prediction-${p.id}`}
                  key={p.id}
                  className={
                    p.id === 'catastrophe' ? 'forecast-boldest' : undefined
                  }
                >
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
            <a
              className='link'
              href={sourceUrl(24)}
              target='_blank'
              rel='noopener noreferrer'
            >
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
