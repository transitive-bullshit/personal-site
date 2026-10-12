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

export type RepairEstate = 'managed' | 'legacy' | 'unsupported'
export const repairPaths = {
  managed: {
    label: 'Managed software',
    stages: ['Validate a fix', 'Shared release', 'Verify uptake'],
    note: 'A common owner and release path can distribute one fix widely. Protection still requires actual uptake.',
    outcome: 'A shared path to repair'
  },
  legacy: {
    label: 'Legacy company',
    stages: ['Validate a fix', 'Several release paths', 'Verify each rollout'],
    note: 'Separate owners, dependencies, and operating constraints divide the rollout. One fixed system does not protect every connected system.',
    outcome: 'Several paths to repair'
  },
  unsupported: {
    label: 'Unsupported device',
    stages: ['Identify the flaw', 'Support has ended', 'Replace the device'],
    note: 'This device has no supported firmware fix. Permanent repair needs replacement or a new supported path; isolation can remove its exposure.',
    outcome: 'The supported update path is missing'
  }
}

export const patchRelease = { exploitHoursUpperBound: 1, releaseDays: 18 }

export const titles = {
  openModelLag: 'Open models are closing the gap.',
  patchReleaseGap: 'Hours to exploit. Days to release.',
  dnsControlTimeline: 'Detected, but not stopped.',
  protectionPaths: 'The finding is the same. The path changes.',
  defendersWindow: 'The defender’s window'
}

export const defenderWindowDescription =
  'OpenAI’s conceptual model shows frontier capability rising, operational defenders catching up after continuous-defense adoption, and broadly diffused models remaining below them; the shaded gap is the defender’s window.'
