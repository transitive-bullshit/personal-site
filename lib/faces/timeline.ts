// The portrait loop: swarm → assemble → hold → release, repeating.

export type SwarmPhase = 'swarm' | 'assemble' | 'hold' | 'release'

const phaseDurations: Record<SwarmPhase, number> = {
  swarm: 2,
  assemble: 2,
  hold: 3,
  release: 2.8
}

const nextPhase: Record<SwarmPhase, SwarmPhase> = {
  swarm: 'assemble',
  assemble: 'hold',
  hold: 'release',
  release: 'swarm'
}

/**
 * Swarm → assemble → hold → release, looping. The swarm phase waits for a
 * portrait assignment before it ends.
 */
export function createTimeline(durations = phaseDurations) {
  let phase: SwarmPhase = 'swarm'
  let elapsed = 0
  return {
    advance(delta: number, ready: boolean) {
      let assign = false
      elapsed += delta
      while (elapsed >= durations[phase]) {
        if (phase === 'swarm' && !ready) {
          elapsed = durations.swarm
          break
        }
        elapsed -= durations[phase]
        phase = nextPhase[phase]
        if (phase === 'assemble') assign = true
      }
      const progress = elapsed / durations[phase]
      const influence =
        phase === 'assemble'
          ? progress
          : phase === 'hold'
            ? 1
            : phase === 'release'
              ? 1 - progress
              : 0
      return { phase, influence, assign, elapsed }
    }
  }
}
