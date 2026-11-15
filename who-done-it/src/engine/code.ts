// Case codes: 40 bits as 8 Crockford base-32 symbols plus a check symbol, shown XXXX-XXXXX.
// docs/case-engine.md section 10. Plain Number arithmetic only: the value exceeds 32 bits.

import { GEN_VERSION } from "./difficulty";
import { DIFFICULTIES, type Difficulty } from "./types";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SEED_SPAN = 536870912; // 2^29
export const MAX_SEED = SEED_SPAN - 1;

export interface CaseCodeParts {
  genVersion: number;
  scenario: number;
  difficulty: Difficulty;
  seed: number;
}
export type CodeError = "length" | "symbol" | "check" | "difficulty" | "version" | "scenario";
export type DecodeResult = { ok: true; parts: CaseCodeParts } | { ok: false; error: CodeError };

function checkSymbol(values: number[]): number {
  let sum = 0;
  values.forEach((v, i) => (sum += (i + 1) * v));
  return sum % 32;
}

export function encodeCaseCode(scenario: number, difficulty: Difficulty, seed: number, genVersion = GEN_VERSION): string {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) throw new Error(`seed out of range: ${seed}`);
  if (!Number.isInteger(scenario) || scenario < 0 || scenario > 15) throw new Error(`scenario out of range: ${scenario}`);
  if (!Number.isInteger(genVersion) || genVersion < 0 || genVersion > 31) throw new Error(`genVersion out of range: ${genVersion}`);
  let value = ((genVersion * 16 + scenario) * 4 + DIFFICULTIES.indexOf(difficulty)) * SEED_SPAN + seed;
  const values: number[] = new Array<number>(8).fill(0);
  for (let i = 7; i >= 0; i--) {
    values[i] = value % 32;
    value = Math.floor(value / 32);
  }
  const symbols = [...values, checkSymbol(values)].map((v) => ALPHABET[v]).join("");
  return `${symbols.slice(0, 4)}-${symbols.slice(4)}`;
}

/** `knownScenarios` lists the scenario indexes this app has. */
export function decodeCaseCode(text: string, knownScenarios: readonly number[], genVersion = GEN_VERSION): DecodeResult {
  const cleaned = text.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (cleaned.length !== 9) return { ok: false, error: "length" };
  const values: number[] = [];
  for (const ch of cleaned) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return { ok: false, error: "symbol" };
    values.push(v);
  }
  const data = values.slice(0, 8);
  if (checkSymbol(data) !== values[8]) return { ok: false, error: "check" };
  let value = 0;
  for (const v of data) value = value * 32 + v;
  const seed = value % SEED_SPAN;
  value = Math.floor(value / SEED_SPAN);
  const difficultyIndex = value % 4;
  value = Math.floor(value / 4);
  const scenario = value % 16;
  const version = Math.floor(value / 16);
  if (version !== genVersion) return { ok: false, error: "version" };
  if (!knownScenarios.includes(scenario)) return { ok: false, error: "scenario" };
  const difficulty = DIFFICULTIES[difficultyIndex];
  if (!difficulty) return { ok: false, error: "difficulty" };
  return { ok: true, parts: { genVersion: version, scenario, difficulty, seed } };
}
