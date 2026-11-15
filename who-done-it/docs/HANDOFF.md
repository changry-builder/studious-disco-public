# Hand-off

Start here. If you are a new session asked to "read HANDOFF.md and continue", read this file, then the docs it points to, then do the first item under "What to do next".

Last updated: end of the Fable sessions. The single-player game is playable, installable and has a deploy workflow. It has not been deployed or tried on a real phone.

## What this project is

"Who Done It?" is a murder mystery game for one person's own phones: an installable web app (PWA), played in portrait, 10 to 20 minutes a case. It lives in `who-done-it/` in the public `studious-disco-public` repository, where the owner keeps their games. The repository root is a different game, Capital Clash (`index.html`, `js/`, `css/`, `img/`, root `tests/`). Leave it alone.

The owner is not a programmer by trade. Report in plain words, say what was and was not verified, and ask before anything outward-facing (pull requests, merges).

## Read in this order

1. `game-design.md`: what the player does.
2. `case-engine.md`: the rules, the generator and the solver. The core of the project.
3. `architecture.md`: folders, state, saves, offline, the sync seam.
4. `adr/`: why each big decision was made.
5. `scenario-01.md` and `content-style-guide.md`: the first setting and how to write for it.
6. `tasks.md`: every task, who does it, and what "done" means.

## Status by milestone

| Milestone | Status |
|---|---|
| Phase 1: design docs | Done |
| M0 Scaffold | Done |
| M1 Case engine and solver | Done and reviewed. 1,000 seeds per difficulty: 100% unique, 100% deterministic, 0% fallback. The reviewer's independent brute-force solver agreed with `solver.ts` on 6,000 cases |
| M2 Engine tests | Done except task 2.5 (hand-built solver edge cases) |
| M3 Single-player loop | Built: every screen in `game-design.md` Section 4, the store, saving, the timer. A click-through test solves eight easy cases. Review (3.10) not done |
| M4 Content | Text written (393 entries) and spot-checked by the lead. The text tests (4.2) and the fact-check review (4.3) are not done |
| M5 Save, offline, install | Built: saving, play timer, service worker, manifest, icons, update prompt, install help, Pages workflow. Review (5.6) not done. **Not yet deployed or tried on a real phone** |
| M6 Multiplayer | Engine side done and tested: party deck, party reducer and scoring, result codes. Screens not started (6.1 share/enter code is partly there: Enter a code and a Share button exist; 6.2 result card and Compare screen, 6.5 party screens) |
| M7 Polish | Not started |

145 tests pass (`npm test`). `npm run build` succeeds.

## What to do next, in order

