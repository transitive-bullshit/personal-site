export const lagRows = [
  { label: '2025', start: 6, end: 10 },
  { label: '2026', start: 4, end: 7 }
]

export const dnsEvents = [
  { time: '09:50:23', label: 'External chatbot responds' },
  { time: '10:02:11', label: 'P0 alert raised' },
  { time: '10:05:06', label: 'Human acknowledges alert' },
  { time: '12:34:30', label: 'Manual shutdown' }
]

export const patchRelease = { exploitHoursUpperBound: 1, releaseDays: 18 }

export const titles = {
  openModelLag: 'Open models are closing the gap.',
  patchReleaseGap: 'Hours to exploit. Days to release.',
  dnsControlTimeline: 'Detected, but not stopped.',
  defendersWindow: 'The defender’s window'
}

export const defenderWindowDescription =
  'OpenAI’s conceptual model shows frontier capability rising, operational defenders catching up after continuous-defense adoption, and broadly diffused models remaining below them; the shaded gap is the defender’s window.'
