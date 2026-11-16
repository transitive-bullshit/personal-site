// Picks which portrait the swarm assembles next: every portrait once per
// round in random order, never the same face twice in a row.

export function createPortraitShuffle(count: number, random = Math.random) {
  let bag: number[] = []
  let last = -1

  const refill = () => {
    bag = Array.from({ length: count }, (_, index) => index)
    for (let index = bag.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1))
      ;[bag[index], bag[swap]] = [bag[swap]!, bag[index]!]
    }
  }

  return {
    /**
     * Next portrait among those `available` (loaded) right now, or -1 if none
     * are. Falls back to repeating the last face only when it is the only one.
     */
    next(available: (index: number) => boolean = () => true) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const position = bag.findIndex(
          (index) => available(index) && (index !== last || count === 1)
        )
        if (position >= 0) {
          last = bag.splice(position, 1)[0]!
          return last
        }
        refill()
      }
      return last >= 0 && available(last) ? last : -1
    }
  }
}
