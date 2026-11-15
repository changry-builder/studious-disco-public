// Scoring. docs/game-design.md section 7.

import type { GameState } from "./game";
import type { Case, Difficulty } from "./types";

export const SCORE = {
  start: 1000,
  perExtraQuestion: 15,
  perFailedPress: 40,
  perWrongAccusation: 150,
  freeMinutes: 12,
  perExtraMinute: 10,
  maxTimePenalty: 200,
} as const;

const MULTIPLIER: Record<Difficulty, number> = { easy: 1, medium: 1.5, hard: 2 };

export type Rank = "Chief Inspector" | "Inspector" | "Sergeant" | "Constable" | "Bystander";

export interface ScoreBreakdown {
  questions: number;
  failedPresses: number;
  wrongAccusations: number;
  time: number;
  /** Before the difficulty multiplier, 0..1000. Zero if the case was not solved. */
  base: number;
  total: number;
  rank: Rank;
}

export function rankFor(base: number): Rank {
  if (base >= 900) return "Chief Inspector";
  if (base >= 750) return "Inspector";
  if (base >= 550) return "Sergeant";
  if (base >= 300) return "Constable";
  return "Bystander";
}

export function score(cs: Case, state: GameState): ScoreBreakdown {
  const questions = Math.max(0, state.questions - cs.par.questions) * SCORE.perExtraQuestion;
  const failedPresses = state.failedPresses * SCORE.perFailedPress;
  const wrongAccusations = state.wrongAccusations * SCORE.perWrongAccusation;
  const extraMinutes = Math.max(0, Math.floor(state.elapsedMs / 60000) - SCORE.freeMinutes);
  const time = Math.min(SCORE.maxTimePenalty, extraMinutes * SCORE.perExtraMinute);
  const base = state.solved ? Math.max(0, SCORE.start - questions - failedPresses - wrongAccusations - time) : 0;
  return { questions, failedPresses, wrongAccusations, time, base, total: Math.round(base * MULTIPLIER[cs.difficulty]), rank: rankFor(base) };
}
