# Tasks

Milestone-ordered. Each task names the subagent that does it and what "done" means. Work top to bottom; a milestone is finished when its review task passes.

Rules for every task:
- All paths are inside `who-done-it/`. Never touch the repository root's `index.html`, `js/`, `css/`, `img/`, `scripts/` or `tests/` (that is a different game, Capital Clash).
- The owner of a task reads the docs listed before starting.
- Nobody but the lead changes `src/engine/**`, `src/scenarios/*/facts.ts`, or `docs/case-engine.md` without the lead's sign-off. "Lead" means the most capable model available: Fable while it lasts, then Opus.
- Tick tasks here as they finish, and update `HANDOFF.md` at the end of each milestone.

## M0. Scaffold

- [x] **0.1 Project skeleton** — `implementer`. Read `architecture.md`, ADR-002.
  Create `package.json`, `tsconfig.json` (strict), `vite.config.ts` (`base: './'`), `index.html`, `src/main.tsx` rendering a placeholder, the folder tree from `architecture.md` Section 1, and npm scripts `dev`, `test`, `build`, `verify`, `show`.
  Done when: `npm install`, `npm test` (zero tests is fine), and `npm run build` all succeed from `who-done-it/`.
- [x] **0.2 Engine purity test** — `test-writer`.
  A test that scans every file in `src/engine/` and fails on any import that is not a relative path inside `src/engine/`.
  Done when: the test passes, and fails when a `react` import is added to an engine file as a check.

## M1. Case engine and solver (lead only)

Read `case-engine.md` completely first. It is the spec. If the code proves a rule wrong, change the doc in the same commit.

- [x] **1.1 `rng.ts`, `types.ts`, `difficulty.ts`** — lead. Done when: `rng` gives a fixed, recorded sequence for a fixed seed.
- [x] **1.2 `scenario.ts` and `scenarios/blackthorn/facts.ts`** — lead. Transcribe `scenario-01.md` exactly. Done when: `validateScenario` passes on it and rejects each broken variant listed in `case-engine.md` Section 3.1.
- [x] **1.3 `solver.ts` and `kb.ts`** — lead. Build these before the generator, and test them on the two worked examples written out by hand as fixtures. Done when: both examples solve to exactly the stated answer, and each "fails/passes" cell in the example tables is asserted.
- [x] **1.4 `generate.ts`** (placement, claims and items live in this one file) — lead. Done when: `generateCase` returns a case for any seed and difficulty, and the true hypothesis passes the solver for each.
- [x] **1.5 `par.ts`, `code.ts`** — lead. Done when: codes round-trip, and every decode error in Section 10 has a test.
- [x] **1.6 `cli/verify.ts`, `cli/show.ts`** — lead. `verify` generates N seeds per difficulty and reports: unique count, deterministic count (each case generated twice and compared as JSON), average attempts, fallback count.
  **Acceptance for the milestone: 1,000 seeds at each of the three difficulties, 100% unique, 100% deterministic, fallback under 1%.**
- [x] **1.7 Tune and record** — lead. Adjust the difficulty table until 1.6 passes. Write the final table and the measured rates into `case-engine.md` Section 7.
- [x] **1.8 `game.ts`, `score.ts`** — lead. The reducer, `view`, `reveal`, scoring. Done when: a scripted action list solves the easy worked example and scores as computed by hand.
- [x] **1.9 Review** — `reviewer` reads the engine against `case-engine.md`; the lead does the final pass on the solver.

## M2. Engine tests

All `test-writer`. Read `case-engine.md`. Tests go in `tests/engine/`. Do not change engine code; report failures.

- [x] **2.1 Determinism** — the same (seed, difficulty) twice gives byte-identical JSON, for 200 seeds per difficulty. A golden file holds 3 full cases and fails if they change.
- [x] **2.2 Lying rules** — for 300 generated cases per difficulty, assert from `case.truth`: every innocent claim is true and complete; the killer's only false claims are for the murder slot; at most one second liar; every lie other than a vouch is "alone in R"; every final second-liar claim is true.
- [x] **2.3 Murder rules** — M1 to M6 hold in `case.truth` for the same cases.
- [x] **2.4 Reachability** — every lie chain reaches its last version in the closure; every `refutedBy` entry is true evidence; every item sits in a spot that exists.
- [ ] **2.5 Solver edge cases** — hand-built KBs: two suspects alone at the murder slot (not unique); a bonded pair vouching for each other (not cleared); an unbonded pair (cleared); missing `tod` item (window widens); a presence item in the murder room; two withdrawn claims (killer must be one of them).
- [x] **2.6 Reducer** — invalid actions leave state unchanged; a failed press counts; a press with a lie as evidence fails; accusation outcomes (wrong, weak proof, solved).
- [x] **2.7 Codes** — round trip for 1,000 random values; lowercase, `O`/`I`/`L` and hyphen handling; each error type.

