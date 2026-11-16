// Name and subtitle under the assembled face. Text decodes in from random
// glyphs left to right, then scrambles away when the face releases.

const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+?<>/'
const revealDuration = 1
const hideDuration = 0.55

const randomGlyph = () => glyphs[Math.floor(Math.random() * glyphs.length)]!

/** Each character settles a little later than the one before it. */
const settleTimes = (text: string) =>
  Array.from(
    text,
    (_, index) => 0.3 + (index / Math.max(1, text.length - 1)) * 0.68
  )

function decode(text: string, settle: readonly number[], progress: number) {
  const typed = Math.ceil(text.length * Math.min(1, progress / 0.65))
  return Array.from(text, (character, index) =>
    index >= typed
      ? ' '
      : character === ' ' || progress >= settle[index]!
        ? character
        : randomGlyph()
  ).join('')
}

function scramble(text: string, progress: number) {
  return Array.from(text, (character, index) => {
    const local =
      (progress - (index / Math.max(1, text.length - 1)) * 0.6) / 0.4
    return local >= 1 || character === ' '
      ? ' '
      : local <= 0
        ? character
        : randomGlyph()
  }).join('')
}

export function createPortraitCaption(element: HTMLElement) {
  const announcement = document.createElement('span')
  announcement.className = 'faces-sr-only'
  const title = document.createElement('span')
  title.setAttribute('aria-hidden', 'true')
  const subtitle = document.createElement('span')
  subtitle.className = 'faces-caption-subtitle'
  subtitle.setAttribute('aria-hidden', 'true')
  element.replaceChildren(announcement, title, subtitle)

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let name = ''
  let detail = ''
  let visible = false
  let hiding = false
  let elapsed = 0
  let lastFrame = -1
  let nameSettle: number[] = []
  let detailSettle: number[] = []
  let left = -1
  let top = -1

  return {
    update(nextName: string, nextDetail: string, show: boolean, delta: number) {
      if (
        show !== visible ||
        (show && (nextName !== name || nextDetail !== detail))
      ) {
        visible = show
        announcement.textContent = show ? `${nextName}, ${nextDetail}` : ''
        if (show) {
          element.dataset.visible = 'true'
          hiding = false
          name = nextName
          detail = nextDetail
          elapsed = 0
          lastFrame = -1
          nameSettle = settleTimes(name)
          detailSettle = settleTimes(detail)
        } else {
          hiding = true
          elapsed = 0
          lastFrame = -1
        }
      }

      if (hiding) {
        elapsed = Math.min(hideDuration, elapsed + delta)
        if (reducedMotion.matches || elapsed >= hideDuration) {
          element.dataset.visible = 'false'
          title.textContent = ''
          subtitle.textContent = ''
          hiding = false
          return
        }
        const frame = Math.floor(elapsed * 24)
        if (frame !== lastFrame) {
          lastFrame = frame
          title.textContent = scramble(
            name.toUpperCase(),
            elapsed / hideDuration
          )
          subtitle.textContent = scramble(detail, elapsed / hideDuration)
        }
        return
      }

      if (!visible) return
      const upper = name.toUpperCase()
      elapsed = Math.min(revealDuration, elapsed + delta)
      if (reducedMotion.matches || elapsed >= revealDuration) {
        if (title.textContent !== upper) title.textContent = upper
        if (subtitle.textContent !== detail) subtitle.textContent = detail
        return
      }
      // Re-roll glyphs at 24 fps, not every frame.
      const frame = Math.floor(elapsed * 24)
      if (frame === lastFrame) return
      lastFrame = frame
      title.textContent = decode(upper, nameSettle, elapsed / revealDuration)
      subtitle.textContent = decode(
        detail,
        detailSettle,
        elapsed / revealDuration
      )
    },
    position(x: number, y: number) {
      const nextLeft = Math.round(x)
      const nextTop = Math.round(y)
      if (nextLeft === left && nextTop === top) return
      element.style.left = `${nextLeft}px`
      element.style.top = `${nextTop}px`
      left = nextLeft
      top = nextTop
    },
    dispose() {
      element.replaceChildren()
      delete element.dataset.visible
    }
  }
}
