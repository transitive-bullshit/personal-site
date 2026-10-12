import { sourceNumber } from '@/lib/content/essays/cyber-swarm/citation-labels'
import { sourceUrl } from '@/lib/content/essays/cyber-swarm/content'
import {
  lagRows,
  dnsEvents,
  patchRelease,
  titles
} from '@/lib/content/essays/cyber-swarm/evidence'

function EvidenceSource({
  sourceId,
  label
}: {
  sourceId: number
  label: string
}) {
  return (
    <p className='state-ai-source'>
      <a
        className='link'
        href={sourceUrl(sourceId)}
        target='_blank'
        rel='noopener noreferrer'
      >
        {label} [{sourceNumber(sourceId)}] ↗
      </a>
    </p>
  )
}

export function OpenModelLag() {
  const id = 'open-model-lag-figure'
  const x = (months: number) => 20 + (months / 12) * 264
  return (
    <figure
      id='open-model-lag'
      className='state-ai-evidence'
      aria-labelledby={`${id}-heading`}
    >
      <figcaption>
        <p className='state-ai-kicker'>AISI · Cyber evaluations</p>
        <h3 id={`${id}-heading`}>{titles.openModelLag}</h3>
      </figcaption>
      <div
        className='state-ai-svg-scroll'
        tabIndex={0}
        role='region'
        aria-label='Open-model release-date lag comparison'
      >
        <svg
          className='state-ai-svg'
          viewBox='0 0 320 208'
          xmlns='http://www.w3.org/2000/svg'
          role='img'
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title id={`${id}-title`}>Open-model release-date lag</title>
          <desc id={`${id}-desc`}>
            Leading open models matched closed models released six to ten months
            earlier through much of 2025, compared with four to seven months for
            models tested in 2026.
          </desc>
          {lagRows.map((row, index) => (
            <g key={row.label}>
              <text className='state-ai-label' x='20' y={28 + index * 76}>
                {row.label}
              </text>
              <text
                className='state-ai-value'
                x='284'
                y={28 + index * 76}
                textAnchor='end'
              >
                {row.start}–{row.end} months
              </text>
              <line
                className='state-ai-track'
                x1='20'
                x2='284'
                y1={52 + index * 76}
                y2={52 + index * 76}
              />
              <rect
                className={
                  index === 1
                    ? 'state-ai-range state-ai-range-focal'
                    : 'state-ai-range'
                }
                x={x(row.start)}
                y={44 + index * 76}
                width={x(row.end) - x(row.start)}
                height='16'
                rx='2'
              />
            </g>
          ))}
          {[0, 3, 6, 9, 12].map((tick) => (
            <g key={tick}>
              <line
                className='state-ai-tick'
                x1={x(tick)}
                x2={x(tick)}
                y1='164'
                y2='168'
              />
              <text
                className='state-ai-axis'
                x={x(tick)}
                y='184'
                textAnchor='middle'
              >
                {tick}
              </text>
            </g>
          ))}
          <text className='state-ai-axis' x='152' y='204' textAnchor='middle'>
            Release-date lag · months
          </text>
        </svg>
      </div>
      <EvidenceSource
        sourceId={29}
        label='AISI · Open-weight cyber capability'
      />
    </figure>
  )
}

export function PatchReleaseGap() {
  const id = 'patch-release-gap-figure'
  return (
    <figure
      id='patch-release-gap'
      className='state-ai-evidence'
      aria-labelledby={`${id}-heading`}
    >
      <figcaption>
        <p className='state-ai-kicker'>
          Anthropic · Retrospective patch replay
        </p>
        <h3 id={`${id}-heading`}>{titles.patchReleaseGap}</h3>
      </figcaption>
      <div
        className='state-ai-svg-scroll'
        tabIndex={0}
        role='region'
        aria-label='Exploit development versus Firefox release duration'
      >
        <svg
          className='state-ai-svg'
          viewBox='0 0 320 188'
          xmlns='http://www.w3.org/2000/svg'
          role='img'
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title id={`${id}-title`}>
            Exploit development and Firefox release
          </title>
          <desc id={`${id}-desc`}>
            The fastest validated exploit took under one hour in a retrospective
            SpiderMonkey patch replay; the same fix had historically taken
            eighteen days from source publication to Firefox release.
          </desc>
          <text className='state-ai-label' x='20' y='28'>
            Exploit development
          </text>
          <text className='state-ai-value' x='284' y='28' textAnchor='end'>
            &lt;1 hour
          </text>
          <line className='state-ai-track' x1='20' x2='284' y1='52' y2='52' />
          <rect
            className='state-ai-duration'
            x='20'
            y='44'
            width={
              (264 * patchRelease.exploitHoursUpperBound) /
              (patchRelease.releaseDays * 24)
            }
            height='16'
          />
          <text className='state-ai-label' x='20' y='104'>
            Firefox release
          </text>
          <text className='state-ai-value' x='284' y='104' textAnchor='end'>
            18 days
          </text>
          <rect
            className='state-ai-range state-ai-range-focal'
            x='20'
            y='120'
            width='264'
            height='16'
            rx='2'
          />
          <line className='state-ai-tick' x1='20' x2='20' y1='156' y2='160' />
          <line className='state-ai-tick' x1='284' x2='284' y1='156' y2='160' />
          <text className='state-ai-axis' x='20' y='180'>
            0
          </text>
          <text className='state-ai-axis' x='284' y='180' textAnchor='end'>
            18 days
          </text>
        </svg>
      </div>
      <EvidenceSource sourceId={8} label='Anthropic · Exploiting patches' />
    </figure>
  )
}

export function DnsControlTimeline() {
  const id = 'dns-control-timeline-figure'
  return (
    <figure
      id='dns-control-timeline'
      className='state-ai-evidence state-ai-dns'
      aria-labelledby={`${id}-heading`}
    >
      <figcaption>
        <p className='state-ai-kicker'>OpenAI · 20 September 2026</p>
        <h3 id={`${id}-heading`}>{titles.dnsControlTimeline}</h3>
      </figcaption>
      <p className='state-ai-delay'>
        <strong>2h 29m</strong>
        <span>Human acknowledgment → manual shutdown</span>
      </p>
      <ol className='state-ai-chronology' aria-label='Incident event sequence'>
        {dnsEvents.map((event, index) => (
          <li
            key={event.time}
            className={
              index === dnsEvents.length - 1
                ? 'state-ai-chronology-focal'
                : undefined
            }
          >
            <time>{event.time}</time>
            <span>{event.label}</span>
          </li>
        ))}
      </ol>
      <p className='state-ai-control-note'>The automatic stop failed.</p>
      <EvidenceSource sourceId={32} label='OpenAI · DNS incident report' />
    </figure>
  )
}
