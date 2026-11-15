// Pass-and-play party mode: a deck of clue cards and the voting rules.
// docs/case-engine.md section 13, docs/game-design.md section 9.2.

import { chainKey } from "./kb";
import { todWindow } from "./solver";
import { buildKB } from "./kb";
import type { Case, CharId, EvidenceRef, Scenario } from "./types";

export type CardKind = "scene" | "papers" | "statements" | "objects" | "crack";

export interface Card {
  kind: CardKind;
  /** Item ids this card reveals. */
  items: string[];
  /** Claims this card reveals (for a crack card: the new claim). */
  claims: { speaker: CharId; slot: number; version: number }[];
  /** For a crack card: the evidence that broke the previous claim. */
  brokenBy?: EvidenceRef;
}

export const MAX_ROUNDS = 8;

/**
 * The deck for a case, in a fixed order: the scene, the papers (motives and bonds),
 * statements, objects (weapons and records), then one card per lie that cracks.
 * After the last card everything is on the table, so the case is uniquely solvable.
 * Earlier rounds are for arguing and voting; they are not guaranteed solvable.
 */
export function buildDeck(scenario: Scenario, cs: Case): Card[] {
  const { kb } = buildKB(scenario, cs);
  const window = todWindow(kb);
  const slots = scenario.slots.map((s) => s.id);
  const v0 = (slotList: number[]) =>
    cs.claims.filter((c) => slotList.includes(c.slot)).map((c) => ({ speaker: c.speaker, slot: c.slot, version: 0 }));
  const ids = (kinds: string[]) => cs.items.filter((i) => kinds.includes(i.kind)).map((i) => i.id);

  const scene: Card = { kind: "scene", items: ids(["wound", "tod"]), claims: [] };
  const papers: Card = { kind: "papers", items: ids(["motiveDoc", "bondDoc"]), claims: [] };
  const objects: Card = { kind: "objects", items: ids(["weaponInPlace", "weaponMissing", "weaponFound", "presence", "secretTrace"]), claims: [] };
  const statements: Card[] = [
    { kind: "statements", items: [], claims: v0(slots.filter((t) => !window.includes(t))) },
    ...window.map((t): Card => ({ kind: "statements", items: [], claims: v0([t]) })),
  ];

  // Crack cards: replay the closure one withdrawal at a time, in claim order.
  const version: Record<string, number> = {};
  for (const ch of cs.claims) version[chainKey(ch.speaker, ch.slot)] = 0;
  const held = (r: EvidenceRef): boolean => r.kind === "item" || version[chainKey(r.speaker, r.slot)] === r.version;
  const cracks: Card[] = [];
  for (let progress = true; progress; ) {
    progress = false;
    for (const ch of cs.claims) {
      const key = chainKey(ch.speaker, ch.slot);
      const v = version[key]!;
      if (v >= ch.versions.length - 1) continue;
      const by = ch.versions[v]!.refutedBy.find(held);
      if (!by) continue;
      version[key] = v + 1;
      cracks.push({ kind: "crack", items: [], claims: [{ speaker: ch.speaker, slot: ch.slot, version: v + 1 }], brokenBy: by });
      progress = true;
      break; // one withdrawal per card; restart the scan so order is stable
    }
  }

  // Keep the deck to MAX_ROUNDS by merging statement cards from the front.
  const fixed = 3 + cracks.length;
  while (fixed + statements.length > MAX_ROUNDS && statements.length > 1) {
    const [a, b, ...rest] = statements;
    statements.splice(0, statements.length, { kind: "statements", items: [], claims: [...a!.claims, ...b!.claims] }, ...rest);
  }
  const [early, ...late] = statements;
  return [scene, papers, early!, objects, ...late, ...cracks];
}

// ---------------------------------------------------------------- voting

