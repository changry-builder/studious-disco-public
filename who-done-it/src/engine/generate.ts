// The case generator. Spec: docs/case-engine.md sections 4 and 6.
// Fully deterministic: the same (scenario, seed, difficulty) always gives the same case.

import { DIFFICULTY, GEN_VERSION, MAX_ATTEMPTS, type DifficultyParams } from "./difficulty";
import { buildKB, chainKey } from "./kb";
import { computePar } from "./par";
import { makeRng, mix, type Rng } from "./rng";
import { solve, survivingKillers } from "./solver";
import type {
  Case,
  CharId,
  Claim,
  ClaimChain,
  ClaimVersion,
  Difficulty,
  Disposition,
  EvidenceRef,
  Family,
  Item,
  MotiveLink,
  RoomId,
  Scenario,
  Weapon,
} from "./types";

type LieKind = "occupied" | "shielded" | "secretRoom";

interface Plan {
  victim: CharId;
  killer: CharId;
  suspects: CharId[];
  link: MotiveLink;
  redHerrings: MotiveLink[];
  second: null | { kind: "shield" | "secretKeeper"; who: CharId };
  secretRoom?: RoomId;
  weapon: Weapon;
  rm: RoomId;
  tm: number;
  tw: number;
  ts?: number;
  disposition: Disposition;
  td?: number;
  dumpRoom?: RoomId;
  chain: LieKind[];
  /** An innocent who was also alone where the weapon is kept, before the murder. */
  decoy?: { who: CharId; slot: number };
  todFrom: number;
  todTo: number;
}

type Loc = Record<CharId, (RoomId | null)[]>;

export function generateCase(scenario: Scenario, seed: number, difficulty: Difficulty): Case {
  const P = DIFFICULTY[difficulty];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = makeRng(mix(seed, attempt));
    const built = tryBuild(scenario, rng, P, false);
    if (built) return finish(scenario, built, seed, difficulty, attempt, false);
  }
  // Guaranteed fallback (section 6.4). Placement can still fail by chance, so loop on sub-seeds.
  for (let i = 0; i < 2000; i++) {
    const rng = makeRng(mix(seed, MAX_ATTEMPTS + i));
    const built = tryBuild(scenario, rng, fallbackParams(P), true);
    if (built) return finish(scenario, built, seed, difficulty, MAX_ATTEMPTS + i, true);
  }
  throw new Error(`generateCase: could not build even a fallback case for seed ${seed}`);
}

function fallbackParams(P: DifficultyParams): DifficultyParams {
  return {
    ...P,
    secondLiar: "none",
    lieDepth: 1,
    minRefuters: 1,
    todWidth: 1,
    dispositions: ["atScene"],
    redHerringWeapon: false,
    minLoose: 0,
    maxLoose: 99,
    minGrounds: 0,
    minOppSurvivors: 0,
    minMeansSurvivors: 0,
    strict: false,
    maxRepairs: 0,
  };
}

interface Built {
  plan: Plan;
  loc: Loc;
  claims: ClaimChain[];
  items: Item[];
  repairs: number;
}

function finish(
  scenario: Scenario,
  b: Built,
  seed: number,
  difficulty: Difficulty,
  attempt: number,
  fallback: boolean,
): Case {
  const p = b.plan;
  const cs: Case = {
    genVersion: GEN_VERSION,
    scenarioId: scenario.id,
    seed,
    difficulty,
    attempt,
    fallback,
    repairs: b.repairs,
    victim: p.victim,
    suspects: p.suspects,
    body: { room: p.rm },
    claims: b.claims,
    items: b.items,
    solution: { killer: p.killer, weapon: p.weapon.id, motive: p.link.type, room: p.rm, slot: p.tm },
    truth: {
      loc: b.loc,
      secondLiar: p.second ? { kind: p.second.kind, who: p.second.who, slot: p.second.kind === "shield" ? p.tm : p.ts! } : null,
      weaponTakenSlot: p.tw,
      disposition: p.disposition,
    },
    par: { questions: 0 },
  };
  cs.par = computePar(scenario, cs);
  return cs;
}

