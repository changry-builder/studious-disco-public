# Hand-off

Start here. If you are a new session asked to "read HANDOFF.md and continue", read this file, then the docs it points to, then pick up the first unticked task in `tasks.md`.

Last updated: end of Milestones 1 and 2 (engine built, reviewed and tested).

## What this project is

"Who Done It?" is a murder mystery game for one person's own phones: an installable web app (PWA), played in portrait, 10 to 20 minutes a case. It lives in `who-done-it/` in the public `studious-disco-public` repository, where the owner keeps their games. The repository root is a different game, Capital Clash (`index.html`, `js/`, `css/`, `img/`, root `tests/`). Leave it alone.

## Read in this order

1. `game-design.md`: what the player does.
2. `case-engine.md`: the rules, the generator and the solver. The core of the project.
3. `architecture.md`: folders, state, saves, offline, the sync seam.
4. `adr/`: why each big decision was made.
5. `scenario-01.md` and `content-style-guide.md`: the first setting and how to write for it.
6. `tasks.md`: what to do next, who does it, and what "done" means.

## Status by milestone

| Milestone | Status |
|---|---|
| Phase 1: design docs | Done |
| M0 Scaffold | Done |
| M1 Case engine and solver | Done and reviewed. 1,000 seeds per difficulty: 100% unique, 100% deterministic, 0% fallback. The reviewer's independent brute-force solver agreed with `solver.ts` on 6,000 cases |
| M2 Engine tests | Done except task 2.5 (hand-built solver edge cases). 93 tests pass |
| M3 Single-player loop | Not started |
| M4 Content | Not started |
| M5 Save, offline, install | Not started |
| M6 Multiplayer | Not started |
| M7 Polish | Not started |

## Who does what

Subagents are defined in `.claude/agents/` at the repository root: `implementer` and `ui-builder` (sonnet), `test-writer`, `content-writer` and `explorer` (haiku), `reviewer` (opus). `tasks.md` tags every task with one of them or with "lead".

"Lead" work is the engine, the solver, the schema and the scenario facts. It was done on the strongest model available. Remaining lead tasks are 6.2 (result codes) and 6.3 (party deck). If you are continuing on Opus or Sonnet, do those yourself rather than delegating, and keep `npm run verify` and the worked-example tests green.

## The riskiest areas

1. **The solver and the lying rules must match exactly.** The fairness of every case rests on the solver enumerating every hypothesis the public rules allow. If you add a way to lie, or a kind of clue, the solver, the generator, the "How to play" rules and the tests all change together.
2. **Determinism.** Same seed, same case, on every device. No `Math.random`, no dates, no iteration over unordered keys in the engine. Any change to generated output needs a `GEN_VERSION` bump.
3. **`npm run verify` must keep passing.** If a change makes it fail, tune the difficulty table or the generator. Never loosen the solver to get a pass. The worked-example tests pin the solver to hand-checked answers.
4. **Party mode and motives.** The solver treats "no motive document found" as proof of no motive. That is only fair once every room is searched. A party deck that reveals clues gradually must not rely on it early (see `case-engine.md` Section 5.5).
5. **Text must not carry facts.** Flavor text that invents a sighting or a time breaks fair play silently. The style guide's "one rule" and review task 4.3 guard this.
6. **The UI must not leak the truth.** Components read `view(...)` only.

## What a future model must not break

- `src/engine/` stays pure TypeScript with no imports from outside itself.
- Innocents never lie; the killer lies only about the murder slot; at most one second liar; lies are "alone in R" or a bonded vouch.
- A case is only returned if the solver finds exactly one (killer, weapon, motive).
- The notebook never does the deduction for the player.
- Saves are written after every action.
- Reducers stay pure and actions stay plain JSON (this is the sync seam).

## How to run, test, build and install

From `who-done-it/`:

```bash
npm install
```
```bash
npm run dev
```
```bash
npm test
```
```bash
npm run verify -- --seeds 1000
```
```bash
npm run show -- --seed 3 --difficulty hard
```
```bash
npm run build
```

`show` prints one whole case: the true timeline, every lie chain, every item, and what the solver concludes. Use it to understand the engine and to debug.

Installing on a phone needs the built app on an HTTPS host. The host is GitHub Pages from this repository (`adr/006-hosting.md`, which also has the iPhone and Android install steps). The deploy workflow is task 5.4 and is not built yet.

## How to add a new scenario

1. Copy `docs/scenario-01.md` to `docs/scenario-02.md` and write the new setting: slots, rooms with spots and a `proofSpot`, 8 cast members with secret errands, bonds, weapons (at least 2 per wound class), eligible victims, and motive links (each victim needs at least 4 suspects with a motive; at most 2 links per suspect per victim, of different types).
2. Get the lead to review the facts.
3. Create `src/scenarios/<id>/facts.ts` from the tables. Give it the next free `index`.
4. Register it in `src/scenarios/index.ts`.
5. Run `validateScenario` (it runs in the tests) and fix what it reports.
6. Run `npm run verify -- --scenario <id> --seeds 1000`. All three difficulties must pass.
7. Bump `GEN_VERSION` only if an existing scenario's facts or the generator changed. A new scenario alone does not need it.
8. Have `content-writer` write `text.ts` to the style guide (add a voice table for the new cast to the guide first). Run the text tests.
9. Add the scenario to the New case screen.

## Known issues

- "Who was alone with the weapon" is a strong clue on easy (by design). Medium and hard add a decoy.
- Repairs add a physical "presence record" in about 4 in 10 medium cases. They are fair, but play-testing should judge whether they feel too convenient.
- The app itself is a placeholder screen.

## Decisions still open

| Decision | Who decides | Notes |
|---|---|---|
| How Pages is currently set up for this repository | Owner | Needed before task 5.4. ADR-006 |
| Difficulty feel | Owner, after play-testing | The table passes the acceptance run with lots of headroom. `case-engine.md` Section 7 |
| "Where" is trivial in v1 | Owner | The body is never moved. A moved-body variant would make it a real deduction; it is an engine extension |
| Hints | Owner | Not in v1. Scoring has no hint cost yet |
| The secret-keeper | Decided: keep | Owner approved. See ADR-004 |
| Sound and portraits | Owner | Hooks only in v1 |
