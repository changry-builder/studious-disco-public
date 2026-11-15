// Session store: a case plus a list of actions, with the derived GameState kept alongside.
//
// API for screens (all on the object returned by createStore / getAppStore):
//   const snap = useStore(store)         React hook; snap changes identity only when something changed
//   snap.nav / snap.settings / snap.history / snap.timerRunning
//   snap.solo   null, or { session, state, view, score, reveal }   (view = engine view(); reveal is null until over)
//   snap.party  { state: PartyState, case, code, deck, lastEnded }
//   snap.lastFinished  result of the most recent finishSolo(), kept in memory only
//   store.navigate(screen, params?)      change screen (persisted)
//   store.newCase(difficulty, seed?)     start a new solo case (replaces any saved solo session)
//   store.openCode(text)                 start the case for a typed code; returns { ok } or { ok:false, error }
//   store.dispatch(action)               solo action WITHOUT `at`; returns true if the action changed state
//   store.startTimer() / stopTimer()     call from the case screen on show / hide (play time counts only while running)
//   store.getElapsedMs()                 live play time for a clock display
//   store.finishSolo()                   after solved or given up: write history, clear the save, return the result
//   store.discardSolo()                  throw the current solo session away
//   store.partyDispatch(action)          addPlayer / removePlayer / vote / nextRound / abandonCase (not startCase / endCase)
//   store.startPartyCase(difficulty, seed?)   generate a case and start it (needs 2+ players)
//   store.endPartyCase()                 reveal the killer and score the case; returns { killer, points } or null
//   store.updateSettings({ sound?, playerName? })
//   text helpers: use snap.solo.session.case with the scenario from scenarioById(case.scenarioId)

import { useSyncExternalStore } from "react";
import {
  buildDeck, decodeCaseCode, encodeCaseCode, generateCase, initialParty, initialState, MAX_SEED, partyReduce, partyReveal,
  reduce, replay, reveal, score, view,
  type Action, type Card, type Case, type CharId, type Difficulty, type CodeError, type GameState, type GameView, type PartyAction,
  type PartyState, type Rank, type ScoreBreakdown,
} from "../engine/index";
import { scenarioById, scenarioByIndex, scenarios } from "../scenarios/index";
import { memoryStore, localStorageStore, type SaveStore } from "./persistence";
import { LocalTransport, type SessionTransport } from "./transport";

// ---------------------------------------------------------------- types

export interface Session {
  id: string;
  mode: "solo" | "party";
  code: string;
  case: Case;
  actions: Action[];
  elapsedMs: number;
}
/** An engine Action without its `at`; the store stamps it from the play timer. */
type DistOmit<T> = T extends unknown ? Omit<T, "at"> : never;
export type ActionInput = DistOmit<Action>;
export interface Nav {
  screen: string;
  params?: Record<string, string | number>;
}
export interface Settings {
  sound: boolean;
  playerName: string;
}
export interface HistoryEntry {
  code: string;
  difficulty: Difficulty;
  solved: boolean;
  base: number;
  total: number;
  rank: Rank;
  finishedAt: number;
}
export interface SoloView {
  session: Session;
  state: GameState;
  view: GameView;
  score: ScoreBreakdown;
  /** Hidden truth; null until the case is solved or given up. */
  reveal: ReturnType<typeof reveal>;
}
export interface FinishedSolo {
  entry: HistoryEntry;
  breakdown: ScoreBreakdown;
  case: Case;
  reveal: ReturnType<typeof reveal>;
}
export interface PartyView {
  state: PartyState;
  case: Case | null;
  code: string | null;
  deck: Card[];
  lastEnded: { code: string; killer: CharId; points: number[] } | null;
}
export interface Snapshot {
  nav: Nav;
  settings: Settings;
  history: HistoryEntry[];
  solo: SoloView | null;
  party: PartyView;
  timerRunning: boolean;
  lastFinished: FinishedSolo | null;
}
export type OpenCodeResult = { ok: true; code: string } | { ok: false; error: CodeError };

