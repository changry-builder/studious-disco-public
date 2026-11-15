// The solver: proves which (killer, weapon, motive) combinations fit what the player can know.
// Spec: docs/case-engine.md section 5. Every rule here mirrors a rule shown to the player.
// Do not loosen a check to make a case pass. Fix the generator or the difficulty table instead.

import type { CharId, Claim, Family, Fit, KB, MotiveType, Weapon } from "./types";

type Cfg =
  | { kind: "none" }
  | { kind: "shield"; y: CharId } // y falsely vouches for the killer at the murder slot
  | { kind: "secretOpen"; y: CharId; ts: number } // y's "alone" claim at ts is an uncracked lie
  | { kind: "cracked"; y: CharId }; // y has withdrawn a claim; all y's current claims are true

export interface Hypothesis {
  killer: CharId;
  slot: number;
  cfg: Cfg;
}

export interface SolveOptions {
  /** Constraint families to apply. Default: all three. */
  families?: readonly Family[];
  /** Pretend nobody has withdrawn a claim (current claims are still used). */
  ignoreAdmissions?: boolean;
}

export interface SolveResult {
  unique: boolean;
  fits: Fit[];
  /** Every (killer, slot) pair with at least one fitting weapon and motive. */
  survivors: { killer: CharId; slot: number }[];
}

/** Slots the murder may have happened in, from the time-of-death item if known. */
export function todWindow(kb: KB): number[] {
  const tod = kb.items.find((i) => i.kind === "tod");
  const from = tod && tod.kind === "tod" ? tod.from : 1;
  const to = tod && tod.kind === "tod" ? tod.to : kb.slots - 2;
  const out: number[] = [];
  for (let t = from; t <= to; t++) out.push(t);
  return out;
}

function hasBond(kb: KB, from: CharId, to: CharId): boolean {
  return kb.bonds.some((b) => b.from === from && b.to === to);
}

function configs(kb: KB, x: CharId, tmh: number, admitted: ReadonlySet<CharId>): Cfg[] {
  const out: Cfg[] = [{ kind: "none" }];
  for (const y of kb.suspects) {
    if (y === x) continue;
    if (admitted.has(y)) {
      out.push({ kind: "cracked", y });
      continue;
    }
    const atMurder = kb.current[y]?.[tmh];
    if (atMurder && atMurder.with.includes(x) && hasBond(kb, y, x)) out.push({ kind: "shield", y });
    for (let ts = 0; ts < kb.slots; ts++) {
      const c = kb.current[y]?.[ts];
      if (c && c.with.length === 0) out.push({ kind: "secretOpen", y, ts });
    }
  }
  return out;
}

function validAdmissions(kb: KB, h: Hypothesis, admitted: ReadonlySet<CharId>): boolean {
  for (const a of admitted) {
    if (a === h.killer) continue;
    if (h.cfg.kind === "cracked" && h.cfg.y === a) continue;
    return false;
  }
  // The killer lies about the murder slot only, so that is the only slot they can have withdrawn.
  for (const w of kb.withdrawn) {
    if (w.who === h.killer && w.slot !== h.slot) return false;
  }
  return true;
}

export function timelineConsistent(kb: KB, h: Hypothesis): boolean {
  const { killer: x, slot: tmh, cfg } = h;
  const rm = kb.bodyRoom;

  const trusted = (c: CharId, t: number): boolean => {
    if (c === x && t === tmh) return false;
    if (cfg.kind === "secretOpen" && c === cfg.y && t === cfg.ts) return false;
    return true;
  };
  const claimOf = (c: CharId, t: number): Claim | undefined => {
    const raw = kb.current[c]?.[t];
    if (!raw) return undefined;
    if (cfg.kind === "shield" && c === cfg.y && t === tmh) {
      return { room: raw.room, with: raw.with.filter((d) => d !== x) };
    }
    return raw;
  };

  for (let t = 0; t < kb.slots; t++) {
    let victimRoom: string | undefined;
    let qRoom: string | undefined; // true room of the open secret-keeper at this slot

    for (const c of kb.suspects) {
      if (!trusted(c, t)) continue;
      const cl = claimOf(c, t);
      if (!cl) continue;
      const R = cl.room;
      // A truthful person in the murder room at or after the murder is a witness (M1)
      // or would have found the body (M2).
      if (R === rm && t >= tmh) return false;
      for (const d of cl.with) {
        if (d === kb.victim) {
          if (t >= tmh) return false; // the victim is in the murder room at tmh and dead after
          if (victimRoom !== undefined && victimRoom !== R) return false;
          victimRoom = R;
        } else if (d === x && t === tmh) {
          return false; // the killer was in the murder room
        } else if (trusted(d, t)) {
          const dc = claimOf(d, t);
          if (dc && dc.room !== R) return false;
        } else {
          if (qRoom !== undefined && qRoom !== R) return false;
          qRoom = R;
        }
      }
      for (const d of kb.suspects) {
        if (d === c || cl.with.includes(d) || !trusted(d, t)) continue;
        const dc = claimOf(d, t);
        if (dc && dc.room === R) return false; // c would have listed d
      }
    }

    for (const it of kb.items) {
      if (it.kind !== "presence" || it.slot !== t) continue;
      if (it.who === x && t === tmh) {
        if (it.at !== rm) return false;
      } else if (it.at === rm && t >= tmh) {
        return false; // only killer and victim at tmh (M1, L7); nobody after (M2)
      } else if (trusted(it.who, t)) {
        const c = claimOf(it.who, t);
        if (c && c.room !== it.at) return false;
      } else {
        if (qRoom !== undefined && qRoom !== it.at) return false;
        qRoom = it.at;
      }
    }

    if (cfg.kind === "secretOpen" && cfg.ts === t && qRoom === undefined) {
      // The secret-keeper must have been somewhere no truthful person was.
      const taken = new Set<string>();
      for (const c of kb.suspects) {
        if (!trusted(c, t)) continue;
        const cl = claimOf(c, t);
        if (cl) taken.add(cl.room);
      }
      const free = kb.rooms.some((r) => !taken.has(r) && !(r === rm && t >= tmh));
      if (!free) return false;
    }
  }
  return true;
}

