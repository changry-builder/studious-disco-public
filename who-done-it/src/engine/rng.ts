// Deterministic random numbers. See docs/case-engine.md section 6.1.
// Never use Math.random, Date, or anything locale-dependent in the engine.

/** 32-bit integer hash (murmur3 finalizer) of two numbers. */
export function mix(a: number, b: number): number {
  let h = (a >>> 0) ^ Math.imul((b >>> 0) + 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface Rng {
  /** Next raw uint32. */
  next(): number;
  /** Integer in [0, n). n must be a positive integer below 2^21. */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
  /** Returns a new shuffled array (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability num/den. */
  chance(num: number, den: number): boolean;
}

/** mulberry32 over a uint32 state. */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const int = (n: number): number => {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`rng.int: bad n ${n}`);
    return Math.floor((next() * n) / 4294967296);
  };
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("rng.pick: empty list");
      return items[int(items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
    chance(num: number, den: number): boolean {
      return int(den) < num;
    },
  };
}
