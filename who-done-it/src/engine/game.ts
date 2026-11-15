// The rules of play as a pure reducer. docs/case-engine.md section 9.
// A session is a case plus a list of actions; state is that list folded through `reduce`.
// Nothing here reads a clock or a random number.

import { chainKey, findChain, refKey } from "./kb";
import type { Case, CharId, Claim, EvidenceRef, Item, MotiveType, RoomId, Solution, Truth, WeaponId } from "./types";

export type Tag = "none" | "suspect" | "cleared";

export type Action = { at: number } & (
  | { type: "examineBody" }
  | { type: "search"; room: RoomId; spot: string }
  | { type: "ask"; suspect: CharId; slot: number }
  | { type: "press"; suspect: CharId; slot: number; evidence: EvidenceRef }
  | {
      type: "accuse";
      who: CharId;
      weapon: WeaponId;
      room: RoomId;
      motive: MotiveType;
      support: { who: EvidenceRef; what: EvidenceRef; why: EvidenceRef };
    }
  | { type: "pin"; ref: EvidenceRef; on: boolean }
  | { type: "tag"; suspect: CharId; tag: Tag }
  | { type: "giveUp" }
);

export type LastResult =
  | null
  | { kind: "cracked"; suspect: CharId; slot: number }
  | { kind: "stoodFirm"; suspect: CharId; slot: number }
  | { kind: "wrong"; wrongCount: number }
  | { kind: "weakProof" }
  | { kind: "solved" };

export interface GameState {
  bodyExamined: boolean;
  searched: string[]; // "room/spot", in order
  /** Revealed version index for each chain the player has asked about. */
  versions: Record<string, number>;
  items: string[]; // item ids held, in the order found
  questions: number;
  failedPresses: number;
  wrongAccusations: number;
  weakAccusations: number;
  solved: boolean;
  gaveUp: boolean;
  lastResult: LastResult;
  pins: string[]; // refKey values
  tags: Record<CharId, Tag>;
  elapsedMs: number;
}

export function initialState(): GameState {
  return {
    bodyExamined: false, searched: [], versions: {}, items: [], questions: 0, failedPresses: 0,
    wrongAccusations: 0, weakAccusations: 0, solved: false, gaveUp: false, lastResult: null,
    pins: [], tags: {}, elapsedMs: 0,
  };
}

/** True if the player currently holds this evidence. A withdrawn claim version is not held. */
export function holds(state: GameState, ref: EvidenceRef): boolean {
  if (ref.kind === "item") return state.items.includes(ref.id);
  return state.versions[chainKey(ref.speaker, ref.slot)] === ref.version;
}

function sameRef(a: EvidenceRef, b: EvidenceRef): boolean {
  return refKey(a) === refKey(b);
}

function addItems(state: GameState, found: Item[]): string[] {
  const out = state.items.slice();
  for (const it of found) if (!out.includes(it.id)) out.push(it.id);
  return out;
}

/** Evidence that validly supports each part of a correct accusation. */
export function validSupport(cs: Case): { who: EvidenceRef[]; what: EvidenceRef[]; why: EvidenceRef[] } {
  const s = cs.solution;
  const who: EvidenceRef[] = [];
  const chain = findChain(cs, s.killer, s.slot);
  for (const v of chain?.versions ?? []) for (const r of v.refutedBy) if (!who.some((x) => sameRef(x, r))) who.push(r);
  for (const it of cs.items) {
    if (it.kind === "presence" && it.who === s.killer && it.at === s.room && it.slot === s.slot) who.push({ kind: "item", id: it.id });
  }
  const used = cs.items.filter((it) => it.kind === "weaponFound" && it.used && it.weapon === s.weapon);
  const missing = cs.items.filter((it) => it.kind === "weaponMissing" && it.weapon === s.weapon);
  const what: EvidenceRef[] = (used.length > 0 ? used : missing).map((it) => ({ kind: "item", id: it.id }));
  if (what.length === 0) what.push({ kind: "item", id: "wound" });
  const why: EvidenceRef[] = cs.items
    .filter((it) => it.kind === "motiveDoc" && it.link.startsWith(`${s.killer}-${cs.victim}-`) && it.link.endsWith(`-${s.motive}`))
    .map((it) => ({ kind: "item", id: it.id }));
  return { who, what, why };
}

