// Builds the knowledge base: what a player can know. See docs/case-engine.md section 5.1.

import type { Case, CharId, Claim, ClaimChain, EvidenceRef, KB, Scenario } from "./types";

export function chainKey(speaker: CharId, slot: number): string {
  return `${speaker}:${slot}`;
}

export function refKey(r: EvidenceRef): string {
  return r.kind === "item" ? `i:${r.id}` : `c:${r.speaker}:${r.slot}:${r.version}`;
}

export function findChain(cs: Case, speaker: CharId, slot: number): ClaimChain | undefined {
  return cs.claims.find((c) => c.speaker === speaker && c.slot === slot);
}

/** What the player holds. Omit to mean "everything that can be asked or found". */
export interface Known {
  /** Chain keys (speaker:slot) the player has asked about. */
  asked: ReadonlySet<string>;
  /** Item ids the player has found. */
  items: ReadonlySet<string>;
}

export interface Closure {
  kb: KB;
  /** Highest reachable version index per chain key (only for asked chains). */
  versions: Record<string, number>;
}

/**
 * Reachable closure: starting from version 0 of every asked claim and every held item,
 * advance a lie chain whenever one of its refuters is held. Repeats until stable.
 */
export function buildKB(scenario: Scenario, cs: Case, known?: Known): Closure {
  const asked = (key: string): boolean => (known ? known.asked.has(key) : true);
  const hasItem = (id: string): boolean => (known ? known.items.has(id) : true);

  const versions: Record<string, number> = {};
  for (const ch of cs.claims) {
    const key = chainKey(ch.speaker, ch.slot);
    if (asked(key)) versions[key] = 0;
  }
  const refHeld = (r: EvidenceRef): boolean => {
    if (r.kind === "item") return hasItem(r.id);
    return versions[chainKey(r.speaker, r.slot)] === r.version;
  };

  const withdrawn: { who: CharId; slot: number }[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const ch of cs.claims) {
      const key = chainKey(ch.speaker, ch.slot);
      const v = versions[key];
      if (v === undefined || v >= ch.versions.length - 1) continue;
      const cur = ch.versions[v]!;
      if (cur.refutedBy.some(refHeld)) {
        versions[key] = v + 1;
        if (!withdrawn.some((w) => w.who === ch.speaker && w.slot === ch.slot)) {
          withdrawn.push({ who: ch.speaker, slot: ch.slot });
        }
        changed = true;
      }
    }
  }

  const slots = scenario.slots.length;
  const current: Record<CharId, (Claim | undefined)[]> = {};
  for (const s of cs.suspects) current[s] = new Array<Claim | undefined>(slots).fill(undefined);
  for (const ch of cs.claims) {
    const v = versions[chainKey(ch.speaker, ch.slot)];
    if (v !== undefined) current[ch.speaker]![ch.slot] = ch.versions[v]!.claim;
  }

  const items = cs.items.filter((it) => hasItem(it.id));
  const bonds: { from: CharId; to: CharId }[] = [];
  const inCase = (c: CharId): boolean => cs.suspects.includes(c);
  for (const b of scenario.bonds) {
    if (b.public && inCase(b.from) && inCase(b.to)) bonds.push({ from: b.from, to: b.to });
  }
  for (const it of items) {
    if (it.kind === "bondDoc") for (const p of it.pairs) bonds.push({ from: p.from, to: p.to });
  }

  return {
    kb: {
      suspects: cs.suspects,
      victim: cs.victim,
      bodyRoom: cs.body.room,
      slots,
      rooms: scenario.rooms.map((r) => r.id),
      current,
      withdrawn,
      bonds,
      items,
      weapons: scenario.weapons,
      motiveLinks: scenario.motives,
    },
    versions,
  };
}
