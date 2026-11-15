// The only file the app and the CLI may import from.
export * from "./types";
export { GEN_VERSION, MAX_ATTEMPTS, DIFFICULTY, type DifficultyParams } from "./difficulty";
export { makeRng, mix, type Rng } from "./rng";
export { validateScenario } from "./scenario";
export { generateCase } from "./generate";
export { buildKB, chainKey, refKey, findChain, type Known, type Closure } from "./kb";
export { solve, survivingKillers, timelineConsistent, weaponFits, meansOk, evidencedMotives, todWindow, type SolveResult, type SolveOptions, type Hypothesis } from "./solver";
export { computePar } from "./par";
export { encodeCaseCode, decodeCaseCode, MAX_SEED, type CaseCodeParts, type CodeError, type DecodeResult } from "./code";
export { initialState, reduce, replay, view, reveal, holds, validSupport, type Action, type GameState, type GameView, type StatementView, type LastResult, type Tag } from "./game";
export { score, rankFor, SCORE, type ScoreBreakdown, type Rank } from "./score";
export { encodeResultCode, decodeResultCode, type ResultParts, type ResultDecode } from "./code";
export { buildDeck, partyReduce, partyPoints, partyReveal, initialParty, allVoted, voteTally, MAX_ROUNDS, MAX_PLAYERS, type Card, type CardKind, type PartyState, type PartyAction, type PartyRound } from "./party";
