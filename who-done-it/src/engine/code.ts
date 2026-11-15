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

// ---------------------------------------------------------------- result codes
// A result code is the case code plus 8 more symbols: 35 bits of result and a check symbol
// that also covers the case code, shown XXXX-XXXXX-XXXX-XXXX. docs/case-engine.md section 10.1.

export interface ResultParts {
  solved: boolean;
  /** Score before the difficulty multiplier, 0..1000. */
  base: number;
  /** Whole minutes played, capped at 127. */
  minutes: number;
  questions: number; // capped at 63
  wrongAccusations: number; // capped at 15
  failedPresses: number; // capped at 15
}
export type ResultDecode =
  | { ok: true; caseCode: string; parts: CaseCodeParts; result: ResultParts }
  | { ok: false; error: CodeError };

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(n)));
}

function symbolValues(text: string): number[] | null {
  const out: number[] = [];
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    out.push(v);
  }
  return out;
}

export function encodeResultCode(caseCode: string, r: ResultParts): string {
  const head = symbolValues(caseCode.replace(/-/g, ""));
  if (!head || head.length !== 9) throw new Error("encodeResultCode: bad case code");
  let value = r.solved ? 1 : 0;
  value = value * 1024 + clamp(r.base, 1000);
  value = value * 128 + clamp(r.minutes, 127);
  value = value * 64 + clamp(r.questions, 63);
  value = value * 16 + clamp(r.wrongAccusations, 15);
  value = value * 16 + clamp(r.failedPresses, 15);
  const tail: number[] = new Array<number>(7).fill(0);
  for (let i = 6; i >= 0; i--) {
    tail[i] = value % 32;
    value = Math.floor(value / 32);
  }
  const check = checkSymbol([...head, ...tail]);
  const symbols = [...tail, check].map((v) => ALPHABET[v]).join("");
  return `${caseCode}-${symbols.slice(0, 4)}-${symbols.slice(4)}`;
}

export function decodeResultCode(text: string, knownScenarios: readonly number[], genVersion = GEN_VERSION): ResultDecode {
  const cleaned = text.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (cleaned.length !== 17) return { ok: false, error: "length" };
  const values = symbolValues(cleaned);
  if (!values) return { ok: false, error: "symbol" };
  const caseCode = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 9)}`;
  const head = decodeCaseCode(caseCode, knownScenarios, genVersion);
  if (!head.ok) return head;
  if (checkSymbol(values.slice(0, 16)) !== values[16]) return { ok: false, error: "check" };
  let value = 0;
  for (const v of values.slice(9, 16)) value = value * 32 + v;
  const failedPresses = value % 16;
  value = Math.floor(value / 16);
  const wrongAccusations = value % 16;
  value = Math.floor(value / 16);
  const questions = value % 64;
  value = Math.floor(value / 64);
  const minutes = value % 128;
  value = Math.floor(value / 128);
  const base = value % 1024;
  const solved = Math.floor(value / 1024) % 2 === 1;
  if (base > 1000) return { ok: false, error: "check" };
  return { ok: true, caseCode, parts: head.parts, result: { solved, base, minutes, questions, wrongAccusations, failedPresses } };
}
