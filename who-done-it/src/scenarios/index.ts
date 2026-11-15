// Scenario registry: facts (engine) plus display text (app) for each scenario, by index and id.
// NOTE: the build depends on ./blackthorn/text, which the content agent writes.

import type { Scenario } from "../engine/index";
import { blackthorn } from "./blackthorn/facts";
import { text as blackthornText } from "./blackthorn/text";

export type TextTable = Record<string, string | string[]>;
export interface ScenarioEntry {
  facts: Scenario;
  text: TextTable;
}

/** Every scenario the app ships, ordered by scenario index. */
export const scenarios: ScenarioEntry[] = [{ facts: blackthorn, text: blackthornText }];

/** The scenario with this case-code index, if any. */
export function scenarioByIndex(index: number): ScenarioEntry | undefined {
  return scenarios.find((s) => s.facts.index === index);
}

/** The scenario with this id (as stored in a Case), if any. */
export function scenarioById(id: string): ScenarioEntry | undefined {
  return scenarios.find((s) => s.facts.id === id);
}