1. **Get it deployed and onto a phone.** The pull request from `claude/who-done-it` into the default branch must be merged by the owner. Then check the "Deploy games to Pages" workflow run. If it fails, fix it (see "Deploy" below). Then have the owner install it on an iPhone and an Android phone and play one easy case. Real-phone problems (safe areas, tap targets, the iOS home-screen icon, offline) outrank everything below.
2. **Reviews that were skipped**, with the `reviewer` subagent (Opus): task 3.10 (screens; includes checking no component reads hidden truth), 4.3 (every motive and bond document against the "story" column in `scenario-01.md`, every statement template against the style guide's "one rule"), 5.6 (saving and offline).
3. **Tests that were skipped**, with `test-writer`: task 4.2 (text: every key exists for every id, placeholders, limits; a throwaway version of this check passed, but it is not in the repository), task 2.5 (solver edge cases), and a click-through test that solves a **medium** and a **hard** case (the existing `tests/app/solve.test.tsx` covers easy only; medium needs the secret-keeper cracked first).
4. **Multiplayer screens**, with `ui-builder` (Sonnet): 6.2 result card with hidden answers and the Compare screen; 6.5 party mode (players, card reveal, pass-the-phone private voting, round tally, scoreboard). The store already exposes everything: see the "API for screens" block at the top of `src/app/store.ts` (`partyDispatch`, `startPartyCase`, `endPartyCase`, `snap.party.deck`). Home currently shows Party mode as "Coming soon".
5. **Polish** (M7): atmosphere, sound hooks, accessibility pass.
6. **Play-testing feedback.** The difficulty table has lots of headroom. If cases feel too easy or the "presence record" repairs feel too convenient, that is an engine change: see "The riskiest areas" first.

## Which model for what

Nothing left needs the strongest model. Use:

| Work | Model |
|---|---|
| Screens, styling, layout fixes | Sonnet (`ui-builder`) |
| App logic, workflow fixes, tests that need judgement | Sonnet (`implementer`) |
| Mechanical tests, text | Haiku (`test-writer`, `content-writer`). Check Haiku's text yourself: its first pass left six motive documents not naming whose motive they were |
| Reviews; any change to `src/engine/**` or `facts.ts` | Opus (`reviewer`, or do it in an Opus session) |

Subagents are defined in `.claude/agents/` at the repository root. **Pass the model explicitly when you delegate** (the Agent tool's `model` parameter). In one earlier session a subagent ran on the session's own model despite its `model:` line, and it was never established why.

Brief subagents the way the earlier sessions did: absolute paths, which docs to read, exactly which files they may and may not touch, "done when" commands, and "do not run git".

## The riskiest areas

1. **The solver and the lying rules must match exactly.** The fairness of every case rests on the solver enumerating every hypothesis the public rules allow. If you add a way to lie, or a kind of clue, then the solver, the generator, the "How to play" list (`game-design.md` Section 3 and `src/app/components/rules.tsx`) and the tests all change together.
2. **Determinism.** Same seed, same case, on every device. No `Math.random`, no dates, no iteration over unordered keys in the engine. Any change to generated output needs a `GEN_VERSION` bump (`src/engine/difficulty.ts`) once the game is deployed, because case codes embed it. The golden snapshot test fails when generated cases change.
3. **`npm run verify` must keep passing.** If a change makes it fail, tune the difficulty table or the generator. Never loosen the solver to get a pass. The worked-example tests pin the solver to hand-checked answers.
4. **Rule L5.** A liar withdraws a claim when shown *any* true evidence that contradicts it. `fillRefuters` in `generate.ts` computes this generically. A per-case list written by hand was the one real bug the review found.
5. **Party mode and motives.** The solver treats "no motive document found" as proof of no motive, and only considers a shield once the bond is known. That is fair only when everything has been found. The party deck never calls the solver on a partial table; keep it that way (`case-engine.md` Sections 5.5 and 13).
6. **Text must not carry facts.** Flavor text that invents a sighting or a time breaks fair play silently. The style guide's "one rule" guards this.
7. **The UI must not leak the truth.** Components read `view(...)`; only `Result.tsx` reads the reveal. A test scans the screen sources for `.truth`, `.solution`, `.lie` and `refutedBy`. `validSupport` is exported for tests only.

## What a future model must not break

- `src/engine/` stays pure TypeScript with no imports from outside itself (a test enforces it).
- Innocents never lie; the killer lies only about the murder slot; at most one second liar; lies are "alone in R" or a bonded vouch.
- A case is only returned if the solver finds exactly one (killer, weapon, motive), with and without the admission rule.
- The notebook never does the deduction for the player: no highlighting contradictions, no marking lies.
- Saves are written after every action.
- Reducers stay pure and actions stay plain JSON (this is the sync seam).
- Capital Clash at the repository root keeps working at the same address.

## How to run, test, build

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

`show` prints one whole case: the true timeline, every lie chain, every item, and what the solver concludes. Use it to understand the engine and to debug. `verify` is the engine acceptance run.

To look at the app the way a phone would, use Playwright with a 375x812 viewport (see how `tests/app/solve.test.tsx` drives it in jsdom, or write a throwaway script outside the repository).

## Deploy

- Host: GitHub Pages for this repository. The owner has set Settings, Pages, Source to "GitHub Actions".
- `.github/workflows/pages.yml` (repository root) runs on every push but only acts on the repository's **default branch** (currently `claude/geography-quiz-game-fmxq48`). It tests both games, builds this one, and publishes Capital Clash's root files unchanged plus `who-done-it/dist` at `/who-done-it/`.
- The game's address will be `https://changry-builder.github.io/studious-disco-public/who-done-it/`.
- **The workflow has never run.** Likely first-run problems: the `github-pages` environment refusing the branch (Settings, Environments, github-pages, deployment branches), or a missed root file Capital Clash needs (the workflow copies `index.html`, `css`, `js`, `img`).
- Install steps for iPhone and Android are in `adr/006-hosting.md` and shown on the Home screen.

## How to add a new scenario

1. Copy `docs/scenario-01.md` to `docs/scenario-02.md` and write the new setting: slots, rooms with spots and a `proofSpot`, 8 cast members with secret errands, bonds, weapons (at least 2 per wound class), eligible victims, and motive links (each victim needs at least 4 suspects with a motive; at most 2 links per suspect per victim, of different types).
2. Have an Opus session review the facts.
3. Create `src/scenarios/<id>/facts.ts` from the tables. Give it the next free `index`.
4. Register it in `src/scenarios/index.ts`.
5. Run `validateScenario` (add it to the tests) and fix what it reports.
6. Make `cli/verify.ts` accept a `--scenario` option (it is hard-wired to Blackthorn today) and run 1,000 seeds. All three difficulties must pass.
7. Bump `GEN_VERSION` only if an existing scenario's facts or the generator changed.
8. Have `content-writer` write `text.ts` to the style guide (add a voice table for the new cast to the guide first). Check that every motive document names the suspect and the victim.
9. `store.ts` always starts scenario index 0. Add a scenario picker to the New case screen and pass the choice through `newCase`.

## Known issues

- Never run on a real phone. Only checked in an emulated 375 px browser.
- The deploy workflow has never run.
- Party mode shows "Coming soon" on Home; its screens are not built.
- No result card or Compare screen yet; result codes exist only in the engine.
- The click-through test covers easy cases only.
- "Who was alone with the weapon" is a strong clue on easy (by design). Medium and hard add a decoy.
- Repairs add a physical "presence record" in about 4 in 10 medium cases. Fair, but play-testing should judge whether it feels too convenient.
- The difficulty multiplier shown on the Result screen is a constant in `Result.tsx`; if scoring changes, change it there too.
- The Home subtitle, difficulty blurbs and code-error messages were written by the UI agent and not checked against the style guide.
- A bond document covering two directions (the love note) shows its text once and then a generic sentence for the second direction.
- `cli/verify.ts` and `cli/show.ts` are hard-wired to the Blackthorn scenario.

## Decisions still open

| Decision | Who decides | Notes |
|---|---|---|
| Merging the pull request | Owner | Nothing deploys until `claude/who-done-it` is merged into the default branch |
| Difficulty feel | Owner, after play-testing | `case-engine.md` Section 7 |
| "Where" is trivial in v1 | Owner | The body is never moved. A moved-body variant would make it a real deduction; it is an engine extension |
| Hints | Owner | Not in v1. Scoring has no hint cost |
| Sound and portraits | Owner | Hooks only in v1; portraits are initials |
| The secret-keeper | Decided: keep | See ADR-004 |