export interface PartyRound {
  code: string;
  rounds: number;
  /** Index of the card currently on the table. */
  round: number;
  /** votes[round][player]: the suspect voted for, or null if not yet voted. */
  votes: (CharId | null)[][];
}
export interface PartyState {
  players: string[];
  totals: number[];
  current: PartyRound | null;
  /** Points each player earned in each finished case, oldest first. */
  history: { code: string; points: number[] }[];
}
export type PartyAction =
  | { type: "addPlayer"; name: string }
  | { type: "removePlayer"; player: number }
  | { type: "startCase"; code: string; rounds: number }
  | { type: "vote"; player: number; suspect: CharId }
  | { type: "nextRound" }
  | { type: "endCase"; killer: CharId }
  | { type: "abandonCase" };

export const MAX_PLAYERS = 8;

export function initialParty(): PartyState {
  return { players: [], totals: [], current: null, history: [] };
}

/**
 * Points for one player in one case. `votes` has one entry per round. The player scores for the
 * first round from which they voted for the killer and never changed away:
 * 100 * (rounds - thatRound) / rounds, rounded, counting rounds from 0. Never settling scores 0.
 */
export function partyPoints(votes: readonly (CharId | null)[], killer: CharId): number {
  const rounds = votes.length;
  let lock = rounds;
  for (let r = rounds - 1; r >= 0 && votes[r] === killer; r--) lock = r;
  return lock === rounds ? 0 : Math.round((100 * (rounds - lock)) / rounds);
}

export function allVoted(state: PartyState): boolean {
  const c = state.current;
  return !!c && c.votes[c.round]!.every((v) => v !== null);
}

/** Pure. An action that is not allowed returns the same state object. */
export function partyReduce(state: PartyState, action: PartyAction): PartyState {
  const c = state.current;
  switch (action.type) {
    case "addPlayer": {
      const name = action.name.trim();
      if (c || !name || state.players.length >= MAX_PLAYERS || state.players.includes(name)) return state;
      return { ...state, players: [...state.players, name], totals: [...state.totals, 0], history: state.history.map((h) => ({ ...h, points: [...h.points, 0] })) };
    }
    case "removePlayer": {
      if (c || action.player < 0 || action.player >= state.players.length) return state;
      const drop = <T,>(list: T[]): T[] => list.filter((_, i) => i !== action.player);
      return { ...state, players: drop(state.players), totals: drop(state.totals), history: state.history.map((h) => ({ ...h, points: drop(h.points) })) };
    }
    case "startCase": {
      if (c || state.players.length < 2 || !Number.isInteger(action.rounds) || action.rounds < 1) return state;
      const votes = Array.from({ length: action.rounds }, () => state.players.map((): CharId | null => null));
      return { ...state, current: { code: action.code, rounds: action.rounds, round: 0, votes } };
    }
    case "vote": {
      if (!c || action.player < 0 || action.player >= state.players.length) return state;
      const votes = c.votes.map((row, r) => (r === c.round ? row.map((v, p) => (p === action.player ? action.suspect : v)) : row));
      return { ...state, current: { ...c, votes } };
    }
    case "nextRound": {
      if (!c || !allVoted(state) || c.round >= c.rounds - 1) return state;
      return { ...state, current: { ...c, round: c.round + 1 } };
    }
    case "endCase": {
      if (!c || !allVoted(state) || c.round !== c.rounds - 1) return state;
      const points = state.players.map((_, p) => partyPoints(c.votes.map((row) => row[p]!), action.killer));
      return { ...state, current: null, totals: state.totals.map((t, p) => t + points[p]!), history: [...state.history, { code: c.code, points }] };
    }
    case "abandonCase":
      return c ? { ...state, current: null } : state;
  }
}

/** The killer, for the reveal. Null until every player has voted in the last round. */
export function partyReveal(cs: Case, state: PartyState): CharId | null {
  const c = state.current;
  return c && c.round === c.rounds - 1 && allVoted(state) ? cs.solution.killer : null;
}

/** How many players voted for each suspect in a finished round (shown without names). */
export function voteTally(state: PartyState, round: number): Record<CharId, number> {
  const out: Record<CharId, number> = {};
  for (const v of state.current?.votes[round] ?? []) if (v !== null) out[v] = (out[v] ?? 0) + 1;
  return out;
}