// ---------------------------------------------------------------- planning

function hasBond(scenario: Scenario, from: CharId, to: CharId): boolean {
  return scenario.bonds.some((b) => b.from === from && b.to === to);
}

function makePlan(scenario: Scenario, rng: Rng, P: DifficultyParams): Plan | null {
  const T = scenario.slots.length;
  const charIds = scenario.characters.map((c) => c.id);
  const roomIds = scenario.rooms.map((r) => r.id);

  // 1. Cast
  const victim = rng.pick(scenario.victims);
  const linksVs = scenario.motives.filter((m) => m.victim === victim);
  const killerPool = charIds.filter((c) => linksVs.some((m) => m.suspect === c));
  const killer = rng.pick(killerPool);
  const others = charIds.filter((c) => c !== victim && c !== killer);

  let kind: "shield" | "secretKeeper" | null =
    P.secondLiar === "none" ? null : P.secondLiar === "secretKeeper" ? "secretKeeper" : rng.chance(1, 2) ? "shield" : "secretKeeper";
  let shield: CharId | undefined;
  if (kind === "shield") {
    const cands = others.filter((c) => hasBond(scenario, c, killer));
    if (cands.length === 0) kind = "secretKeeper";
    else shield = rng.pick(cands);
  }
  const pool = rng.shuffle(others.filter((c) => c !== shield));
  const chosen = new Set<CharId>([killer, ...(shield ? [shield] : []), ...pool.slice(0, P.suspects - 1 - (shield ? 1 : 0))]);
  const suspects = charIds.filter((c) => chosen.has(c));
  if (suspects.length !== P.suspects) return null;
  const innocents = suspects.filter((c) => c !== killer);

  let second: Plan["second"] = null;
  let secretRoom: RoomId | undefined;
  if (kind === "shield") second = { kind: "shield", who: shield! };
  if (kind === "secretKeeper") {
    const cands = innocents.filter((c) => scenario.characters.find((ch) => ch.id === c)?.secret);
    if (cands.length === 0) return null;
    const who = rng.pick(cands);
    second = { kind: "secretKeeper", who };
    secretRoom = scenario.characters.find((ch) => ch.id === who)!.secret!.room;
  }

  // 2. Motives
  const link = rng.pick(linksVs.filter((m) => m.suspect === killer));
  const rhPool = rng.shuffle(
    innocents.filter((c) => !(second?.kind === "secretKeeper" && second.who === c) && linksVs.some((m) => m.suspect === c)),
  );
  if (rhPool.length < P.redHerringMotives) return null;
  const redHerrings = rhPool.slice(0, P.redHerringMotives).map((c) => rng.pick(linksVs.filter((m) => m.suspect === c)));

  // 4. Crime
  const weapon = rng.pick(scenario.weapons.filter((w) => !w.access || w.access.includes(killer)));
  const rm = rng.pick(roomIds);
  const tm = 1 + rng.int(T - 2);
  const tw = weapon.home === rm ? tm : rng.int(tm);
  const disposition = rng.pick(P.dispositions);
  let td: number | undefined;
  let dumpRoom: RoomId | undefined;
  if (disposition === "hidden") {
    td = tm + 1 + rng.int(T - 1 - tm);
    dumpRoom = rng.pick(roomIds.filter((r) => r !== rm && r !== weapon.home));
  }

  let chain: LieKind[];
  if (!second) chain = ["occupied"];
  else if (second.kind === "secretKeeper") chain = P.lieDepth === 1 ? ["secretRoom"] : ["occupied", "secretRoom"];
  else chain = P.lieDepth === 1 ? ["shielded"] : ["shielded", "occupied"];

  let ts: number | undefined;
  if (second?.kind === "secretKeeper") {
    ts = tm; // every chain with a secret-keeper uses the secretRoom lie
    if (secretRoom === rm) return null;
    if (secretRoom === dumpRoom && td === ts) return null;
  }

  // A decoy: an innocent who was also alone with the weapon before the murder,
  // so "who had access" does not name the killer by itself.
  let decoy: Plan["decoy"];
  if (P.minMeansSurvivors > 1 && weapon.home !== rm) {
    const slots: number[] = [];
    for (let t = 0; t < tm; t++) if (t !== tw) slots.push(t);
    const cands = innocents.filter((c) => !weapon.access || weapon.access.includes(c));
    if (slots.length === 0 || cands.length === 0) return null;
    decoy = { who: rng.pick(cands), slot: rng.pick(slots) };
  }

  // 5. Time-of-death window containing tm, inside [1, T-2]
  const width = Math.min(P.todWidth, T - 2);
  const lo = Math.max(1, tm - width + 1);
  const hi = Math.min(tm, T - 1 - width);
  const todFrom = lo + rng.int(hi - lo + 1);

  return {
    victim, killer, suspects, link, redHerrings, second, secretRoom, weapon, rm, tm, tw, ts,
    disposition, td, dumpRoom, chain, decoy, todFrom, todTo: todFrom + width - 1,
  };
}

