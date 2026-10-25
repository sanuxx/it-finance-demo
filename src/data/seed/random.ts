/** Small deterministic PRNG (mulberry32) so the seed dataset is reproducible. */
export function createRandom(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    between: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
    chance: (p: number) => next() < p,
    /** Round to a "nice" amount, e.g. nearest 500. */
    nice: (value: number, step = 500) => Math.round(value / step) * step,
  }
}

export type Random = ReturnType<typeof createRandom>
