# Architecture

How the code is organised, how state and saves work, how the app runs offline, and where live multiplayer would plug in later. Decisions and their reasons are in `adr/`.

## 1. Where the project lives

The game is a self-contained project in `who-done-it/` inside the `studious-disco-public` repository, where the owner keeps their games. The repository root holds a different game, Capital Clash (`index.html`, `js/`, `css/`). Do not import from it, and do not change it.

```
who-done-it/
  docs/                     design docs (this folder)
  index.html
  package.json  tsconfig.json  vite.config.ts
  public/                   icons, manifest
  src/
    engine/                 PURE TypeScript. No React, no DOM, no browser APIs.
      rng.ts                mulberry32, mix, int/pick/shuffle/chance
      types.ts              Scenario, Case, Claim, Item, KB, Action, GameState
      scenario.ts           validateScenario
      difficulty.ts         the difficulty table
      generate.ts           generateCase: plan, placement, claims and lies, items, verify and repair
      kb.ts                 buildKB (reachable closure)
      solver.ts             solve, timelineConsistent, weaponFits, meansOk
      par.ts                par
      code.ts               encodeCaseCode, decodeCaseCode, result codes
      game.ts               initialState, reduce, view
      score.ts              score, rank
      party.ts              buildDeck, party scoring
      index.ts              the only file the app may import from
    scenarios/
      blackthorn/
        facts.ts            the Scenario object (load-bearing; engine sign-off needed)
        text.ts             all display text, keyed by id (content-writer's file)
      index.ts              registry: scenario index -> scenario
    app/
      store.ts              session store (useSyncExternalStore)
      persistence.ts        SaveStore over localStorage
      transport.ts          SessionTransport interface + LocalTransport
      text.ts               render(templateKey, facts) -> string
      screens/              one file per screen
      components/           shared UI pieces
      styles/               tokens.css, base.css
    main.tsx
  cli/
    verify.ts               generate N cases per difficulty, report uniqueness and determinism
    show.ts                 print one case (truth, claims, items, solution) for a code or seed
  tests/
    engine/                 vitest, node environment
    app/                    vitest, jsdom
```

### The engine boundary

- `src/engine/**` imports nothing outside itself. A test scans its import statements and fails on any import that is not relative-within-engine.
- The app imports only from `src/engine/index.ts`.
- The engine takes a `Scenario` as a parameter. It does not import `scenarios/`.
- `view(case, state)` returns what the UI may show. The UI never reads `case.truth` or `case.solution`, except the Result screen, which calls `reveal(case, state)` and gets data only once the case is solved or the player gives up.

## 2. Stack

TypeScript, React 18, Vite 5, Vitest 2, `vite-plugin-pwa`, `tsx` for the CLI. No router, no state library, no CSS framework. See ADR-002.

Commands (from `who-done-it/`):

| Command | Does |
|---|---|
| `npm run dev` | dev server |
| `npm test` | all tests |
| `npm run verify -- --seeds 1000` | the engine acceptance run, all difficulties |
| `npm run show -- --code XXXX-XXXXX` | print a case |
| `npm run build` | type-check and production build to `dist/` |

## 3. State

One rule: **a session is a case plus a list of actions.** Everything else is derived.

```ts
interface Session {
  id: string;                    // local id
  mode: 'solo' | 'party';
  code: string;                  // case code
  case: Case;                    // snapshot, so a save survives an engine update
  actions: Action[];             // the only thing that grows
  elapsedMs: number;             // foreground play time
}
state = actions.reduce((s, a) => reduce(case, s, a), initialState(case))
```

- `store.ts` holds the current `Session` and the derived `GameState`. `dispatch(action)` appends the action, reduces once, saves, and notifies subscribers. Components read through `useSyncExternalStore`.
- Screen navigation is plain React state (`{ screen, params }`), kept out of the session so it is never synced. The last screen is saved separately so the app reopens where it was.
- Party mode is its own reducer in `engine/party.ts` (`PartyState`, `PartyAction`: `addPlayer`, `startCase`, `vote`, `nextRound`, `endCase`). Same pattern: a list of actions over a deterministic deck.