// ---------------------------------------------------------------- placement

function place(scenario: Scenario, rng: Rng, P: DifficultyParams, p: Plan): Loc | null {
  const T = scenario.slots.length;
  const roomIds = scenario.rooms.map((r) => r.id);
  const people = [p.victim, ...p.suspects];
  const loc: Loc = {};
  for (const c of people) loc[c] = [];

  const fixed = (c: CharId, t: number): RoomId | undefined => {
    if (c === p.killer) {
      if (t === p.tm) return p.rm;
      if (t === p.tw) return p.weapon.home;
      if (p.td !== undefined && t === p.td) return p.dumpRoom;
    }
    if (c === p.victim && t === p.tm) return p.rm;
    if (p.decoy && c === p.decoy.who && t === p.decoy.slot) return p.weapon.home;
    if (p.second?.kind === "secretKeeper" && c === p.second.who && t === p.ts) return p.secretRoom;
    return undefined;
  };

  for (let t = 0; t < T; t++) {
    let done = false;
    for (let attempt = 0; attempt < 300 && !done; attempt++) {
      const a: Record<CharId, RoomId | null> = {};
      const placed: RoomId[] = [];
      for (const c of people) {
        if (c === p.victim && t > p.tm) {
          a[c] = null;
          continue;
        }
        let room = fixed(c, t);
        if (room === undefined) {
          const prev = t > 0 ? loc[c]![t - 1] : undefined;
          if (prev && rng.chance(1, 3)) room = prev;
          else if (placed.length > 0 && rng.chance(1, 2)) room = rng.pick(placed);
          else room = rng.pick(roomIds);
        }
        a[c] = room;
        placed.push(room);
      }
      if (slotOk(scenario, P, p, t, a)) {
        for (const c of people) loc[c]!.push(a[c] ?? null);
        done = true;
      }
    }
    if (!done) return null;
  }
  return loc;
}

function occupants(a: Record<CharId, RoomId | null>, room: RoomId): CharId[] {
  return Object.keys(a).filter((c) => a[c] === room);
}

/** Suspects who are plain innocents: not the killer and not the second liar. */
function pureInnocents(p: Plan): CharId[] {
  return p.suspects.filter((c) => c !== p.killer && c !== p.second?.who);
}

