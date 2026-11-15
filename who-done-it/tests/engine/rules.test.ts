// Rules of the murder, the weapon, the lies and the shapes of claims and items, checked for
// seeds 0..199 at every difficulty. Spec: docs/case-engine.md sections 2, 3, 4 and 4.1.
// Every assertion reads only case.truth, the generated claims and items, and the scenario.
// Violations are collected with their seed and difficulty, then asserted empty.
import { DIFFICULTIES, generateCase, type Case, type CharId, type Claim, type Difficulty } from "../../src/engine/index";
import { blackthorn } from "../../src/scenarios/blackthorn/facts";

const SEEDS = Array.from({ length: 200 }, (_, i) => i);
const ORDER: CharId[] = blackthorn.characters.map((c) => c.id);
const ROOMS = new Map(blackthorn.rooms.map((r) => [r.id, r]));
const WEAPONS = new Map(blackthorn.weapons.map((w) => [w.id, w]));
const SLOTS = blackthorn.slots.length;

const cache = new Map<Difficulty, Case[]>();
function casesFor(d: Difficulty): Case[] {
  let list = cache.get(d);
  if (!list) {
    list = SEEDS.map((seed) => generateCase(blackthorn, seed, d));
    cache.set(d, list);
  }
  return list;
}

/** Everyone in the case: the victim and the suspects. Cast members not chosen are not in truth.loc. */
function people(cs: Case): CharId[] {
  return [cs.victim, ...cs.suspects];
}

