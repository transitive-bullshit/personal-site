import type { Heading } from './headings'
import { sources } from './essays/cyber-swarm/content'
import {
  essayChrome,
  essayOpening,
  essayParts,
  capabilityAside,
  releaseAside,
  finalPredictions,
  finalForecastPremise,
  finalClosing,
  furtherReading
} from './essays/cyber-swarm/essay-content'
import { sourceOrder, sourceNumber } from './essays/cyber-swarm/citation-labels'
import { expertQuotes } from './essays/cyber-swarm/quotes'
import {
  lagRows,
  dnsEvents,
  repairPaths,
  patchRelease,
  titles,
  defenderWindowDescription
} from './essays/cyber-swarm/evidence'

export const cyberSwarmArticleId = '3f7edb27f12481bcb191fcff5dcafd41'

export type BodyOverride = {
  headings: Heading[]
  // Public headings and authored captions, independent of the abbreviated TOC.
  searchText: string[]
  markdown: string
}

const sourceMap = new Map(sources.map((source) => [source.id, source]))

function cite(text: string) {
  return text.replace(/\[(\d+)\]/g, (_, rawId: string) => {
    const id = Number(rawId)
    const number = sourceNumber(id)
    if (!sourceMap.has(id) || number < 1)
      throw new Error('Unknown cybersecurity essay source: ' + id)
    return `[^${number}]`
  })
}

function details(summary: string, paragraphs: string[]) {
  return `<details>\n<summary>${summary}</summary>\n\n${paragraphs.join('\n\n')}\n\n</details>`
}

function table(headers: string[], rows: string[][]) {
  return [headers, headers.map(() => '---'), ...rows]
    .map(
      (row) =>
        '| ' + row.map((cell) => cell.replaceAll('|', '\\|')).join(' | ') + ' |'
    )
    .join('\n')
}

function quote(index: 0 | 1 | 4, sourceId: number) {
  const value = expertQuotes[index]
  return cite(
    `> “${value.text}”\n>\n> — [${value.author}](${value.url}) [${sourceId}]`
  )
}

function anchor(id: string) {
  return `<a id="${id}"></a>`
}

