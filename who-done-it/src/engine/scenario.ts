// Scenario validation. See docs/case-engine.md section 3.1.

import type { Scenario, WoundClass } from "./types";

const MAX_SUSPECTS = 6;

/** Returns a list of problems. An empty list means the scenario is valid. */
export function validateScenario(s: Scenario): string[] {
  const errs: string[] = [];
  const dup = (ids: string[], what: string): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errs.push(`duplicate ${what} id: ${id}`);
      seen.add(id);
    }
  };
  dup(s.rooms.map((r) => r.id), "room");
  dup(s.characters.map((c) => c.id), "character");
  dup(s.weapons.map((w) => w.id), "weapon");
  dup(s.motives.map((m) => m.id), "motive");

  const room = (id: string) => s.rooms.find((r) => r.id === id);
  const isChar = (id: string) => s.characters.some((c) => c.id === id);
  const checkSpot = (roomId: string, spot: string, where: string): void => {
    const r = room(roomId);
    if (!r) errs.push(`${where}: unknown room ${roomId}`);
    else if (!r.spots.includes(spot)) errs.push(`${where}: room ${roomId} has no spot ${spot}`);
  };

  if (!Number.isInteger(s.index) || s.index < 0 || s.index > 15) errs.push("index must be 0..15");
  if (s.slots.length < 4) errs.push("need at least 4 slots");
  s.slots.forEach((sl, i) => {
    if (sl.id !== i) errs.push(`slot ids must be 0..n-1 in order (slot ${i})`);
  });
  if (s.rooms.length < MAX_SUSPECTS + 3) errs.push(`need at least ${MAX_SUSPECTS + 3} rooms`);

  for (const r of s.rooms) {
    if (r.spots.length === 0) errs.push(`room ${r.id} has no spots`);
    dup(r.spots.map((sp) => `${r.id}/${sp}`), "spot");
    if (!r.spots.includes(r.proofSpot)) errs.push(`room ${r.id}: proofSpot is not one of its spots`);
    for (const a of r.adjacent) if (!room(a)) errs.push(`room ${r.id}: unknown adjacent room ${a}`);
  }
  for (const c of s.characters) {
    if (c.secret) checkSpot(c.secret.room, c.secret.evidenceSpot, `secret of ${c.id}`);
  }
  for (const w of s.weapons) {
    checkSpot(w.home, w.homeSpot, `weapon ${w.id}`);
    for (const a of w.access ?? []) if (!isChar(a)) errs.push(`weapon ${w.id}: unknown character ${a}`);
  }
  const classes: WoundClass[] = ["blunt", "blade", "ligature"];
  for (const cl of classes) {
    const n = s.weapons.filter((w) => w.class === cl).length;
    if (n === 1) errs.push(`wound class ${cl} has only one weapon`);
  }
  if (s.weapons.length < 2) errs.push("need at least 2 weapons");

  for (const b of s.bonds) {
    if (!isChar(b.from) || !isChar(b.to)) errs.push(`bond ${b.from}->${b.to}: unknown character`);
    if (b.from === b.to) errs.push(`bond ${b.from}->${b.to}: self bond`);
    if (!b.public) {
      if (!b.doc) errs.push(`bond ${b.from}->${b.to}: secret bond needs a doc`);
      else checkSpot(b.doc.room, b.doc.spot, `bond ${b.from}->${b.to}`);
    }
  }
  for (const m of s.motives) {
    if (!isChar(m.suspect) || !isChar(m.victim)) errs.push(`motive ${m.id}: unknown character`);
    if (m.suspect === m.victim) errs.push(`motive ${m.id}: suspect is the victim`);
    if (!s.victims.includes(m.victim)) errs.push(`motive ${m.id}: ${m.victim} is not an eligible victim`);
    checkSpot(m.doc.room, m.doc.spot, `motive ${m.id}`);
  }

  if (s.victims.length === 0) errs.push("no eligible victims");
  for (const v of s.victims) {
    if (!isChar(v)) {
      errs.push(`victim ${v}: unknown character`);
      continue;
    }
    if (s.characters.length - 1 < MAX_SUSPECTS) errs.push(`victim ${v}: fewer than ${MAX_SUSPECTS} other cast members`);
    const links = s.motives.filter((m) => m.victim === v);
    const suspects = new Set(links.map((m) => m.suspect));
    if (suspects.size < 4) errs.push(`victim ${v}: fewer than 4 suspects with a motive`);
    for (const sus of suspects) {
      const mine = links.filter((m) => m.suspect === sus);
      if (mine.length > 2) errs.push(`victim ${v}: ${sus} has more than 2 motive links`);
      if (new Set(mine.map((m) => m.type)).size !== mine.length) {
        errs.push(`victim ${v}: ${sus} has two motive links of the same type`);
      }
    }
  }
  // Enough people must have a secret errand and no bond is required for the easy level,
  // but medium needs at least one secret-keeper candidate in any cast.
  const withSecret = s.characters.filter((c) => c.secret).length;
  if (withSecret < s.characters.length - 1) errs.push("at most one character may lack a secret errand");
  return errs;
}
