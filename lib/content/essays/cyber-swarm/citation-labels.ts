import {
  essayOpening,
  essayParts,
  capabilityAside,
  releaseAside,
  finalPredictions,
  finalForecastPremise,
  finalClosing,
  essayChrome,
  policyVideo
} from './essay-content'

const chunks = [
  essayChrome.deck,
  '[20]',
  ...essayOpening,
  essayChrome.openingMarginLabel,
  essayChrome.openingMarginBody,
  '[19]',
  essayChrome.swarmCaption,
  ...essayParts.flatMap((part) => [
    part.title,
    ...part.paragraphs.flatMap((text, index) => [
      text,
      ...(part.id === 'defenders' && index === 2 ? ['[26]'] : []),
      ...(part.id === 'defenders' && index === 3 ? ['[29]'] : []),
      ...(part.id === 'defenders' && index === 4 ? ['[5]'] : []),
      ...(part.id === 'capability' && index === 1 ? ['[6]'] : []),
      ...(part.id === 'coverage' && index === 1 ? [releaseAside, '[8]'] : []),
      ...(part.id === 'coverage' && index === 5
        ? [`[${policyVideo.sourceId}]`]
        : []),
      ...(part.id === 'accident' && index === 3 ? ['[32]'] : [])
    ]),
    ...(part.id === 'capability' ? [capabilityAside] : []),
    part.margin.label,
    part.margin.body,
    part.margin.refs.map((id) => `[${id}]`).join(' '),
    ...(part.id === 'defenders' ? ['[22]'] : [])
  ]),
  essayChrome.predictionsTitle,
  finalForecastPremise,
  essayChrome.predictionsIntro,
  ...finalPredictions.flatMap((p) => [p.title, p.body, p.test]),
  essayChrome.predictionsMarginLabel,
  essayChrome.predictionsMarginBody,
  '[24]',
  essayChrome.mentalModelTitle,
  ...finalClosing
]
export const sourceOrder = [
  ...new Set(
    chunks.flatMap((text) =>
      [...text.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]))
    )
  )
]
export function sourceNumber(id: number) {
  return sourceOrder.indexOf(id) + 1
}
