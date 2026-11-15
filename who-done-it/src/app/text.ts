// Text renderer: turns engine facts (ids) into sentences using a scenario's text table.
// Pure functions, no React. Every function tolerates missing keys and never throws.

import type { Case, Claim, CharId, Item, MotiveType, RoomId, WeaponId } from "../engine/index";
import type { ScenarioEntry, TextTable } from "../scenarios/index";

export type Vars = Record<string, string | number>;

/** Capitalise the first letter and turn dashes into spaces: "letter-opener" -> "Letter opener". */
function humanise(id: string): string {
  const s = id.replace(/[-_]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fill `{placeholder}`s from vars; unknown placeholders are left as written. */
function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
}

/** Readable fallback for a missing key. */
function fallbackFor(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1] ?? key;
  if ((last === "name" || last === "title") && parts.length >= 3) return humanise(parts[parts.length - 2]!);
  if (last === "inline" && parts.length >= 3) return humanise(parts[parts.length - 2]!).toLowerCase();
  return `[${key}]`;
}

/** Look up a key, pick a variant (variantSeed % length), fill placeholders. Never throws. */
export function t(text: TextTable, key: string, vars?: Vars, variantSeed = 0): string {
  try {
    const value = text[key];
    if (typeof value === "string") return fill(value, vars);
    if (Array.isArray(value) && value.length > 0) {
      const n = Number.isFinite(variantSeed) ? Math.abs(Math.trunc(variantSeed)) : 0;
      return fill(String(value[n % value.length]), vars);
    }
  } catch {
    // fall through to the fallback
  }
  return fill(fallbackFor(key), vars);
}

/** True if the table has a usable value for the key. */
function has(text: TextTable, key: string): boolean {
  const v = text[key];
  return typeof v === "string" || (Array.isArray(v) && v.length > 0);
}

/** Use the key if the table has it, otherwise the plain-English fallback template. */
function tOr(entry: ScenarioEntry, key: string, fallback: string, vars: Vars, seed = 0): string {
  return has(entry.text, key) ? t(entry.text, key, vars, seed) : fill(fallback, vars);
}

/** Display name of a character: char.<id>.name, else the capitalised id. */
export function charName(entry: ScenarioEntry, id: CharId): string {
  return tOr(entry, `char.${id}.name`, humanise(id), {});
}
/** Room name: room.<id>.name, else the capitalised id. */
export function roomName(entry: ScenarioEntry, id: RoomId): string {
  return tOr(entry, `room.${id}.name`, humanise(id), {});
}
/** Room inside a sentence ("the library"): room.<id>.inline, else "the " plus the lower-cased id. */
export function roomInline(entry: ScenarioEntry, id: RoomId): string {
  return tOr(entry, `room.${id}.inline`, `the ${humanise(id).toLowerCase()}`, {});
}
/** Spot name: room.<room>.spot.<spot>.name, else the capitalised spot id. */
export function spotName(entry: ScenarioEntry, room: RoomId, spot: string): string {
  return tOr(entry, `room.${room}.spot.${spot}.name`, humanise(spot), {});
}
/** Spot inside a sentence ("the fireplace"). */
export function spotInline(entry: ScenarioEntry, room: RoomId, spot: string): string {
  return tOr(entry, `room.${room}.spot.${spot}.inline`, `the ${humanise(spot).toLowerCase()}`, {});
}
/** Weapon name: weapon.<id>.name, else the capitalised id. */
export function weaponName(entry: ScenarioEntry, id: WeaponId): string {
  return tOr(entry, `weapon.${id}.name`, humanise(id), {});
}
/** Weapon inside a sentence ("the fire poker"). */
export function weaponInline(entry: ScenarioEntry, id: WeaponId): string {
  return tOr(entry, `weapon.${id}.inline`, `the ${humanise(id).toLowerCase()}`, {});
}
/** Slot label from the scenario facts, e.g. "9:30 pm". */
export function slotLabel(entry: ScenarioEntry, n: number): string {
  return entry.facts.slots.find((s) => s.id === n)?.label ?? String(n);
}
/** Slot inside a sentence ("half past nine"): slot.<n>.inline, else the facts label. */
export function slotInline(entry: ScenarioEntry, n: number): string {
  return tOr(entry, `slot.${n}.inline`, slotLabel(entry, n), {});
}
/** Motive type label for the accusation picker: motiveType.<type>, else the capitalised type. */
export function motiveLabel(entry: ScenarioEntry, type: MotiveType): string {
  return tOr(entry, `motiveType.${type}`, humanise(type), {});
}

