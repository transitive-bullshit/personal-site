// The portrait loop: swarm → assemble → hold → release, repeating.

export type SwarmPhase = 'swarm' | 'assemble' | 'hold' | 'release'

const phaseDurations: Record<SwarmPhase, number> = {
  swarm: 2,
  assemble: 2,
  hold: 3,
  release: 2.8
}

/** Shortened transition used when jumping straight to a chosen face. */
const quickDurations: Record<SwarmPhase, number> = {
  swarm: 0.25,
  assemble: 1.2,
  hold: 3,
  release: 0.7
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
 *
 * `jump()` cuts the current cycle short: the face releases from wherever it
 * is, the swarm phase ends as soon as an assignment is ready, and the next
 * face assembles quickly. A pinned face then holds until `resume()`.
 */
export function createTimeline(
  durations = phaseDurations,
  quick = quickDurations
) {
  let phase: SwarmPhase = 'swarm'
  let elapsed = 0
  let influence = 0
  let releaseFrom = 1
  let quickTransition = false
  let pinned = false
  const duration = (current: SwarmPhase) =>
    quickTransition ? quick[current] : durations[current]

  return {
    advance(delta: number, ready: boolean) {
      let assign = false
      elapsed += delta
      while (elapsed >= duration(phase)) {
        if (phase === 'swarm' && !ready) {
          elapsed = duration('swarm')
          break
        }
        if (phase === 'hold' && pinned) {
          elapsed = duration('hold')
          break
        }
        elapsed -= duration(phase)
        if (phase === 'assemble') quickTransition = false
        phase = nextPhase[phase]
        if (phase === 'assemble') assign = true
        if (phase === 'release') releaseFrom = 1
      }
      const progress = Math.min(1, elapsed / duration(phase))
      influence =
        phase === 'assemble'
          ? progress
          : phase === 'hold'
            ? 1
            : phase === 'release'
              ? releaseFrom * (1 - progress)
              : 0
      return {
        phase,
        influence,
        assign,
        elapsed,
        quick: quickTransition,
        pinned
      }
    },
    /** Head straight for the next face, optionally holding it once formed. */
    jump(pin = true) {
      quickTransition = true
      pinned = pin
      if (phase === 'assemble' || phase === 'hold' || phase === 'release') {
        releaseFrom = influence
        phase = 'release'
        elapsed = 0
      }
    },
    /** Let a pinned face release and the random loop continue. */
    resume() {
      pinned = false
    }
  }
}
