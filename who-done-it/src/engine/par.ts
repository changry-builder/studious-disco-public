// Par: an estimate of how many questions a careful player needs. docs/case-engine.md section 8.

import { buildKB, chainKey } from "./kb";
import { solve } from "./solver";
import type { Case, Scenario } from "./types";

export function computePar(scenario: Scenario, cs: Case): { questions: number } {
  const allItems = new Set(cs.items.map((i) => i.id));
  const essential = new Set(cs.claims.map((c) => chainKey(c.speaker, c.slot)));
  // Greedy removal in a fixed order (suspect order, then slot). Not minimal, but deterministic.
  for (const ch of cs.claims) {
    const key = chainKey(ch.speaker, ch.slot);
    essential.delete(key);
    const { kb } = buildKB(scenario, cs, { asked: essential, items: allItems });
    if (!solve(kb).unique) essential.add(key);
  }
  return { questions: Math.max(6, essential.size + cs.suspects.length) };
}