/** "with X", "with X and Y", "with X, Y and Z", using the speaker's own forms of address; "alone" if empty. */
export function companyPhrase(entry: ScenarioEntry, speaker: CharId, withIds: readonly CharId[]): string {
  const names = withIds.map((o) => tOr(entry, `char.${speaker}.address.${o}`, charName(entry, o), {}));
  if (names.length === 0) return "alone";
  if (names.length === 1) return `with ${names[0]}`;
  return `with ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Small deterministic integer hash of (caseSeed, speaker, slot), used to pick text variants. */
export function variantHash(caseSeed: number, speaker: string, slot: number): number {
  let h = 2166136261 ^ (caseSeed >>> 0);
  const s = `${speaker}|${slot}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** A suspect's statement for a slot, in their own voice; deterministic for a given case seed. */
export function claimSentence(entry: ScenarioEntry, caseSeed: number, speaker: CharId, slot: number, claim: Claim): string {
  const alone = claim.with.length === 0;
  const vars: Vars = {
    room: roomInline(entry, claim.room),
    time: slotInline(entry, slot),
    company: companyPhrase(entry, speaker, claim.with),
  };
  const key = `char.${speaker}.claim.${alone ? "alone" : "with"}`;
  const fallback = alone ? "I was in {room} at {time}, alone." : "I was in {room} at {time}, {company}.";
  // A template may open with a placeholder ("{room}, {time}. Alone."), so capitalise the result.
  const out = tOr(entry, key, fallback, vars, variantHash(caseSeed, speaker, slot));
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Short title for an item card. */
export function itemTitle(entry: ScenarioEntry, item: Item): string {
  switch (item.kind) {
    case "wound":
      return "The wound";
    case "tod":
      return "Time of death";
    case "weaponInPlace":
    case "weaponMissing":
    case "weaponFound":
      return weaponName(entry, item.weapon);
    case "motiveDoc":
      return tOr(entry, `motive.${item.link}.title`, "A private document", {});
    case "bondDoc": {
      const p = item.pairs[0];
      return p ? tOr(entry, `bond.${p.from}-${p.to}.title`, "A private letter", {}) : "A private letter";
    }
    case "presence":
      return "A record";
    case "secretTrace":
      return "A trace";
  }
  return "Evidence";
}

/** Full text of an item, with fallbacks that state only what the item itself says. */
export function itemText(entry: ScenarioEntry, cs: Case, item: Item): string {
  const e = entry;
  switch (item.kind) {
    case "wound":
      return tOr(e, `body.wound.${item.class}`, `The wound was made by a ${item.class === "ligature" ? "ligature" : item.class === "blade" ? "blade" : "blunt object"}.`, {});
    case "tod":
      return item.from === item.to
        ? tOr(e, "body.tod.exact", "Death occurred at {time}.", { time: slotInline(e, item.from) })
        : tOr(e, "body.tod.window", "Death occurred between {from} and {to}.", { from: slotInline(e, item.from), to: slotInline(e, item.to) });
    case "weaponInPlace":
      return tOr(e, `weapon.${item.weapon}.inPlace`, "{weapon} is in its place at {spot}.", {
        weapon: weaponName(e, item.weapon), spot: spotInline(e, item.room, item.spot),
      });
    case "weaponMissing":
      return tOr(e, `weapon.${item.weapon}.missing`, "{weapon} is missing from {spot}.", {
        weapon: weaponName(e, item.weapon), spot: spotInline(e, item.room, item.spot),
      });
    case "weaponFound":
      return tOr(e, `weapon.${item.weapon}.${item.used ? "foundUsed" : "foundClean"}`, item.used ? "{weapon} was found in {room}, at {spot}. It was used." : "{weapon} was found in {room}, at {spot}. It is clean.", {
        weapon: weaponName(e, item.weapon), room: roomInline(e, item.room), spot: spotInline(e, item.room, item.spot),
      });
    case "motiveDoc": {
      const link = e.facts.motives.find((m) => m.id === item.link);
      const vars: Vars = link
        ? { name: charName(e, link.suspect), victim: charName(e, link.victim), motive: motiveLabel(e, link.type).toLowerCase() }
        : { name: "Someone", victim: charName(e, cs.victim), motive: "a motive" };
      return tOr(e, `motive.${item.link}.text`, "A document suggests {name} had a motive ({motive}) against {victim}.", vars);
    }
    case "bondDoc":
      return item.pairs
        .map((p) => tOr(e, `bond.${p.from}-${p.to}.text`, "A document shows {from} would protect {to}.", { from: charName(e, p.from), to: charName(e, p.to) }))
        .join(" ") || "A private letter.";
    case "presence": {
      const name = charName(e, item.who);
      const time = slotInline(e, item.slot);
      return tOr(e, `room.${item.at}.proof`, "A record shows {name} was in {room} at {time}.", { name, time, room: roomInline(e, item.at) });
    }
    case "secretTrace":
      return tOr(e, `secret.${item.who}.trace`, "A trace shows {name} had been here on a private errand.", { name: charName(e, item.who) });
  }
  return "Evidence.";
}