/** Pure. An action that is not allowed returns the same state object. */
export function reduce(cs: Case, state: GameState, action: Action): GameState {
  const at = Math.max(state.elapsedMs, action.at);
  const over = state.solved || state.gaveUp;

  switch (action.type) {
    case "pin": {
      const key = refKey(action.ref);
      const has = state.pins.includes(key);
      if (action.on === has) return state;
      if (action.on && !holds(state, action.ref)) return state;
      return { ...state, pins: action.on ? [...state.pins, key] : state.pins.filter((k) => k !== key) };
    }
    case "tag": {
      if (!cs.suspects.includes(action.suspect)) return state;
      return { ...state, tags: { ...state.tags, [action.suspect]: action.tag } };
    }
  }
  if (over) return state;

  switch (action.type) {
    case "examineBody": {
      if (state.bodyExamined) return state;
      const found = cs.items.filter((it) => it.kind === "wound" || it.kind === "tod");
      return { ...state, bodyExamined: true, items: addItems(state, found), elapsedMs: at, lastResult: null };
    }
    case "search": {
      const key = `${action.room}/${action.spot}`;
      if (state.searched.includes(key)) return state;
      const found = cs.items.filter((it) => "room" in it && it.room === action.room && it.spot === action.spot);
      return { ...state, searched: [...state.searched, key], items: addItems(state, found), elapsedMs: at, lastResult: null };
    }
    case "ask": {
      const key = chainKey(action.suspect, action.slot);
      if (!findChain(cs, action.suspect, action.slot) || state.versions[key] !== undefined) return state;
      return { ...state, versions: { ...state.versions, [key]: 0 }, questions: state.questions + 1, elapsedMs: at, lastResult: null };
    }
    case "press": {
      const key = chainKey(action.suspect, action.slot);
      const chain = findChain(cs, action.suspect, action.slot);
      const v = state.versions[key];
      if (!chain || v === undefined || !holds(state, action.evidence)) return state;
      if (action.evidence.kind === "claim" && chainKey(action.evidence.speaker, action.evidence.slot) === key) return state;
      const current = chain.versions[v]!;
      const cracks = v < chain.versions.length - 1 && current.refutedBy.some((r) => sameRef(r, action.evidence));
      if (!cracks) {
        return { ...state, failedPresses: state.failedPresses + 1, elapsedMs: at, lastResult: { kind: "stoodFirm", suspect: action.suspect, slot: action.slot } };
      }
      return { ...state, versions: { ...state.versions, [key]: v + 1 }, elapsedMs: at, lastResult: { kind: "cracked", suspect: action.suspect, slot: action.slot } };
    }
    case "accuse": {
      const s = cs.solution;
      const wrongCount =
        (action.who === s.killer ? 0 : 1) + (action.weapon === s.weapon ? 0 : 1) + (action.room === s.room ? 0 : 1) + (action.motive === s.motive ? 0 : 1);
      if (wrongCount > 0) {
        return { ...state, wrongAccusations: state.wrongAccusations + 1, elapsedMs: at, lastResult: { kind: "wrong", wrongCount } };
      }
      const valid = validSupport(cs);
      const ok = (ref: EvidenceRef, list: EvidenceRef[]): boolean => holds(state, ref) && list.some((r) => sameRef(r, ref));
      if (ok(action.support.who, valid.who) && ok(action.support.what, valid.what) && ok(action.support.why, valid.why)) {
        return { ...state, solved: true, elapsedMs: at, lastResult: { kind: "solved" } };
      }
      return { ...state, weakAccusations: state.weakAccusations + 1, elapsedMs: at, lastResult: { kind: "weakProof" } };
    }
    case "giveUp":
      return { ...state, gaveUp: true, elapsedMs: at, lastResult: null };
  }
  return state;
}

export function replay(cs: Case, actions: readonly Action[]): GameState {
  let s = initialState();
  for (const a of actions) s = reduce(cs, s, a);
  return s;
}

export interface StatementView {
  speaker: CharId;
  slot: number;
  /** Versions revealed so far, oldest first. The last is the current statement; earlier ones were withdrawn. */
  versions: Claim[];
}
export interface GameView {
  victim: CharId;
  suspects: CharId[];
  bodyRoom: RoomId;
  statements: StatementView[];
  items: Item[];
  parQuestions: number;
}

/** Everything the UI may show during play. It contains no hidden facts. */
export function view(cs: Case, state: GameState): GameView {
  const statements: StatementView[] = [];
  for (const ch of cs.claims) {
    const v = state.versions[chainKey(ch.speaker, ch.slot)];
    if (v === undefined) continue;
    statements.push({ speaker: ch.speaker, slot: ch.slot, versions: ch.versions.slice(0, v + 1).map((x) => x.claim) });
  }
  const items = state.items.map((id) => cs.items.find((it) => it.id === id)!).filter(Boolean);
  return { victim: cs.victim, suspects: cs.suspects, bodyRoom: cs.body.room, statements, items, parQuestions: cs.par.questions };
}

/** The hidden truth, available only once the case is over. */
export function reveal(cs: Case, state: GameState): { solution: Solution; truth: Truth } | null {
  return state.solved || state.gaveUp ? { solution: cs.solution, truth: cs.truth } : null;
}