function cyberSwarmMarkdown() {
  const blocks = [
    anchor('opening'),
    '![Hamas rockets on the right and Iron Dome interceptors on the left over northern Gaza.](/essays/cyber-swarm/iron-dome-original.jpg)',
    cite(
      '*Anas Baba / AFP · 14 May 2021 [20]. Northern Gaza Strip. Rockets right; interceptors left. Foreground: Gaza.*'
    ),
    ...essayOpening.map(cite),
    details(essayChrome.openingMarginLabel, [
      cite(essayChrome.openingMarginBody),
      cite('RUSI: pressure and layered defense [19]')
    ]),
    '![Blue defensive model icons curve upward on the left; red offensive bots stream in from the right.](/essays/cyber-swarm/swarm.webp)',
    '*' + cite(essayChrome.swarmCaption) + '*'
  ]

  for (const part of essayParts) {
    blocks.push(anchor(part.id), cite('## ' + part.title))
    part.paragraphs.forEach((paragraph, index) => {
      blocks.push(cite(paragraph))
      if (part.id === 'defenders' && index === 2)
        blocks.push(
          '### ' + titles.defendersWindow,
          cite(defenderWindowDescription + ' [26]')
        )
      if (part.id === 'defenders' && index === 3)
        blocks.push(
          '### ' + titles.openModelLag,
          table(
            [
              'Tested open models',
              'Release-date lag behind comparable closed models'
            ],
            lagRows.map((row) => [row.label, `${row.start}–${row.end} months`])
          ),
          cite('Source: AISI [29]')
        )
      if (part.id === 'defenders' && index === 4) blocks.push(quote(1, 5))
      if (part.id === 'capability' && index === 1) blocks.push(quote(0, 6))
      if (part.id === 'coverage' && index === 1)
        blocks.push(
          cite(releaseAside),
          '### ' + titles.patchReleaseGap,
          'Retrospective patch replay · Corresponding Firefox fix',
          table(
            ['Milestone', 'Time'],
            [
              [
                'Fastest working exploit',
                `Under ${patchRelease.exploitHoursUpperBound} hour`
              ],
              [
                'Public source fix to Firefox 148 release',
                `${patchRelease.releaseDays} days`
              ]
            ]
          ),
          cite('Source: Anthropic [8]')
        )
      if (part.id === 'coverage' && index === 6)
        blocks.push(
          details(
            'Explore why the same finding leads to different protection',
            [
              titles.protectionPaths,
              ...Object.values(repairPaths).map(
                (scenario) =>
                  `- **${scenario.label}:** ${scenario.stages.join(' → ')}. ${scenario.note}`
              ),
              '**Containment can protect before repair.** Assume the control has reach and authority over this attack path. It buys time; it does not cover every weakness.',
              cite('Containment buys time for permanent repair. [6] [13] [14]')
            ]
          )
        )
      if (part.id === 'accident' && index === 3)
        blocks.push(
          '### ' + titles.dnsControlTimeline,
          '20 September 2026 · Internal training run',
          table(
            ['Time', 'Event'],
            dnsEvents.map((event) => [event.time, event.label])
          ),
          cite(
            'Human acknowledgment → manual shutdown: **2h 29m**. The expected automatic stop failed. [32]'
          )
        )
    })
    if (part.id === 'capability')
      blocks.push(
        details(
          'The wave of game mods, reverse engineering, and software recreations',
          [cite(capabilityAside)]
        )
      )
    blocks.push(
      cite(
        `> **${part.margin.label.replace(/\.$/, '')}.** ${part.margin.body} ${part.margin.refs.map((id) => `[${id}]`).join(' ')}`
      )
    )
    if (part.id === 'defenders')
      blocks.push('Amodei’s optimism is conditional:', quote(4, 22))
  }

  blocks.push(
    anchor('predictions'),
    cite('## ' + essayChrome.predictionsTitle),
    '*' + cite(essayChrome.predictionsDates) + '*',
    cite(finalForecastPremise),
    cite(essayChrome.predictionsIntro)
  )
  finalPredictions.forEach((prediction, index) =>
    blocks.push(
      anchor('prediction-' + prediction.id),
      cite(`### ${index + 1}. ${prediction.title}`),
      cite(prediction.body),
      details('How I would judge this prediction', [cite(prediction.test)])
    )
  )
  blocks.push(
    details(essayChrome.predictionsMarginLabel, [
      cite(essayChrome.predictionsMarginBody + ' [24]')
    ]),
    anchor('mental-model'),
    cite('## ' + essayChrome.mentalModelTitle),
    ...finalClosing.map(cite),
    anchor('sources'),
    '## Source notes',
    ...sourceOrder.map((id) => {
      const source = sourceMap.get(id)
      if (!source) throw new Error('Missing cybersecurity essay source: ' + id)
      return `[^${sourceNumber(id)}]: [${source.title}](${source.url}). **${source.kind}.** ${source.note}`
    }),
    details(
      'Further reading and research materials',
      furtherReading.map(
        (source) => `[${source.title}](${source.url}) · ${source.note}`
      )
    )
  )
  return blocks.join('\n\n') + '\n'
}

const cyberSwarmOverride: BodyOverride = {
  headings: [
    { id: 'opening', text: 'The asymmetry', level: 2, depth: 0 },
    ...essayParts.map((part) => ({
      id: part.id,
      text: part.title,
      level: 2,
      depth: 0
    })),
    {
      id: 'predictions',
      text: essayChrome.predictionsTitle,
      level: 2,
      depth: 0
    },
    {
      id: 'mental-model',
      text: essayChrome.mentalModelTitle,
      level: 2,
      depth: 0
    },
    { id: 'sources', text: 'Source notes', level: 2, depth: 0 }
  ],
  searchText: [
    'A new weapon changes the balance',
    ...essayParts.map((part) => part.title),
    essayChrome.predictionsTitle,
    ...finalPredictions.map((prediction) => prediction.title),
    essayChrome.mentalModelTitle,
    'Source notes',
    ...Object.values(titles),
    essayChrome.swarmCaption,
    'Anas Baba / AFP · 14 May 2021. Northern Gaza Strip. Rockets right; interceptors left. Foreground: Gaza.',
    expertQuotes[0].author,
    expertQuotes[1].author
  ],
  markdown: cyberSwarmMarkdown()
}

// Metadata and publication are still resolved from the CMS snapshot first.
// Deleting this registration restores the normal Notion body everywhere.
export function getBodyOverride(id: string): BodyOverride | undefined {
  return id === cyberSwarmArticleId ? cyberSwarmOverride : undefined
}