Done when: all pass, and the reviewer confirms each acceptance line maps to at least one test.

## M3. Core single-player loop

Read `game-design.md` and `architecture.md`. The UI uses placeholder text until M4.

- [x] **3.1 Store, transport stub, text renderer** — `implementer`. `app/store.ts`, `app/transport.ts` (`LocalTransport`), `app/text.ts`. Done when: unit tests show dispatch appends, reduces and notifies.
- [x] **3.2 Design tokens and shell** — `ui-builder`. `tokens.css`, `base.css`, bottom navigation, safe-area handling. Done when: the shell renders at 375 px with no horizontal scroll and tap targets of at least 44 px.
- [x] **3.3 Home, New case, Briefing** — `ui-builder`.
- [x] **3.4 House and Room (search, examine body)** — `ui-builder`.
- [x] **3.5 People, Dossier, asking** — `ui-builder`.
- [x] **3.6 Press flow** — `ui-builder`. Crack and stand-firm states.
- [x] **3.7 Notebook** — `ui-builder`. Timeline grid, Clues, Testimony, Pinned, Rules. The notebook must not highlight contradictions or mark lies.
- [x] **3.8 Accuse and Result** — `ui-builder`. Result uses `reveal`.
- [x] **3.9 Play-through test** — `test-writer`. A jsdom test plays the easy worked example from Home to a solved Result by clicking.
- [ ] **3.10 Review** — `reviewer`. Includes a check that no component reads `case.truth` or `case.solution`.

Done when: a human can play an easy case start to finish on a phone-sized screen.

## M4. Content

- [x] **4.1 Scenario 01 text** — `content-writer`. Read `content-style-guide.md` and `scenario-01.md`. Write `src/scenarios/blackthorn/text.ts` for every key in the style guide's table. Split into batches: characters; rooms and spots; weapons; motive and bond documents; briefings and body text.
- [x] **4.2 Text tests** — `test-writer`. Every key exists for every id; no unfilled or unknown placeholders; every limit respected.
- [ ] **4.3 Fact check** — `reviewer`. Read every motive and bond document against the "story" column, and every claim template against the "one rule".

Done when: 4.2 passes and 4.3 finds no text that carries or contradicts a fact.

## M5. Save, resume, offline, install

- [x] **5.1 Persistence** — `implementer`. `app/persistence.ts` per `architecture.md` Section 4, including quarantine of bad saves. Done when: tests show a session survives a simulated reload after every action type, and a corrupted value does not crash the app.
- [x] **5.2 Foreground timer** — `implementer`. Elapsed time counts only while a case screen is visible.
- [x] **5.3 PWA** — `implementer`. `vite-plugin-pwa`, manifest, icons, update prompt on Home only. Done when: the built app loads with the network disabled after one visit, and Lighthouse reports it installable.
- [x] **5.4 Deploy** — `implementer`. A workflow that builds and publishes `who-done-it/dist`, triggered only by changes under `who-done-it/`. Needs the owner's hosting choice first (ADR-006).
- [x] **5.5 Install help** — `ui-builder`. Home shows install steps to a user who is not running installed.
- [ ] **5.6 Review** — `reviewer`.

## M6. Multiplayer

- [ ] **6.1 Enter a code, share a code** — `ui-builder`. Uses `decodeCaseCode` errors for messages.
- [ ] **6.2 Result codes** — the encoding is done (`encodeResultCode`, `decodeResultCode`; `case-engine.md` Section 10.1). Remaining: `ui-builder` builds the result card with hidden answers and the Compare screen.
- [x] **6.3 Party engine** — lead. `engine/party.ts`: `buildDeck`, `partyReduce`, scoring per `game-design.md` 9.2. Done when: the deck for any case ends with a uniquely solvable revealed set, and scoring matches hand-worked cases.
- [x] **6.4 Party tests** — done by the lead in `tests/engine/party.test.ts`.
- [ ] **6.5 Party screens** — `ui-builder`. Players, card reveal, private voting with pass-the-phone screens, round tally, scoreboard.
- [ ] **6.6 Review** — `reviewer`.

## M7. Polish

- [ ] **7.1 Atmosphere** — `ui-builder`. Typography, colour, portraits, screen transitions (respect reduced-motion).
- [ ] **7.2 Sound hooks** — `ui-builder`. `onAsk`, `onCrack`, `onFind`, `onSolve`; off by default.
- [ ] **7.3 Accessibility pass** — `ui-builder`. Contrast, focus order, labels on icon buttons, text scaling to 200%.
- [ ] **7.4 Final review** — `reviewer`, then the lead plays three cases at each difficulty on a real phone.

## Later (not scheduled)

- A second scenario (steps in `HANDOFF.md`).
- Live sync transport.
- Engine extensions listed at the end of `case-engine.md`.