## 4. Persistence

- `SaveStore` interface: `load(key)`, `save(key, value)`, `remove(key)`. One implementation, over `localStorage`. See ADR-003 for why not IndexedDB.
- Written synchronously inside `dispatch`, after every action. There is no "save" button and no debounce. Closing the app mid-case loses nothing.
- Keys, all prefixed `wdi:v1:`:

| Key | Holds |
|---|---|
| `session:solo` | the in-progress solo session |
| `session:party` | the in-progress party (players, totals, current case) |
| `nav` | last screen |
| `history` | finished cases: code, score, date (last 50) |
| `settings` | sound on/off, player name |

- Every stored value is wrapped `{ v: 1, data }`. On load, an unknown `v` or a value that fails validation is moved to `wdi:v1:quarantine:<key>` and treated as absent. Never crash on a bad save.
- The save holds a snapshot of the `Case`, so play continues even if a later app version generates a different case for the same seed. Replaying actions over the snapshot rebuilds the state. If the reducer itself ever changes meaning, bump `v` and write a migration.
- On first launch the app calls `navigator.storage.persist()` and ignores the answer.

## 5. Offline and install

- `vite-plugin-pwa` in `generateSW` mode precaches every built asset. The app has no runtime network calls at all, so once installed it works with no connection.
- `registerType: 'prompt'`: when a new version is available the Home screen shows "Update available". It never updates in the middle of a case.
- `base: './'` so the build works from any path on a static host.
- Manifest: `display: standalone`, `orientation: portrait`, theme and background colours, 192 and 512 icons plus a maskable icon. `index.html` also needs `apple-touch-icon` and `viewport-fit=cover`.
- Layout uses `env(safe-area-inset-*)` on the top bar and bottom navigation.

Hosting and install steps are in ADR-006.

## 6. The sync seam

Live sync between phones is not in v1. It can be added without touching game logic, because:

1. All game logic is pure reducers over action lists (`reduce`, `partyReduce`).
2. Cases are rebuilt from a code, so phones never need to send a case to each other.
3. The store talks to a small interface instead of assuming it is alone:

```ts
interface SessionTransport {
  // Called by the store for every local action, after it is applied and saved.
  publish(sessionId: string, action: Action | PartyAction): void;
  // The transport calls back with actions from other devices, in a total order.
  subscribe(sessionId: string, onRemote: (a: Action | PartyAction) => void): () => void;
}
```

v1 ships `LocalTransport`, which does nothing. A later `FirebaseTransport` (or any other) would send actions to a shared log and deliver remote ones. What that future work must add, and nothing more:

- a room/lobby screen and a player identity;
- an ordering rule for simultaneous actions (server timestamp order is enough, because party actions are per-player votes that commute, and solo sessions are single-writer);
- for shared-code races, a tiny shared record per player: `{ code, name, solvedAt, result }`. The result code already encodes this.

What must stay true so the seam keeps working: reducers stay pure, actions stay plain JSON, and nothing reads the clock or random numbers outside the engine's seeded PRNG.

## 7. Text

- The engine produces facts (ids, rooms, slots, who was named). `app/text.ts` turns them into sentences using templates from `scenarios/<id>/text.ts`.
- Templates take named placeholders (`{room}`, `{time}`, `{names}`) and are chosen deterministically from the variants available (index = a hash of case seed, speaker and slot), so the same case reads the same on every phone.
- A test renders every template with sample facts and fails on a missing key or an unfilled placeholder.

## 8. Testing

| Layer | What is tested | Where |
|---|---|---|
| Engine | determinism, lying rules, solver, closure, codes, reducer, scoring, party deck | `tests/engine`, node |
| Acceptance | 1,000 seeds per difficulty: unique, deterministic, truth passes, fallback rate | `cli/verify.ts`, also runnable as a slow test |
| Text | every key exists, no unfilled placeholders, length limits | `tests/app` |
| UI | each screen renders from a fixture session; a full easy case can be played through with clicks | `tests/app`, jsdom |