export function weaponFits(kb: KB, w: Weapon): boolean {
  let usedWeapon: string | undefined;
  for (const it of kb.items) {
    if (it.kind === "wound" && it.class !== w.class) return false;
    if (it.kind === "weaponInPlace" && it.weapon === w.id) return false; // known clean
    if (it.kind === "weaponFound") {
      if (it.used) usedWeapon = it.weapon;
      else if (it.weapon === w.id) return false; // known clean
    }
  }
  return usedWeapon === undefined || usedWeapon === w.id;
}

export function meansOk(kb: KB, x: CharId, w: Weapon, tmh: number): boolean {
  if (w.access && !w.access.includes(x)) return false;
  if (w.home === kb.bodyRoom) return true; // grabbed at the scene
  for (let t = 0; t < tmh; t++) {
    const c = kb.current[x]?.[t];
    // A statement the player has not heard yet could be anything, so it cannot rule x out.
    if (!c) return true;
    if (c.room === w.home && c.with.length === 0) return true; // true: x lies only at tmh
  }
  return false;
}

export function evidencedMotives(kb: KB, x: CharId): MotiveType[] {
  const out: MotiveType[] = [];
  for (const it of kb.items) {
    if (it.kind !== "motiveDoc") continue;
    const link = kb.motiveLinks.find((l) => l.id === it.link);
    if (link && link.suspect === x && link.victim === kb.victim && !out.includes(link.type)) {
      out.push(link.type);
    }
  }
  return out;
}

const ALL_FAMILIES: readonly Family[] = ["opportunity", "means", "motive"];

export function solve(kb: KB, options: SolveOptions = {}): SolveResult {
  const fam = options.families ?? ALL_FAMILIES;
  const useOpp = fam.includes("opportunity");
  const useMeans = fam.includes("means");
  const useMotive = fam.includes("motive");

  const admitted = new Set<CharId>();
  if (useOpp && !options.ignoreAdmissions) for (const w of kb.withdrawn) admitted.add(w.who);

  const fits: Fit[] = [];
  const survivors: { killer: CharId; slot: number }[] = [];
  const window = todWindow(kb);

  for (const x of kb.suspects) {
    for (const tmh of window) {
      let timelineOk = !useOpp;
      if (useOpp) {
        for (const cfg of configs(kb, x, tmh, admitted)) {
          const h: Hypothesis = { killer: x, slot: tmh, cfg };
          if (!options.ignoreAdmissions && !validAdmissions(kb, h, admitted)) continue;
          if (timelineConsistent(kb, h)) {
            timelineOk = true;
            break;
          }
        }
      }
      if (!timelineOk) continue;
      // With the motive family off, every suspect is treated as having some motive.
      const motives: (MotiveType | "any")[] = useMotive ? evidencedMotives(kb, x) : ["any"];
      let any = false;
      for (const w of kb.weapons) {
        if (!weaponFits(kb, w)) continue;
        if (useMeans && !meansOk(kb, x, w, tmh)) continue;
        for (const m of motives) {
          any = true;
          const motive = m === "any" ? ("inheritance" as MotiveType) : m;
          if (!fits.some((f) => f.killer === x && f.weapon === w.id && f.motive === motive)) {
            fits.push({ killer: x, weapon: w.id, motive });
          }
        }
      }
      if (any) survivors.push({ killer: x, slot: tmh });
    }
  }
  return { unique: fits.length === 1, fits, survivors };
}

/** Suspects who survive when only the given families are applied. */
export function survivingKillers(kb: KB, families: readonly Family[], ignoreAdmissions = false): CharId[] {
  const r = solve(kb, { families, ignoreAdmissions });
  return kb.suspects.filter((s) => r.survivors.some((v) => v.killer === s));
}
