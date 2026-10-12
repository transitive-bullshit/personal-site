import {
  titles,
  defenderWindowDescription
} from '@/lib/content/essays/cyber-swarm/evidence'
import { sourceNumber } from '@/lib/content/essays/cyber-swarm/citation-labels'

export function DefenderWindow() {
  const id = 'defenders-window-figure'
  return (
    <figure
      id='defenders-window'
      className='defender-window'
      aria-labelledby={`${id}-heading`}
    >
      <figcaption className='defender-window-heading'>
        <p className='defender-window-eyebrow'>
          Conceptual / Adapted from OpenAI
        </p>
        <h3 id={`${id}-heading`}>{titles.defendersWindow}</h3>
      </figcaption>
      <div
        className='defender-window-scroll'
        tabIndex={0}
        role='region'
        aria-label='Defender’s window chart; scroll horizontally on a narrow screen'
      >
        <svg
          className='defender-window-svg'
          viewBox='0 0 640 440'
          xmlns='http://www.w3.org/2000/svg'
          role='img'
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title id={`${id}-title`}>{titles.defendersWindow}</title>
          <desc id={`${id}-desc`}>{defenderWindowDescription}</desc>
          <rect width='640' height='440' fill='var(--background)' />
          <text className='defender-window-axis' x='52' y='24'>
            Cyber capability
          </text>
          <path className='defender-window-axes' d='M52 40 V332 H608' />
          <path
            className='defender-window-area'
            d='M52 284 H140 C164 284 176 284 188 280 C240 268 276 220 332 180 C352 168 376 156 396 148 C484 112 548 72 608 40 L608 156 C548 192 484 220 396 252 C304 280 192 304 52 324 Z'
          />
          <path
            className='defender-window-frontier'
            d='M52 220 C192 200 304 180 396 148 C484 112 548 72 608 40'
          />
          <path
            className='defender-window-diffused'
            d='M52 324 C192 304 304 280 396 252 C484 220 548 192 608 156'
          />
          <path
            className='defender-window-operational'
            d='M52 284 H140 C164 284 176 284 188 280 C240 268 276 220 332 180 C352 168 376 156 396 148 C484 112 548 72 608 40'
          />
          <text
            className='defender-window-adoption'
            x='188'
            y='236'
            textAnchor='middle'
          >
            <tspan x='188'>Adopt continuous </tspan>
            <tspan x='188' dy='20'>
              defense
            </tspan>
          </text>
          <path className='defender-window-adoption-line' d='M188 268 V274' />
          <circle
            className='defender-window-adoption-dot'
            cx='188'
            cy='280'
            r='6'
          />
          <text
            className='defender-window-callout'
            x='440'
            y='196'
            textAnchor='middle'
          >
            Defender’s window
          </text>
          <text
            className='defender-window-axis'
            x='332'
            y='356'
            textAnchor='middle'
          >
            Time
          </text>
          <path className='defender-window-legend-rule' d='M52 388 H608' />
          <g className='defender-window-legend' aria-hidden='true'>
            <path className='defender-window-frontier' d='M52 412 H72' />
            <text x='84' y='416'>
              Frontier
            </text>
            <path className='defender-window-operational' d='M212 412 H232' />
            <text x='244' y='416'>
              Defenders
            </text>
            <path className='defender-window-diffused' d='M376 412 H396' />
            <text x='408' y='416'>
              Broadly diffused
            </text>
          </g>
        </svg>
      </div>
      <p className='defender-window-scroll-hint'>
        Scroll horizontally to see the full diagram.
      </p>
      <p className='defender-window-source'>
        <a href='#source-26'>
          OpenAI · The Defense Factory [{sourceNumber(26)}] ↗
        </a>
      </p>
    </figure>
  )
}