export interface Store {
  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** The current immutable snapshot; same object until something changes. */
  getSnapshot(): Snapshot;
  /** Go to a screen and remember it. */
  navigate(screen: string, params?: Record<string, string | number>): void;
  /** Start a new solo case (replacing any saved one). */
  newCase(difficulty: Difficulty, seed?: number): void;
  /** Decode a case code and start that case, or return the engine's error and change nothing. */
  openCode(codeText: string): OpenCodeResult;
  /** Apply a solo action (no `at`); true if it changed the game. */
  dispatch(action: ActionInput): boolean;
  /** Start counting play time. */
  startTimer(): void;
  /** Stop counting play time and save it. */
  stopTimer(): void;
  /** Play time so far in ms, including the running stretch. */
  getElapsedMs(): number;
  /** Record a solved or abandoned case in history and clear the saved session. */
  finishSolo(): FinishedSolo | null;
  /** Drop the current solo session without recording it. */
  discardSolo(): void;
  /** Apply a party action (not startCase or endCase); true if it changed the party. */
  partyDispatch(action: PartyAction): boolean;
  /** Generate a case and start it for the party; true on success. */
  startPartyCase(difficulty: Difficulty, seed?: number): boolean;
  /** Reveal the killer and score the party case, once everyone has voted in the last round. */
  endPartyCase(): { killer: CharId; points: number[] } | null;
  /** Change settings. */
  updateSettings(patch: Partial<Settings>): void;
}

export interface StoreOptions {
  saveStore: SaveStore;
  transport?: SessionTransport;
  /** Monotonic millisecond clock for the play timer. Default: performance.now. */
  now?: () => number;
  /** Wall clock for history dates. Default: Date.now. */
  wallClock?: () => number;
}

// ---------------------------------------------------------------- helpers