/** The claim `speaker` would make if telling the whole truth at `slot` (section 3.3). */
function trueClaim(cs: Case, speaker: CharId, slot: number): Claim {
  const room = cs.truth.loc[speaker]![slot]!;
  const present = people(cs).filter((d) => d !== speaker && cs.truth.loc[d]![slot] === room);
  return { room, with: ORDER.filter((d) => present.includes(d)) };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function sameClaim(a: Claim, b: Claim): boolean {
  return a.room === b.room && sameList(a.with, b.with);
}

/** Runs `check` on every case of a difficulty and asserts that no case reported a violation. */
function eachCase(d: Difficulty, check: (cs: Case, fail: (msg: string) => void) => void): void {
  const bad: string[] = [];
  for (const cs of casesFor(d)) {
    check(cs, (msg) => bad.push(`${d} seed ${cs.seed}: ${msg}`));
  }
  expect(bad).toEqual([]);
}

describe.each(DIFFICULTIES)("rules of the case (%s)", (d) => {
  it("(a) murder rules: the murder slot is 1..T-2; only the killer and the victim share the room then; nobody enters it later; the victim is dead after", () => {
    eachCase(d, (cs, fail) => {
      const { killer, room, slot } = cs.solution;
      const victim = cs.victim;
      const loc = cs.truth.loc;
      if (slot < 1 || slot > SLOTS - 2) fail(`murder slot ${slot} outside 1..${SLOTS - 2}`);

      const atMurder = people(cs).filter((p) => loc[p]![slot] === room).sort();
      const expected = [killer, victim].sort();
      if (!sameList(atMurder, expected)) fail(`in ${room} at slot ${slot} the people are [${atMurder}], expected [${expected}]`);

      for (let t = slot + 1; t < SLOTS; t++) {
        const later = Object.keys(loc).filter((p) => loc[p]![t] === room);
        if (later.length > 0) fail(`[${later}] entered ${room} at slot ${t} after the murder at slot ${slot}`);
        if (loc[victim]![t] !== null) fail(`victim ${victim} is ${loc[victim]![t]} at slot ${t}, expected dead (null)`);
      }
    });
  });

  it("(b) weapon rules: the killer is in the weapon's home room when it is taken; if that is not the murder slot, the killer is alone there; an access list includes the killer", () => {
    eachCase(d, (cs, fail) => {
      const { killer, weapon } = cs.solution;
      const w = WEAPONS.get(weapon);
      if (!w) return fail(`unknown weapon ${weapon}`);
      const tw = cs.truth.weaponTakenSlot;
      const loc = cs.truth.loc;

      if (loc[killer]![tw] !== w.home) fail(`killer is in ${loc[killer]![tw]} at weapon slot ${tw}, expected home ${w.home}`);
      if (tw !== cs.solution.slot) {
        const inHome = Object.keys(loc).filter((p) => loc[p]![tw] === w.home).sort();
        if (!sameList(inHome, [killer])) fail(`in ${w.home} at weapon slot ${tw} the people are [${inHome}], expected only the killer`);
      }
      if (w.access && !w.access.includes(killer)) fail(`${weapon} access list [${w.access}] does not include the killer ${killer}`);
    });
  });

  it("(c) truthfulness: every lie:false version equals the true claim; every lie:true version differs from it", () => {
    eachCase(d, (cs, fail) => {
      for (const ch of cs.claims) {
        const truth = trueClaim(cs, ch.speaker, ch.slot);
        ch.versions.forEach((v, i) => {
          const same = sameClaim(v.claim, truth);
          const where = `${ch.speaker} slot ${ch.slot} version ${i}`;
          if (!v.lie && !same) fail(`${where} is lie:false but is not the truth (${JSON.stringify(v.claim)} vs ${JSON.stringify(truth)})`);
          if (v.lie && same) fail(`${where} is lie:true but equals the truth (${JSON.stringify(v.claim)})`);
        });
      }
    });
  });

  it("(d) who lies: only the killer and at most one other speaker; the killer lies only in the murder slot and ends on an unrefuted lie; the other liar lies in one slot and ends truthfully there", () => {
    eachCase(d, (cs, fail) => {
      const { killer, slot } = cs.solution;
      const liarChains = cs.claims.filter((ch) => ch.versions.some((v) => v.lie));
      const liars = [...new Set(liarChains.map((ch) => ch.speaker))];
      const others = liars.filter((s) => s !== killer);
      if (others.length > 1) fail(`more than one non-killer liar: [${others}]`);

      for (const ch of liarChains.filter((c) => c.speaker === killer)) {
        if (ch.slot !== slot) fail(`killer lies in slot ${ch.slot}, murder slot is ${slot}`);
      }
      const killerMurder = cs.claims.find((c) => c.speaker === killer && c.slot === slot);
      if (!killerMurder) fail(`no claim chain for the killer at the murder slot`);
      else {
        const last = killerMurder.versions[killerMurder.versions.length - 1]!;
        if (!last.lie) fail(`killer's last version at slot ${slot} is not a lie`);
        if (last.refutedBy.length !== 0) fail(`killer's last version at slot ${slot} is refuted by ${JSON.stringify(last.refutedBy)}`);
      }

      for (const s of others) {
        const chains = liarChains.filter((c) => c.speaker === s);
        if (chains.length !== 1) fail(`${s} lies in ${chains.length} slots, expected exactly one`);
        const ch = chains[0];
        if (ch && ch.versions[ch.versions.length - 1]!.lie) fail(`${s}'s last version at slot ${ch.slot} is still a lie`);
      }
    });
  });

  it("(e) shape of lies: a lie:true claim has an empty with list, except a shield's vouch (lists the killer) and the killer's matching claim (with exactly the shield)", () => {
    eachCase(d, (cs, fail) => {
      const { killer } = cs.solution;
      const shield = cs.truth.secondLiar?.kind === "shield" ? cs.truth.secondLiar.who : null;
      for (const ch of cs.claims) {
        for (const [i, v] of ch.versions.entries()) {
          if (!v.lie || v.claim.with.length === 0) continue;
          const vouch = ch.speaker !== killer && v.claim.with.includes(killer);
          const matching = ch.speaker === killer && shield !== null && sameList(v.claim.with, [shield]);
          if (!vouch && !matching) {
            fail(`${ch.speaker} slot ${ch.slot} version ${i} is a lie with companions [${v.claim.with}] that is neither a shield's vouch nor the killer's matching claim`);
          }
        }
      }
    });
  });

  it("(f) refutedBy: every claim reference points at an existing chain and version that is lie:false; every item reference names an existing item", () => {
    eachCase(d, (cs, fail) => {
      for (const ch of cs.claims) {
        for (const [i, v] of ch.versions.entries()) {
          for (const r of v.refutedBy) {
            const where = `${ch.speaker} slot ${ch.slot} version ${i}`;
            if (r.kind === "claim") {
              const target = cs.claims.find((c) => c.speaker === r.speaker && c.slot === r.slot);
              const tv = target?.versions[r.version];
              if (!tv) fail(`${where} refuted by missing claim ${r.speaker}@${r.slot} v${r.version}`);
              else if (tv.lie) fail(`${where} refuted by ${r.speaker}@${r.slot} v${r.version}, which is a lie`);
            } else if (!cs.items.some((it) => it.id === r.id)) {
              fail(`${where} refuted by missing item ${r.id}`);
            }
          }
        }
      }
    });
  });

  it("(g) items with a room and spot: the room exists in the scenario and the spot is one of that room's spots", () => {
    eachCase(d, (cs, fail) => {
      for (const it of cs.items) {
        if (!("room" in it) || !("spot" in it)) continue;
        const room = ROOMS.get(it.room);
        if (!room) fail(`item ${it.id} names unknown room ${it.room}`);
        else if (!room.spots.includes(it.spot)) fail(`item ${it.id} names spot ${it.spot}, not a spot of ${it.room}`);
      }
    });
  });

  it("(h) the killer has exactly one motive document, for the victim", () => {
    eachCase(d, (cs, fail) => {
      const prefix = `${cs.solution.killer}-${cs.victim}-`;
      const docs = cs.items.filter((it) => it.kind === "motiveDoc" && it.link.startsWith(prefix));
      if (docs.length !== 1) fail(`killer has ${docs.length} motive documents starting with ${prefix}: [${docs.map((x) => x.id)}]`);
    });
  });
});
