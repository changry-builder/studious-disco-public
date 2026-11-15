// The difficulty table. See docs/case-engine.md section 7.
// Any change here changes what a seed generates: bump GEN_VERSION.

import type { Difficulty, Disposition } from "./types";

export const GEN_VERSION = 1;
export const MAX_ATTEMPTS = 40;

export interface DifficultyParams {
  suspects: number;
  redHerringMotives: number;
  secondLiar: "none" | "secretKeeper" | "either";
  /** Number of catchable killer lies before the final one. */
  lieDepth: 1 | 2;
  /** Innocents needed in the room the killer's "occupied" lie names. */
  minRefuters: number;
  todWidth: number;
  dispositions: Disposition[];
  redHerringWeapon: boolean;
  /** Innocents (not the second liar) with no solid alibi at the murder slot. */
  minLoose: number;
  maxLoose: number;
  /** Constraint families that must each, alone, eliminate every innocent. */
  minGrounds: number;
  /** Suspects that opportunity alone must fail to clear (including the killer). */
  minOppSurvivors: number;
  /** Suspects that means alone must fail to clear (including the killer). 2 adds a decoy. */
  minMeansSurvivors: number;
  /** The case must stay unique even if the player ignores who has withdrawn a claim. */
  strict: boolean;
  maxRepairs: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyParams> = {
  easy: {
    suspects: 4,
    redHerringMotives: 1,
    secondLiar: "none",
    lieDepth: 1,
    minRefuters: 2,
    todWidth: 1,
    dispositions: ["atScene", "hidden"],
    redHerringWeapon: false,
    minLoose: 0,
    maxLoose: 1,
    minGrounds: 2,
    minOppSurvivors: 1,
    minMeansSurvivors: 1,
    strict: true,
    maxRepairs: 2,
  },
  medium: {
    suspects: 5,
    redHerringMotives: 2,
    secondLiar: "secretKeeper",
    lieDepth: 1,
    minRefuters: 1,
    todWidth: 2,
    dispositions: ["hidden"],
    redHerringWeapon: false,
    minLoose: 1,
    maxLoose: 2,
    minGrounds: 1,
    minOppSurvivors: 2,
    minMeansSurvivors: 2,
    strict: true,
    maxRepairs: 2,
  },
  hard: {
    suspects: 6,
    redHerringMotives: 3,
    secondLiar: "either",
    lieDepth: 2,
    minRefuters: 1,
    todWidth: 3,
    dispositions: ["hidden", "gone"],
    redHerringWeapon: true,
    minLoose: 1,
    maxLoose: 3,
    minGrounds: 1,
    minOppSurvivors: 2,
    minMeansSurvivors: 2,
    strict: true,
    maxRepairs: 1,
  },
};