const HISTORY_LIMIT = 50;
const DEFAULT_NAV: Nav = { screen: "home" };
const DEFAULT_SETTINGS: Settings = { sound: true, playerName: "" };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]! % (MAX_SEED + 1);
  } catch {
    return Math.floor(Math.random() * (MAX_SEED + 1));
  }
}
function randomId(): string {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function validCase(c: unknown): c is Case {
  return isObj(c) && typeof c.scenarioId === "string" && Array.isArray(c.claims) && Array.isArray(c.items) && Array.isArray(c.suspects) && isObj(c.solution) && typeof c.victim === "string";
}
function validSession(d: unknown): boolean {
  if (!isObj(d) || typeof d.id !== "string" || typeof d.code !== "string" || typeof d.elapsedMs !== "number" || !Array.isArray(d.actions) || !validCase(d.case)) return false;
  try {
    replay(d.case, d.actions as Action[]);
    return true;
  } catch {
    return false;
  }
}
function validParty(d: unknown): boolean {
  if (!isObj(d) || !isObj(d.state) || !Array.isArray(d.state.players) || !Array.isArray(d.state.totals) || !Array.isArray(d.state.history)) return false;
  if (d.state.current === null || d.state.current === undefined) return true;
  return validCase(d.case) && scenarioById(d.case.scenarioId) !== undefined && typeof d.code === "string";
}
const validNav = (d: unknown): boolean => isObj(d) && typeof d.screen === "string";
const validSettings = (d: unknown): boolean => isObj(d) && typeof d.sound === "boolean" && typeof d.playerName === "string";
const validHistory = (d: unknown): boolean => Array.isArray(d) && d.every((e) => isObj(e) && typeof e.code === "string" && typeof e.total === "number");

function soloView(session: Session, state: GameState): SoloView {
  return { session, state, view: view(session.case, state), score: score(session.case, state), reveal: reveal(session.case, state) };
}
function buildPartyDeck(cs: Case | null): Card[] {
  const entry = cs ? scenarioById(cs.scenarioId) : undefined;
  return cs && entry ? buildDeck(entry.facts, cs) : [];
}

// ---------------------------------------------------------------- store

/** Create a store over a SaveStore; loads any saved session, party, nav, settings and history. */
export function createStore(options: StoreOptions): Store {
  const { saveStore } = options;
  const transport: SessionTransport = options.transport ?? new LocalTransport();
  const now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const wallClock = options.wallClock ?? Date.now;

  // --- load
  const savedSession = saveStore.load<Session>("session:solo", validSession);
  const savedParty = saveStore.load<{ state: PartyState; case: Case | null; code: string | null }>("session:party", validParty);

  let session: Session | null = savedSession && savedSession.mode === "solo" ? savedSession : null;
  let state: GameState = session ? replay(session.case, session.actions) : initialState();
  let base = session?.elapsedMs ?? 0; // committed play time
  let startedAt: number | null = null; // timer anchor while running

  let partyState: PartyState = savedParty?.state ?? initialParty();
  let partyCase: Case | null = partyState.current ? (savedParty?.case ?? null) : null;
  let partyCode: string | null = partyState.current ? (savedParty?.code ?? partyState.current.code) : null;
  let deck: Card[] = buildPartyDeck(partyCase);
  let lastEnded: PartyView["lastEnded"] = null;

  let nav: Nav = saveStore.load<Nav>("nav", validNav) ?? DEFAULT_NAV;
  let settings: Settings = { ...DEFAULT_SETTINGS, ...(saveStore.load<Settings>("settings", validSettings) ?? {}) };
  let history: HistoryEntry[] = saveStore.load<HistoryEntry[]>("history", validHistory) ?? [];
  let lastFinished: FinishedSolo | null = null;

  const listeners = new Set<() => void>();
  let unsubRemote: (() => void) | null = null;

  const elapsed = (): number => base + (startedAt === null ? 0 : Math.max(0, now() - startedAt));
  /** Fold the running stretch into `base` so the saved elapsedMs is current. */
  const checkpoint = (): number => {
    const total = elapsed();
    base = total;
    if (startedAt !== null) startedAt = now();
    return total;
  };

  let soloSnap: SoloView | null = session ? soloView(session, state) : null;
  let snap: Snapshot = buildSnapshot();

  function partyView(): PartyView {
    return { state: partyState, case: partyCase, code: partyCode, deck, lastEnded };
  }
  function buildSnapshot(): Snapshot {
    return { nav, settings, history, solo: soloSnap, party: partyView(), timerRunning: startedAt !== null, lastFinished };
  }
  function emit(): void {
    snap = buildSnapshot();
    listeners.forEach((l) => l());
  }
  function saveSolo(): void {
    if (session) saveStore.save("session:solo", session);
    else saveStore.remove("session:solo");
  }
  function saveParty(): void {
    saveStore.save("session:party", { state: partyState, case: partyCase, code: partyCode });
  }
  function watchRemote(): void {
    unsubRemote?.();
    unsubRemote = null;
    if (!session) return;
    const id = session.id;
    unsubRemote = transport.subscribe(id, (a) => {
      if (session && session.id === id && "at" in a) apply(a as Action, false);
    });
  }
  /** Reduce one stamped action, append, save, publish, notify. */
  function apply(action: Action, publish: boolean): boolean {
    if (!session) return false;
    const next = reduce(session.case, state, action);
    if (next === state) return false;
    state = next;
    const total = checkpoint();
    if (state.solved || state.gaveUp) {
      startedAt = null;
    }
    session = { ...session, actions: [...session.actions, action], elapsedMs: total };
    soloSnap = soloView(session, state);
    saveSolo();
    if (publish) transport.publish(session.id, action);
    emit();
    return true;
  }
  function startSession(cs: Case, code: string): void {
    startedAt = null;
    base = 0;
    session = { id: randomId(), mode: "solo", code, case: cs, actions: [], elapsedMs: 0 };
    state = initialState();
    soloSnap = soloView(session, state);
    lastFinished = null;
    saveSolo();
    watchRemote();
    emit();
  }
  function makeCase(difficulty: Difficulty, seed: number): { cs: Case; code: string } {
    const entry = scenarios[0]!;
    return { cs: generateCase(entry.facts, seed, difficulty), code: encodeCaseCode(entry.facts.index, difficulty, seed) };
  }

  watchRemote();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot: () => snap,

    navigate(screen, params) {
      nav = params ? { screen, params } : { screen };
      saveStore.save("nav", nav);
      emit();
    },

    newCase(difficulty, seed) {
      const { cs, code } = makeCase(difficulty, seed ?? randomSeed());
      startSession(cs, code);
    },

    openCode(codeText) {
      const decoded = decodeCaseCode(codeText, scenarios.map((s) => s.facts.index));
      if (!decoded.ok) return { ok: false, error: decoded.error };
      const { scenario, difficulty, seed } = decoded.parts;
      const entry = scenarioByIndex(scenario)!;
      startSession(generateCase(entry.facts, seed, difficulty), encodeCaseCode(scenario, difficulty, seed));
      return { ok: true, code: session!.code };
    },

    dispatch(input) {
      if (!session) return false;
      return apply({ ...input, at: elapsed() } as Action, true);
    },

    startTimer() {
      if (startedAt !== null || !session || state.solved || state.gaveUp) return;
      startedAt = now();
      emit();
    },
    stopTimer() {
      if (startedAt === null) return;
      const total = checkpoint();
      startedAt = null;
      if (session) {
        session = { ...session, elapsedMs: total };
        soloSnap = soloView(session, state);
        saveSolo();
      }
      emit();
    },
    getElapsedMs: elapsed,

    finishSolo() {
      if (!session || !(state.solved || state.gaveUp)) return null;
      const breakdown = score(session.case, state);
      const entry: HistoryEntry = {
        code: session.code, difficulty: session.case.difficulty, solved: state.solved, base: breakdown.base,
        total: breakdown.total, rank: breakdown.rank, finishedAt: wallClock(),
      };
      history = [...history, entry].slice(-HISTORY_LIMIT);
      saveStore.save("history", history);
      lastFinished = { entry, breakdown, case: session.case, reveal: reveal(session.case, state) };
      session = null;
      soloSnap = null;
      state = initialState();
      base = 0;
      startedAt = null;
      saveSolo();
      watchRemote();
      emit();
      return lastFinished;
    },
    discardSolo() {
      session = null;
      soloSnap = null;
      state = initialState();
      base = 0;
      startedAt = null;
      saveSolo();
      watchRemote();
      emit();
    },

    partyDispatch(action) {
      if (action.type === "startCase" || action.type === "endCase") return false;
      const next = partyReduce(partyState, action);
      if (next === partyState) return false;
      partyState = next;
      if (!partyState.current) {
        partyCase = null;
        partyCode = null;
        deck = [];
      }
      saveParty();
      transport.publish("party", action);
      emit();
      return true;
    },
    startPartyCase(difficulty, seed) {
      if (partyState.current) return false;
      const { cs, code } = makeCase(difficulty, seed ?? randomSeed());
      const newDeck = buildDeck(scenarios[0]!.facts, cs);
      const action: PartyAction = { type: "startCase", code, rounds: newDeck.length };
      const next = partyReduce(partyState, action);
      if (next === partyState) return false;
      partyState = next;
      partyCase = cs;
      partyCode = code;
      deck = newDeck;
      lastEnded = null;
      saveParty();
      transport.publish("party", action);
      emit();
      return true;
    },
    endPartyCase() {
      if (!partyCase) return null;
      const killer = partyReveal(partyCase, partyState);
      if (killer === null) return null;
      const action: PartyAction = { type: "endCase", killer };
      const next = partyReduce(partyState, action);
      if (next === partyState) return null;
      const code = partyCode ?? "";
      const points = next.history[next.history.length - 1]!.points;
      partyState = next;
      partyCase = null;
      partyCode = null;
      deck = [];
      lastEnded = { code, killer, points };
      saveParty();
      transport.publish("party", action);
      emit();
      return { killer, points };
    },

    updateSettings(patch) {
      settings = { ...settings, ...patch };
      saveStore.save("settings", settings);
      emit();
    },
  };
}

let appStore: Store | null = null;
/** The app-wide store over localStorage, created on first use. */
export function getAppStore(): Store {
  appStore ??= createStore({ saveStore: localStorageStore() });
  return appStore;
}
/** A store over memory, for tests and previews. */
export function createMemoryStore(now?: () => number): Store {
  return createStore({ saveStore: memoryStore(), now });
}

/** React hook: the store's snapshot, re-rendering when it changes. */
export function useStore(store: Store): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
