import { createContext, useContext } from "react";
import type { Case, Scenario } from "../engine/index";
import { scenarioById, scenarios, type ScenarioEntry } from "../scenarios/index";
import type { Snapshot, SoloView, Store } from "./store";

export interface Ctx {
  store: Store;
  snap: Snapshot;
}
export const GameContext = createContext<Ctx | null>(null);

export function useGame(): Ctx {
  const c = useContext(GameContext);
  if (!c) throw new Error("GameContext missing");
  return c;
}

export interface CaseCtx extends Ctx {
  solo: SoloView;
  cs: Case;
  entry: ScenarioEntry;
  facts: Scenario;
}

/** For case screens: the App only renders these when a solo session exists. */
export function useCase(): CaseCtx {
  const { store, snap } = useGame();
  const solo = snap.solo;
  if (!solo) throw new Error("No case in progress");
  const cs = solo.session.case;
  const entry = scenarioById(cs.scenarioId) ?? scenarios[0]!;
  return { store, snap, solo, cs, entry, facts: entry.facts };
}

/** Read a string or number nav param. */
export function param(snap: Snapshot, key: string): string | undefined {
  const v = snap.nav.params?.[key];
  return v === undefined ? undefined : String(v);
}
