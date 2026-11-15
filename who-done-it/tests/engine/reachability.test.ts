// Reachability for seeds 0..199 at every difficulty. Spec: docs/case-engine.md sections 5.1 and 5.5.
// buildKB with no partial notebook is the closure of everything a player can ask and find, so:
// every lie can be cracked, and the solver recovers exactly the true (killer, weapon, motive).
import { buildKB, DIFFICULTIES, generateCase, solve, type Case, type Difficulty, type Fit } from "../../src/engine/index";
import { blackthorn } from "../../src/scenarios/blackthorn/facts";

const SEEDS = Array.from({ length: 200 }, (_, i) => i);

const cache = new Map<Difficulty, Case[]>();
function casesFor(d: Difficulty): Case[] {
  let list = cache.get(d);
  if (!list) {
    list = SEEDS.map((seed) => generateCase(blackthorn, seed, d));
    cache.set(d, list);
  }
  return list;
}

describe.each(DIFFICULTIES)("reachability (%s)", (d) => {
  it("every lie can be cracked: each chain's reachable version is its last version", () => {
    const bad: string[] = [];
    for (const cs of casesFor(d)) {
      const { versions } = buildKB(blackthorn, cs);
      for (const ch of cs.claims) {
        const key = `${ch.speaker}:${ch.slot}`;
        const want = ch.versions.length - 1;
        if (versions[key] !== want) bad.push(`${d} seed ${cs.seed}: ${key} reaches version ${versions[key]}, expected ${want}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("the solver's fits are exactly the true (killer, weapon, motive)", () => {
    const bad: string[] = [];
    for (const cs of casesFor(d)) {
      const { kb } = buildKB(blackthorn, cs);
      const want: Fit = { killer: cs.solution.killer, weapon: cs.solution.weapon, motive: cs.solution.motive };
      const { fits } = solve(kb);
      if (fits.length !== 1 || JSON.stringify(fits[0]) !== JSON.stringify(want)) {
        bad.push(`${d} seed ${cs.seed}: fits ${JSON.stringify(fits)}, expected only ${JSON.stringify(want)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("is unique even when the player ignores who has withdrawn a claim (non-fallback cases)", () => {
    const bad: string[] = [];
    for (const cs of casesFor(d)) {
      if (cs.fallback) continue;
      const { kb } = buildKB(blackthorn, cs);
      const res = solve(kb, { ignoreAdmissions: true });
      if (res.unique !== true) bad.push(`${d} seed ${cs.seed}: not unique without admissions, fits ${JSON.stringify(res.fits)}`);
    }
    expect(bad).toEqual([]);
  });
});