function sameMembers(a: CharId[], b: CharId[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function slotOk(scenario: Scenario, P: DifficultyParams, p: Plan, t: number, a: Record<CharId, RoomId | null>): boolean {
  const pure = pureInnocents(p);
  const inRm = occupants(a, p.rm);
  if (t === p.tm && !sameMembers(inRm, [p.killer, p.victim])) return false; // M1
  if (t > p.tm && inRm.length > 0) return false; // M2
  if (t === p.tw && p.tw !== p.tm && !sameMembers(occupants(a, p.weapon.home), [p.killer])) return false; // M3
  if (p.decoy && t === p.decoy.slot && !sameMembers(occupants(a, p.weapon.home), [p.decoy.who])) return false;
  if (p.td !== undefined && t === p.td && !sameMembers(occupants(a, p.dumpRoom!), [p.killer])) return false;

  if (p.second?.kind === "secretKeeper" && t === p.ts) {
    if (!sameMembers(occupants(a, p.secretRoom!), [p.second.who])) return false;
    if (secretLieRooms(scenario, p, a).length === 0) return false;
  }
  // The victim is seen alive in every window slot before the murder.
  if (t >= p.todFrom && t < p.tm) {
    const withVictim = occupants(a, a[p.victim]!).filter((c) => c !== p.victim && c !== p.killer);
    if (withVictim.length === 0) return false;
  }
  if (t === p.tm) {
    if (p.chain.includes("occupied") && occupiedLieRooms(scenario, P, p, a).length === 0) return false;
    if (p.second?.kind === "shield") {
      const rs = a[p.second.who]!;
      if (!occupants(a, rs).some((c) => pure.includes(c))) return false;
    }
    if (finalLieRooms(scenario, p, a).length === 0) return false;
    const group = p.suspects.filter((c) => c !== p.killer && !(p.second?.kind === "secretKeeper" && c === p.second.who));
    let loose = 0;
    for (const x of group) {
      const solid = group.some((z) => z !== x && a[z] === a[x] && !hasBond(scenario, z, x));
      if (!solid) loose++;
    }
    if (loose < P.minLoose || loose > P.maxLoose) return false;
  }
  return true;
}

/** Rooms the killer's "alone in Rc" lie may name: enough plain innocents were truly there. */
function occupiedLieRooms(scenario: Scenario, P: DifficultyParams, p: Plan, a: Record<CharId, RoomId | null>): RoomId[] {
  const pure = pureInnocents(p);
  const shieldRoom = p.second?.kind === "shield" ? a[p.second.who] : undefined;
  return scenario.rooms
    .map((r) => r.id)
    .filter((r) => r !== shieldRoom && occupants(a, r).filter((c) => pure.includes(c)).length >= P.minRefuters);
}

/** Rooms nobody was in at the murder slot: the killer's final, unrefutable lie. */
function finalLieRooms(scenario: Scenario, p: Plan, a: Record<CharId, RoomId | null>): RoomId[] {
  return scenario.rooms.map((r) => r.id).filter((r) => r !== p.rm && r !== p.secretRoom && occupants(a, r).length === 0);
}

/** Rooms the secret-keeper's "alone in R'" lie may name: a truthful suspect was truly there. */
function secretLieRooms(scenario: Scenario, p: Plan, a: Record<CharId, RoomId | null>): RoomId[] {
  const truthful = p.suspects.filter((c) => c !== p.second!.who && !(c === p.killer && p.ts === p.tm));
  return scenario.rooms.map((r) => r.id).filter((r) => occupants(a, r).some((c) => truthful.includes(c)));
}

// ---------------------------------------------------------------- claims

function slotAssignment(p: Plan, loc: Loc, t: number): Record<CharId, RoomId | null> {
  const a: Record<CharId, RoomId | null> = {};
  for (const c of [p.victim, ...p.suspects]) a[c] = loc[c]![t] ?? null;
  return a;
}

function truthClaim(scenario: Scenario, p: Plan, loc: Loc, c: CharId, t: number): Claim {
  const room = loc[c]![t]!;
  const order = scenario.characters.map((ch) => ch.id);
  const present = [p.victim, ...p.suspects].filter((d) => d !== c && loc[d]![t] === room);
  return { room, with: order.filter((d) => present.includes(d)) };
}

function claimRef(speaker: CharId, slot: number, version: number): EvidenceRef {
  return { kind: "claim", speaker, slot, version };
}

function buildClaims(scenario: Scenario, rng: Rng, P: DifficultyParams, p: Plan, loc: Loc): ClaimChain[] {
  const order = scenario.characters.map((ch) => ch.id);
  const chains: ClaimChain[] = [];
  for (const c of p.suspects) {
    for (let t = 0; t < scenario.slots.length; t++) {
      chains.push({ speaker: c, slot: t, versions: [{ claim: truthClaim(scenario, p, loc, c, t), lie: false, refutedBy: [] }] });
    }
  }
  const chain = (c: CharId, t: number): ClaimChain => chains.find((ch) => ch.speaker === c && ch.slot === t)!;
  const pure = pureInnocents(p);
  const atTm = slotAssignment(p, loc, p.tm);

  // Second liar
  if (p.second?.kind === "shield") {
    const s = p.second.who;
    const truth = truthClaim(scenario, p, loc, s, p.tm);
    const vouch: Claim = { room: truth.room, with: order.filter((d) => truth.with.includes(d) || d === p.killer) };
    const refuters = occupants(atTm, truth.room).filter((c) => pure.includes(c)).map((c) => claimRef(c, p.tm, 0));
    chain(s, p.tm).versions = [
      { claim: vouch, lie: true, refutedBy: refuters },
      { claim: truth, lie: false, refutedBy: [] },
    ];
  }
  if (p.second?.kind === "secretKeeper") {
    const q = p.second.who;
    const ts = p.ts!;
    const atTs = slotAssignment(p, loc, ts);
    const lieRoom = rng.pick(secretLieRooms(scenario, p, atTs));
    const truthful = p.suspects.filter((c) => c !== q && !(c === p.killer && ts === p.tm));
    const refuters = occupants(atTs, lieRoom).filter((c) => truthful.includes(c)).map((c) => claimRef(c, ts, 0));
    chain(q, ts).versions = [
      { claim: { room: lieRoom, with: [] }, lie: true, refutedBy: refuters },
      { claim: truthClaim(scenario, p, loc, q, ts), lie: false, refutedBy: [] },
    ];
  }

  // Killer: catchable lies, then the final one
  const versions: ClaimVersion[] = [];
  for (const kind of p.chain) {
    if (kind === "occupied") {
      const rc = rng.pick(occupiedLieRooms(scenario, P, p, atTm));
      const refuters = occupants(atTm, rc).filter((c) => pure.includes(c)).map((c) => claimRef(c, p.tm, 0));
      versions.push({ claim: { room: rc, with: [] }, lie: true, refutedBy: refuters });
    } else if (kind === "shielded") {
      const s = p.second!.who;
      const rs = atTm[s]!;
      const refuters = occupants(atTm, rs).filter((c) => pure.includes(c)).map((c) => claimRef(c, p.tm, 0));
      refuters.push(claimRef(s, p.tm, 1));
      versions.push({ claim: { room: rs, with: [s] }, lie: true, refutedBy: refuters });
    } else {
      versions.push({ claim: { room: p.secretRoom!, with: [] }, lie: true, refutedBy: [claimRef(p.second!.who, p.tm, 1)] });
    }
  }
  versions.push({ claim: { room: rng.pick(finalLieRooms(scenario, p, atTm)), with: [] }, lie: true, refutedBy: [] });
  chain(p.killer, p.tm).versions = versions;
  return chains;
}

// ---------------------------------------------------------------- items

function buildItems(scenario: Scenario, rng: Rng, P: DifficultyParams, p: Plan): Item[] {
  const items: Item[] = [];
  const room = (id: RoomId) => scenario.rooms.find((r) => r.id === id)!;
  items.push({ id: "wound", kind: "wound", class: p.weapon.class });
  items.push({ id: "tod", kind: "tod", from: p.todFrom, to: p.todTo });

  let redHerring: Weapon | undefined;
  if (P.redHerringWeapon) {
    const cands = scenario.weapons.filter((w) => w.class === p.weapon.class && w.id !== p.weapon.id);
    if (cands.length > 0) redHerring = rng.pick(cands);
  }
  for (const w of scenario.weapons) {
    if (w.id === p.weapon.id) {
      const foundRoom = p.disposition === "atScene" ? p.rm : p.disposition === "hidden" ? p.dumpRoom! : undefined;
      const atHome = foundRoom === w.home;
      if (!atHome) items.push({ id: `w:${w.id}:missing`, kind: "weaponMissing", weapon: w.id, room: w.home, spot: w.homeSpot });
      if (foundRoom) {
        const spot = atHome ? w.homeSpot : rng.pick(room(foundRoom).spots);
        items.push({ id: `w:${w.id}:found`, kind: "weaponFound", weapon: w.id, used: true, room: foundRoom, spot });
      }
    } else if (redHerring && w.id === redHerring.id) {
      const elsewhere = rng.pick(scenario.rooms.filter((r) => r.id !== w.home));
      items.push({ id: `w:${w.id}:missing`, kind: "weaponMissing", weapon: w.id, room: w.home, spot: w.homeSpot });
      items.push({ id: `w:${w.id}:found`, kind: "weaponFound", weapon: w.id, used: false, room: elsewhere.id, spot: rng.pick(elsewhere.spots) });
    } else {
      items.push({ id: `w:${w.id}:inplace`, kind: "weaponInPlace", weapon: w.id, room: w.home, spot: w.homeSpot });
    }
  }
  for (const l of scenario.motives) {
    if (l.id === p.link.id || p.redHerrings.some((r) => r.id === l.id)) {
      items.push({ id: `m:${l.id}`, kind: "motiveDoc", link: l.id, room: l.doc.room, spot: l.doc.spot });
    }
  }
  // Secret bonds between two people present; bonds sharing one document become one item.
  for (const b of scenario.bonds) {
    if (b.public || !p.suspects.includes(b.from) || !p.suspects.includes(b.to)) continue;
    const existing = items.find((it) => it.kind === "bondDoc" && it.room === b.doc!.room && it.spot === b.doc!.spot);
    if (existing && existing.kind === "bondDoc") existing.pairs.push({ from: b.from, to: b.to });
    else items.push({ id: `b:${b.from}-${b.to}`, kind: "bondDoc", pairs: [{ from: b.from, to: b.to }], room: b.doc!.room, spot: b.doc!.spot });
  }
  if (p.second?.kind === "secretKeeper") {
    const ch = scenario.characters.find((c) => c.id === p.second!.who)!;
    items.push({ id: `s:${ch.id}`, kind: "secretTrace", who: ch.id, room: ch.secret!.room, spot: ch.secret!.evidenceSpot });
  }
  return items;
}

function presenceItem(scenario: Scenario, who: CharId, at: RoomId, slot: number): Item {
  const r = scenario.rooms.find((x) => x.id === at)!;
  return { id: `p:${who}:${at}:${slot}`, kind: "presence", who, at, slot, room: at, spot: r.proofSpot };
}

// ---------------------------------------------------------------- build, verify, repair

function draft(scenario: Scenario, b: Built): Case {
  const p = b.plan;
  return {
    genVersion: GEN_VERSION, scenarioId: scenario.id, seed: 0, difficulty: "easy", attempt: 0, fallback: false, repairs: 0,
    victim: p.victim, suspects: p.suspects, body: { room: p.rm }, claims: b.claims, items: b.items,
    solution: { killer: p.killer, weapon: p.weapon.id, motive: p.link.type, room: p.rm, slot: p.tm },
    truth: { loc: b.loc, secondLiar: null, weaponTakenSlot: p.tw, disposition: p.disposition },
    par: { questions: 0 },
  };
}

function tryBuild(scenario: Scenario, rng: Rng, P: DifficultyParams, fallback: boolean): Built | null {
  const plan = makePlan(scenario, rng, P);
  if (!plan) return null;
  const loc = place(scenario, rng, P, plan);
  if (!loc) return null;
  const claims = buildClaims(scenario, rng, P, plan, loc);
  const items = buildItems(scenario, rng, P, plan);
  if (fallback) items.push(presenceItem(scenario, plan.killer, plan.rm, plan.tm));
  const b: Built = { plan, loc, claims, items, repairs: 0 };

  const isTruth = (f: { killer: CharId; weapon: string; motive: string }): boolean =>
    f.killer === plan.killer && f.weapon === plan.weapon.id && f.motive === plan.link.type;

  // 9. Verify and repair
  for (;;) {
    const { kb } = buildKB(scenario, draft(scenario, b));
    const res = solve(kb);
    if (!res.fits.some(isTruth)) {
      throw new Error("engine bug: the true solution does not pass the solver");
    }
    const strict = P.strict ? solve(kb, { ignoreAdmissions: true }) : res;
    if (P.strict && !strict.fits.some(isTruth)) {
      throw new Error("engine bug: the true solution does not pass the strict solver");
    }
    if (res.unique && strict.unique) break;
    if (b.repairs >= P.maxRepairs) return null;
    const r = res.unique ? strict : res;
    const wrongWeapon = r.fits.some((f) => f.killer === plan.killer && f.weapon !== plan.weapon.id);
    const wrongSurv = r.survivors.filter((s) => s.killer !== plan.killer);
    if (wrongWeapon && plan.disposition === "gone") {
      // R3: the weapon turns up at the scene after all.
      plan.disposition = "atScene";
      const w = plan.weapon;
      const atHome = w.home === plan.rm;
      const spot = atHome ? w.homeSpot : rng.pick(scenario.rooms.find((x) => x.id === plan.rm)!.spots);
      if (atHome) b.items = b.items.filter((it) => it.id !== `w:${w.id}:missing`);
      b.items.push({ id: `w:${w.id}:found`, kind: "weaponFound", weapon: w.id, used: true, room: plan.rm, spot });
    } else if (wrongSurv.some((s) => s.slot !== plan.tm) && plan.todTo > plan.todFrom) {
      // R2: narrow the time-of-death window toward the murder slot.
      if (wrongSurv.some((s) => s.slot < plan.tm)) plan.todFrom++;
      else plan.todTo--;
      b.items = b.items.map((it) => (it.kind === "tod" ? { ...it, from: plan.todFrom, to: plan.todTo } : it));
    } else if (wrongSurv.length > 0) {
      // R1: a physical record places a wrongly-surviving innocent where they truly were.
      const x = wrongSurv[0]!.killer;
      const item = presenceItem(scenario, x, loc[x]![plan.tm]!, plan.tm);
      if (b.items.some((it) => it.id === item.id)) return null;
      b.items.push(item);
    } else {
      return null;
    }
    b.repairs++;
  }

  // 10. Quality gates
  const closure = buildKB(scenario, draft(scenario, b));
  for (const ch of b.claims) {
    if (closure.versions[chainKey(ch.speaker, ch.slot)] !== ch.versions.length - 1) return null; // a lie cannot be cracked
  }
  if (!fallback) {
    const families: Family[] = ["opportunity", "means", "motive"];
    const cleared: Record<Family, CharId[]> = { opportunity: [], means: [], motive: [] };
    for (const f of families) {
      const alive = survivingKillers(closure.kb, [f], P.strict);
      cleared[f] = plan.suspects.filter((s) => !alive.includes(s));
    }
    for (const x of plan.suspects) {
      if (x === plan.killer) continue;
      const grounds = families.filter((f) => cleared[f].includes(x)).length;
      if (grounds < P.minGrounds) return null;
    }
    const oppSurvivors = plan.suspects.length - cleared.opportunity.length;
    if (oppSurvivors < P.minOppSurvivors) return null;
    if (plan.suspects.length - cleared.means.length < P.minMeansSurvivors) return null;
  }
  return b;
}
