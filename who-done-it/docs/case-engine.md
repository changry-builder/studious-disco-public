# Case engine

This is the spec for the part of "Who Done It?" that must never be wrong: the case model, the generator, the lying rules, and the solver that proves every case has exactly one solution.

Read this whole file before touching anything in `src/engine/`. No one may change the engine, the solver, or the schema without the lead architect's sign-off (see `HANDOFF.md`).

Status: built and proven. `npm run verify -- --seeds 1000` passes at all three difficulties (measured rates in Section 7). If you change a rule here, change the code, the "How to play" list in `game-design.md` and the tests in the same commit.

## 1. The idea in one page

- A **scenario** is hand-written: rooms, a cast, weapons, possible motives, bonds between people, and time slots.
- A **seed** picks the victim, killer, weapon, motive, murder room and murder slot. The generator then builds a **ground truth**: where every person was in every slot.
- Every statement and clue is **derived from the ground truth**. Innocent people tell the whole truth. The killer and at most one other person lie, in tightly limited ways (Section 4).
- The **solver** takes everything the player can discover and tests every hypothesis "X did it" against the lying rules. If exactly one (killer, weapon, motive) survives, the case is fair. If not, the generator repairs the case or retries with a new sub-seed.
- Everything is deterministic: same scenario, seed and difficulty give the identical case on any device.

The whole design rests on one decision: **the rules about who may lie, and how, are part of the game and are told to the player.** The player and the solver reason from the same rule list. That is what makes a case provably fair instead of "probably fine".

## 2. World model

### 2.1 Time and space

- The evening is divided into `T` **slots** (scenario 01: six half-hours, 9:00 pm to midnight). Slot ids are `0..T-1`.
- Each living person is in exactly one **room** for the whole of each slot.
- There are **no movement rules** in v1. A person may be in any room in the next slot. Room adjacency exists in the schema only to draw the map. (Adding movement deductions later is listed in Section 12.)
- The body is discovered after the last slot, by a scripted event (the midnight toast). The body is found in the murder room. It is never moved in v1.

### 2.2 The murder

The ground truth always satisfies these **murder rules**. The player is told them.

- M1. The murder happens in one slot `tm`, in one room `rm`. During slot `tm` the only people in `rm` are the killer and the victim.
- M2. Nobody enters `rm` in any slot after `tm`. (Anyone who did would have found the body.)
- M3. The weapon `w` has a home room. The killer took it from its home room in a slot `tw < tm` while **alone** there, or grabbed it at the scene (`home(w) == rm`, `tw == tm`).
- M4. If a weapon has an access list (a locked cabinet), the killer is on it.
- M5. The killer has a motive against the victim, and a document proving that motive can be found.
- M6. `1 <= tm <= T-2`. There is always at least one slot before and one after.

### 2.3 People

- **Victim** `V`: one cast member the scenario marks as eligible.
- **Suspects**: `N` other cast members (4 to 6 by difficulty). One is the **killer** `K`. Cast members not chosen are simply away that evening.
- **Second liar** (optional, at most one): a **shield** or a **secret-keeper** (Section 4).
- Everyone else is an **innocent**.

## 3. Data schema

TypeScript shapes. Ids are short lowercase strings. All arrays are kept in scenario order so iteration order never depends on object keys.

### 3.1 Scenario (hand-written)

```ts
type CharId = string; type RoomId = string; type WeaponId = string;
type MotiveType = 'inheritance'|'jealousy'|'revenge'|'debt'|'blackmail'|'exposure';
type WoundClass = 'blunt'|'blade'|'ligature';

interface Scenario {
  id: string;                 // 'blackthorn'
  index: number;              // 0..15, used in case codes
  slots: { id: number; label: string }[];          // label: '9:00 pm'
  rooms: Room[];
  characters: Character[];
  weapons: Weapon[];
  motives: MotiveLink[];
  bonds: Bond[];
  victims: CharId[];          // who may be the victim
}
interface Room {
  id: RoomId; adjacent: RoomId[];                  // map only
  spots: string[];            // searchable places, e.g. 'desk'
  proofSpot: string;          // where a presence proof for this room is found
}
interface Character {
  id: CharId;
  secret?: { room: RoomId; evidenceSpot: string }; // enables the secret-keeper role
}
interface Weapon {
  id: WeaponId; class: WoundClass; home: RoomId; homeSpot: string;
  access?: CharId[];          // if set, only these people could take it
}
interface MotiveLink {        // suspect has this motive against this victim
  id: string; suspect: CharId; victim: CharId; type: MotiveType;
  doc: { room: RoomId; spot: string };             // where its proof is found
}
interface Bond {              // `from` would lie to protect `to`
  from: CharId; to: CharId;
  public: boolean;            // public: shown in dossiers from the start
  doc?: { room: RoomId; spot: string };            // required if not public
}
```

All display text (names, bios, clue wording) lives in a separate text file keyed by these ids. The engine never reads text. See `content-style-guide.md`.

`validateScenario(scenario)` must check, and the tests must cover:
- every id referenced exists; no duplicate ids;
- every eligible victim has at least 4 suspects with a motive link, and at least 6 other cast members;
- a suspect has at most 2 motive links per victim, and they have different `type`s;
- every non-public bond has a `doc`;
- every wound class that has any weapon has at least 2;
- at least `maxSuspects + 3` rooms (the generator needs empty rooms);
- at most one character lacks a secret errand (medium always needs a secret-keeper).

### 3.2 Case (generated)

```ts
interface Case {
  genVersion: number; scenarioId: string; seed: number; difficulty: Difficulty;
  attempt: number; fallback: boolean; repairs: number;   // how it was produced (Section 6)
  victim: CharId; suspects: CharId[];
  body: { room: RoomId };
  claims: ClaimChain[];                     // one per (suspect, slot)
  items: Item[];                            // physical evidence
  solution: Solution;                       // hidden from the UI
  truth: Truth;                             // hidden from the UI
  par: { questions: number };               // for scoring
}
interface Solution { killer: CharId; weapon: WeaponId; motive: MotiveType; room: RoomId; slot: number; }
interface Truth {
  loc: Record<CharId, (RoomId|null)[]>;     // null = dead
  secondLiar: null | { kind:'shield'|'secretKeeper'; who: CharId; slot: number };
  weaponTakenSlot: number; disposition: 'atScene'|'hidden'|'gone';
}

interface Claim { room: RoomId; with: CharId[]; }   // `with` may include the victim; sorted
interface ClaimVersion { claim: Claim; lie: boolean; refutedBy: EvidenceRef[]; }
interface ClaimChain {
  speaker: CharId; slot: number;
  versions: ClaimVersion[];    // innocents: exactly one, lie:false
}
type EvidenceRef = { kind:'claim'; speaker: CharId; slot: number; version: number }
                 | { kind:'item'; id: string };

type Item =
 | { id:string; kind:'wound'; class: WoundClass }                     // from the body
 | { id:string; kind:'tod'; from: number; to: number }                // murder slot is in [from,to]
 | { id:string; kind:'weaponInPlace'; weapon: WeaponId; room: RoomId; spot: string }  // clean, at home
 | { id:string; kind:'weaponMissing'; weapon: WeaponId; room: RoomId; spot: string }  // gone from home
 | { id:string; kind:'weaponFound'; weapon: WeaponId; used: boolean; room: RoomId; spot: string }
 | { id:string; kind:'motiveDoc'; link: string; room: RoomId; spot: string }
 | { id:string; kind:'bondDoc'; pairs: {from: CharId; to: CharId}[]; room: RoomId; spot: string }  // bonds sharing one document are one item
 | { id:string; kind:'presence'; who: CharId; at: RoomId; slot: number; room: RoomId; spot: string }
 | { id:string; kind:'secretTrace'; who: CharId; room: RoomId; spot: string };        // flavor only
```

Item ids are stable strings built from content, e.g. `tod`, `wound`, `w:poker:found`, `m:forsythe-edmund-debt`, `p:finch:kitchen:3`.

### 3.3 Statement meaning

A claim "(room R, with S)" by speaker `c` for slot `t` means, when true:
- `c` was in `R` for slot `t`;
- **exactly** the people in `S` were also in `R`. The list is complete. "Alone" means `S` is empty.

Completeness is what gives the player absence deductions ("she was in the library and did not see you"). A truthful claim lists the killer and the victim (if alive) when they were truly there.

## 4. The lying rules

These are shown to the player in "How to play", in plain words. The solver assumes exactly these and nothing more.

- **L1. Innocents never lie.** Every claim by an innocent is true and complete.
- **L2. The killer lies about one slot only: the murder slot.** Every version of the killer's claim for `tm` is false. Every other claim the killer makes is true and complete. So the killer truthfully admits being alone where the weapon was kept, if that is how they got it.
- **L3. At most one other person lies**, and only in one of two ways:
  - **Shield.** Has a bond toward the killer that the player can discover. Their claim for `tm` gives their true room and true companions, but falsely adds the killer. The killer's matching claim says "with the shield".
  - **Secret-keeper.** Lies about one slot `ts`, to hide a private errand. The lie is always "I was alone in room R".
- **L4. Shape of lies.** Apart from the shield's vouch and the killer's matching claim, every lie has the form "I was alone in R". So a claim that names companions, made by someone with no bond to those companions, is true.
- **L5. Cracking.** When a liar is shown **any** true evidence that contradicts their current claim, they withdraw it. A second liar then tells the truth. The killer gives a new false claim. The killer's last version cannot be contradicted by any claim.
- **L6. Physical evidence never lies.**
- **L7. The shield is never in the murder room.** (M1 already says so. It matters for the solver.)

Things that follow, which the player can use:
- A withdrawn claim proves its speaker is the killer or the second liar.
- If two different people have withdrawn claims, the killer is one of them.
- If the killer withdrew a claim for slot `t`, the murder slot is `t`.

### 4.1 How the generator writes the killer's lies

The killer's chain for slot `tm` has `d` catchable versions followed by one final version (`d` is the difficulty's lie depth). Catchable kinds:

| Kind | Claim | Refuted by |
|---|---|---|
| `occupied` | "alone in Rc", where innocents were truly in Rc at `tm` | each of those innocents' claims for `tm` |
| `shielded` | "in Rs with the shield" (Rs is the shield's true room) | claims of the other innocents in Rs; the shield's revised claim |
| `secretRoom` | "alone in Rq", the secret-keeper's true room, when `ts == tm` | the secret-keeper's revised claim |

Final version: "alone in Ru", where Ru is a room with nobody in it at `tm`, `Ru != rm`, and Ru is not the secret-keeper's true room.

The "Refuted by" column shows what the generator relies on existing. The actual `refutedBy` list of every catchable lie is computed generically by `fillRefuters`: **every** true claim for that slot and every presence item that contradicts the lie is listed (rule L5). It is recomputed after each repair, because repairs add presence items. A statement or record asserts where people were and were not; two assertions conflict when they put one person in two rooms, or one says a person was in a room the other says they were not in.

Each kind is used at most once per chain and each version names a different room. Order: `shielded` first if there is a shield; `secretRoom` last among the catchable ones (it needs the secret-keeper cracked first).

### 4.2 How the generator writes the second liar

- **Shield** `S`: requires `bond(S -> K)`. At `tm`, `S` is in a room with at least one other innocent `Z` (so the vouch can be refuted). Version 0: true room, true companions plus `K`, `lie: true`, refuted by every other innocent in the room. Version 1: the true claim.
- **Secret-keeper** `Q`: requires `Q.secret` and no activated motive. At `ts`, `Q` is alone in `Q.secret.room`, which is not `rm` when `ts >= tm`. Version 0: "alone in R'", where at least one innocent was truly in R' at `ts`; refuted by their claims. Version 1: the true claim "alone in secret room". A `secretTrace` item is placed in the secret room for flavor.

## 5. The solver

### 5.1 Knowledge base

The solver sees only what a player can obtain:

```ts
interface KB {
  suspects: CharId[]; victim: CharId; bodyRoom: RoomId; slots: number; rooms: RoomId[];
  current: Claim[][];             // [suspect][slot]: the latest version reachable
  withdrawn: { who: CharId; slot: number }[];   // admitted lies
  bonds: { from: CharId; to: CharId }[];        // public, or its bondDoc is reachable
  items: Item[];                  // reachable physical items
  weapons: Weapon[]; motiveLinks: MotiveLink[]; // scenario data
}
```

`buildKB(case, scenario)` computes the **reachable closure**:

```
known = all version-0 claims + all items            // asking and searching are always possible in v1
repeat until nothing changes:
  for each chain whose current version v has a successor:
    if any ref in v.refutedBy is in known:
      add version v+1 to known; record (speaker, slot) in withdrawn
current[c][t] = highest known version of that chain
```

A version's `refutedBy` only ever lists true evidence (innocents' claims, a second liar's final claim, presence items). A final second-liar claim becomes known only when it is reached by the loop.

The same function with a subset of `known` gives the KB for a partial notebook. Party mode and par use that.

### 5.2 Hypotheses

A hypothesis is `H = (X, tmh, cfg)`:
- `X`: the supposed killer.
- `tmh`: the supposed murder slot, inside the `tod` item's window (inside `[1, T-2]` if no `tod` item is known).
- `cfg`: the supposed second liar. One of:
  - `none`;
  - `shield(Y)`: allowed only if `bond(Y -> X)` is in `kb.bonds`, `Y` has no withdrawn claim, and `Y`'s current claim at `tmh` lists `X`;
  - `secretOpen(Y, ts)`: `Y != X`, `Y` has no withdrawn claim, and `Y`'s current claim at `ts` is "alone" (an uncracked solo lie);
  - `cracked(Y)`: `Y != X` and `Y` has a withdrawn claim. All of `Y`'s current claims are true.

Admission rule: let `A` be the set of people with withdrawn claims. `H` is valid only if every member of `A` is `X` or the `cracked` second liar. If `X` is in `A`, then `tmh` must equal the slot `X` withdrew a claim for (and `X` has withdrawn claims for one slot only).

### 5.3 Consistency check

Under `H`, a claim is **trusted** unless it is `X`'s claim at `tmh`, or `Y`'s claim at `ts` under `secretOpen`. Under `shield(Y)`, `Y`'s claim at `tmh` is trusted after removing `X` from its `with` list.

```
function timelineConsistent(H, kb):
  rm = kb.bodyRoom
  qRoom = undefined                       // true room of an open secret-keeper at ts
  for t in 0 .. T-1:
    victimRoom = undefined
    for each suspect c whose claim at t is trusted:  (R, S) = adjusted claim
      if R == rm and t >= tmh: return false          // M1 witness, or M2 would have found the body
      for d in S:
        if d == victim:
          if t >= tmh: return false                  // victim is in rm at tmh and dead after
          if victimRoom defined and victimRoom != R: return false
          victimRoom = R
        else if d == X and t == tmh: return false    // X was in rm
        else if claim(d,t) is trusted:
          if claim(d,t).room != R: return false
        else:                                        // d is the open secret-keeper at ts
          if qRoom defined and qRoom != R: return false
          qRoom = R
      for each suspect d not in S, d != c, with a trusted claim at t:
        if claim(d,t).room == R: return false        // c would have listed d
    for each presence item (who, at, slot == t):
      if who == X and t == tmh: if at != rm: return false
      else if at == rm and t == tmh: return false    // only killer and victim there (M1, L7)
      else if at == rm and t > tmh: return false     // M2
      else if claim(who,t) is trusted: if claim(who,t).room != at: return false
      else: if qRoom defined and qRoom != at: return false; qRoom = at
    if cfg is secretOpen(Y, ts) and t == ts and qRoom undefined:
      // Y needs somewhere to have been: a room no trusted person claims at ts
      free = rooms with no trusted claimant at ts, excluding rm when ts >= tmh
      if free is empty: return false
  return true
```

### 5.4 Means and motive

```
function weaponFits(w, kb):
  wound = the wound item, if known
  if wound and w.class != wound.class: return false
  if kb has weaponInPlace(w) or weaponFound(w, used:false): return false   // known clean
  used = the weaponFound item with used:true, if known
  if used and used.weapon != w: return false
  return true

function meansOk(X, w, tmh, kb):
  if w.access and X not in w.access: return false
  if w.home == kb.bodyRoom: return true                 // grabbed at the scene
  for t < tmh:
    if current[X][t] is not known: return true            // an unheard statement cannot rule X out
    if current[X][t] == (w.home, alone): return true      // true by L2: X lies only at tmh
  return false

function motives(X, kb):
  return types of motive links (X -> victim) whose motiveDoc item is in kb.items
```

### 5.5 Solve

```
function solve(kb):
  fits = empty set of (killer, weapon, motive)
  for X in kb.suspects:
    for tmh in window(kb):
      for cfg in configs(X, tmh, kb):
        if not validAdmissions(X, tmh, cfg, kb): continue
        if not timelineConsistent((X, tmh, cfg), kb): continue
        for w in kb.weapons where weaponFits(w, kb) and meansOk(X, w, tmh, kb):
          for m in motives(X, kb):
            fits.add((X, w.id, m))
  return { unique: fits.size == 1, fits }
```

Cost: at most 6 suspects, 3 slots, about 40 configs, each check a few hundred operations. Solving is instant, so the generator and the tests can call it thousands of times.

`solve` takes two options:
- `families`: apply only some of the constraint families (`opportunity`, `means`, `motive`). The generator uses that to measure **grounds**: for each innocent `X`, which families alone eliminate every hypothesis with `X` as killer. Grounds drive the difficulty checks in Section 7.
- `ignoreAdmissions`: skip the admission rule (still using the latest claims). A case must be unique **both** with and without it (the `strict` gate). This guarantees the case is solvable by alibi, means and motive reasoning, and not only by counting who changed their story.

Partial notebooks: the solver is sound for claims the player has not heard (they constrain nothing). It is **not** sound for items not yet found: "no motive" is only a valid deduction once every room has been searched, and a shield hypothesis is only considered once the bond is known (a secret bond's document may not be found yet). Par passes all items for that reason. Party mode (task 6.3) must account for it.

### 5.6 Why this is sound

- The true hypothesis always passes, because the generator builds the truth to satisfy M1–M6 and L1–L7. A test asserts this for every generated case.
- Every hypothesis the rules allow is enumerated. The player has the same rules, so anything the solver cannot rule out, the player cannot rule out either. Uniqueness of `fits` is therefore exactly "one answer is provable".
- The solver ignores some information a player might use (a suspect standing firm when pressed, flavor text). Using less information can only make it stricter.

## 6. The generator

### 6.1 Determinism rules

- One PRNG: **mulberry32** over a `uint32` state, using `Math.imul` and `>>> 0`. Seeded with `mix(seed, attempt)` where `mix` is a 32-bit integer hash (the murmur3 finalizer).
- `rng.int(n)` returns `Math.floor(u * n / 4294967296)` for the next `uint32` `u`. `rng.pick`, `rng.shuffle` (Fisher–Yates) and `rng.chance(num, den)` are built on `int`.
- Never use `Math.random`, `Date`, locale functions, `Object.keys` order of dynamic keys, or `Set`/`Map` iteration where insertion order could vary. Sort by scenario order before iterating.
- Any change to generator code, difficulty tables, or scenario facts changes what a seed produces. Bump `GEN_VERSION` when that happens. Text-only changes do not need a bump. (`GEN_VERSION` stays 1 until the game is first deployed; no codes exist in the wild before then.)
- A golden test stores the full JSON of a few cases and fails if they change without a `GEN_VERSION` bump.

### 6.2 Top level

```
function generateCase(scenario, seed, difficulty):
  P = DIFFICULTY[difficulty]
  for attempt in 0 .. MAX_ATTEMPTS-1:            // MAX_ATTEMPTS = 40
    rng = makeRng(mix(seed, attempt))
    c = tryBuild(scenario, rng, P)
    if c: return finish(c, attempt, fallback:false)
  rng = makeRng(mix(seed, MAX_ATTEMPTS))
  return finish(buildFallback(scenario, rng, P), MAX_ATTEMPTS, fallback:true)
```

### 6.3 tryBuild

Returns a case or `null`. Any step that cannot be satisfied returns `null` and the next attempt runs.

```
1. Cast
   V = pick(scenario.victims)
   K = pick(characters with a motive link against V)
   suspects = K + (P.suspects - 1) others picked from the rest, kept in scenario order
   (a shield is chosen first from the whole cast, by bond to K, and is always included)

2. Motives
   m = pick(links(K, V)); activate it
   pick P.redHerringMotives other suspects that have links against V; activate one link each

3. Second liar (per P.secondLiar)
   shield candidates: suspects S != K with bond(S -> K)
   secret-keeper candidates: suspects Q != K with a secret and no activated motive
   choose the kind and the person; null if required and none exists

4. Crime
   w  = pick(weapons K may access)
   rm = pick(rooms); tm = 1 + int(T - 2)
   tw = tm if w.home == rm, else int(tm)
   disposition = pick(P.dispositions)
   if hidden: td = a slot after tm; Rd = a room other than rm and w.home
   ts = tm for a secret-keeper (every secret-keeper chain uses `secretRoom`)
   decoy (medium, hard; skipped when w.home == rm): pick an innocent who may access w and a
   slot before tm other than tw. That person is alone in w.home in that slot, so
   "who was alone with the weapon" does not name the killer by itself. null if no slot exists.

5. Time-of-death window
   width = P.todWidth; choose a window of that width containing tm, inside [1, T-2]

6. Place everyone, slot by slot (rejection sampling, up to 300 tries per slot)
   Fixed: K at tw in w.home, at tm in rm, at td in Rd. V at tm in rm, dead after.
   Each try draws a room for every other living person, then checks:
     a. t == tm: nobody else in rm.                     t > tm: nobody in rm.
     b. t == tw != tm: K alone in w.home.               t == td: K alone in Rd.
        t == decoy slot: the decoy alone in w.home.
     c. t in window and t < tm: V shares a room with at least one innocent (seen alive).
     d. t == tm: the rooms each catchable killer lie needs exist (4.1), and an empty room exists for the final lie.
     e. t == tm: shield is with at least one other innocent.
     f. t == ts: secret-keeper alone in the secret room; an occupied room exists for their lie.
     g. t == tm: the count of innocents with no solid alibi is within [P.minLoose, P.maxLoose].
        Solid alibi: shares a room with an innocent Z where bond(Z -> X) does not exist.
   Each free person stays put with chance 1 in 3, else joins someone already placed with
   chance 1 in 2, else picks a random room. This keeps evenings believable and sociable.

7. Claims
   Truthful claim for every (suspect, slot) from the placement. Then overwrite the
   liars' chains per 4.1 and 4.2, filling `refutedBy`.

8. Items
   wound, tod; for every weapon: weaponInPlace, or weaponMissing (+ weaponFound per disposition);
   motiveDoc for each activated link; bondDoc for each non-public bond between two present people;
   secretTrace for the secret-keeper; on hard, one same-class red-herring weapon:
   weaponMissing at home + weaponFound(used:false) in another room.

9. Verify and repair
   kb = buildKB(case)
   assert the true hypothesis passes                 // engine bug if not: throw
   while (not solve(kb).unique or not solve(kb, ignoreAdmissions).unique) and repairs < P.maxRepairs:
     apply one repair, by priority, then re-solve:
       R3 if a wrong weapon fits and the weapon is gone: disposition gone -> atScene
       R2 else if a wrong suspect survives at a slot other than tm: narrow the tod window by one slot toward tm
       R1 else add a presence item placing a wrongly-surviving innocent in their true room at tm
   if still not unique: return null

10. Quality gates (return null if any fails)
   - every catchable lie has at least one refuter in the closure; every chain reaches its final version
   - grounds: every innocent is eliminated by at least P.minGrounds families on their own
   - at least P.minOppSurvivors suspects survive "opportunity only", and at least
     P.minMeansSurvivors survive "means only" (on harder levels neither alone solves the case)
   - grounds and survivors are measured with ignoreAdmissions
   - compute par (Section 8)
```

### 6.4 The fallback (guaranteed termination)

If 40 attempts fail, `buildFallback` builds a deliberately simple case that is unique by construction:
- no second liar, lie depth 1, exact time of death (window width 1), disposition `atScene`;
- one extra item: `presence(K, rm, tm)`, a physical record putting the killer in the murder room in the murder slot (the murder room's presence record, found at its proof spot).

Proof of uniqueness: the window forces `tmh = tm`. The presence item places `K` in `rm` at `tm`, and the check allows that only when `K` is the killer. The used weapon is found, so one weapon fits. `K` has exactly one activated motive. The true hypothesis passes. So `fits` has exactly one member.

The record contradicts both of the killer's claims. It is listed as a refuter of version 0 like any other evidence; the final version stands even though the record contradicts it. This is the one exception to the rule in Section 12 that nothing true contradicts the killer's final lie.

Placement can still fail by chance, so the fallback loops over sub-seeds (up to 2,000, then throws; in testing it always succeeded on the first).

A fallback case is flagged (`fallback: true`). The CLI reports the fallback rate per difficulty. It should be under 1%. If it is higher, tune the difficulty table; do not loosen the solver.

## 7. Difficulty

| Parameter | Easy | Medium | Hard |
|---|---|---|---|
| `suspects` | 4 | 5 | 6 |
| `redHerringMotives` | 1 | 2 | 3 |
| `secondLiar` | none | secret-keeper | shield or secret-keeper |
| `lieDepth` (catchable killer lies) | 1 | 1 | 2 |
| Contradictions to crack everything | 1 | 2 | 3 |
| `todWidth` (slots) | 1 | 2 | 3 |
| `dispositions` | atScene, hidden | hidden | hidden, gone |
| Red-herring weapon | no | no | yes |
| `minLoose`..`maxLoose` innocents with no solid alibi | 0..1 | 1..2 | 1..3 |
| `minGrounds` per innocent | 2 | 1 | 1 |
| `minOppSurvivors` (suspects alibis alone cannot clear) | 1 | 2 | 2 |
| `minMeansSurvivors` (suspects access alone cannot clear; 2 adds a decoy) | 1 | 2 | 2 |
| `minRefuters` (innocents in the room the killer's `occupied` lie names) | 2 | 1 | 1 |
| `strict` (unique without the admission rule too) | yes | yes | yes |
| `maxRepairs` | 2 | 2 | 1 |

On medium the killer's one catchable lie is `secretRoom`, so the player must crack the secret-keeper first. On hard the chain is `shielded` + `occupied` (with a shield) or `occupied` + `secretRoom` (with a secret-keeper).

Measured with `npm run verify -- --seeds 1000` at `GEN_VERSION` 1 (seeds 0 to 999):

| | Easy | Medium | Hard |
|---|---|---|---|
| Unique | 100% | 100% | 100% |
| Deterministic | 100% | 100% | 100% |
| Fallback cases | 0% | 0% | 0% |
| Average attempts | 1.55 | 1.44 | 1.78 |
| Average repairs | 0.00 | 0.43 | 0.31 |
| Average par (questions) | 6.3 | 8.7 | 11.7 |

There is plenty of headroom (40 attempts allowed, under 2 used), so the gates can be tightened later if play-testing finds cases too easy. Re-run and update this table whenever the generator or the difficulty table changes.

## 8. Par

Par feeds scoring. It estimates how many questions a careful player needs.

```
essential = all claim refs in the closure
for each claim ref r in a fixed order (speaker order, then slot):
  if solve(buildKB(case, known minus r and anything only reachable through r)).unique:
    remove r from essential
par.questions = max(6, essential.size + suspects.length)
```

Greedy removal is not minimal, but it is deterministic and close enough for scoring.

## 9. Pressing, accusing, and the game reducer

The engine also owns the rules of play, as a pure reducer. The UI never reads `case.truth` or `case.solution`.

```ts
type Action = { at: number } & (              // `at` = elapsed play time in ms, supplied by the UI
 | { type:'examineBody' }                          // reveals wound and tod
 | { type:'search'; room: RoomId; spot: string }   // reveals items at that spot
 | { type:'ask'; suspect: CharId; slot: number }   // reveals the suspect's current claim; costs 1 question
 | { type:'press'; suspect: CharId; slot: number; evidence: EvidenceRef }
 | { type:'accuse'; who: CharId; weapon: WeaponId; room: RoomId; motive: MotiveType;
     support: { who: EvidenceRef; what: EvidenceRef; why: EvidenceRef } }
 | { type:'pin'; ref: EvidenceRef; on: boolean }
 | { type:'tag'; suspect: CharId; tag: 'none'|'suspect'|'cleared' }
 | { type:'giveUp' });                               // ends the case unsolved; allows reveal()

function reduce(case, state, action): GameState   // pure; invalid actions return state unchanged
```

- The reducer does not know the scenario, so it cannot tell a real spot from an invented one. The UI must only offer rooms and spots that exist.
- **press** succeeds when the evidence is in the player's notebook and is listed in the current version's `refutedBy`. The chain advances one version and the new claim is revealed. Otherwise the press fails, the suspect stands firm, and `failedPresses` goes up. Pressing with a claim that is itself a lie always fails.
- **accuse** is correct when who, weapon, room and motive all match the solution **and** each support ref is valid:
  - `who`: any refuter of any of the killer's lie versions, or a `presence` item placing the killer in the murder room;
  - `what`: the used `weaponFound` item; if the weapon was never found, its `weaponMissing` item;
  - `why`: the killer's `motiveDoc`.
  A wrong accusation returns only how many of the four answers are wrong (never which). If the four answers are right but a support is weak, the result is "right theory, weak proof": no penalty, try again.
- A case's whole state is `reduce` folded over its action list. That list is the save file and the future sync unit (see `architecture.md`).

## 10. Case codes

A code carries everything needed to rebuild a case: 40 bits, written as 8 Crockford base-32 symbols plus 1 check symbol, shown as `XXXX-XXXXX`.

| Field | Bits | Notes |
|---|---|---|
| `genVersion` | 5 | must equal the app's `GEN_VERSION` |
| `scenario` | 4 | `scenario.index` |
| `difficulty` | 2 | 0 easy, 1 medium, 2 hard, 3 reserved |
| `seed` | 29 | 0 .. 536,870,911 |

- Pack as `((genVersion * 16 + scenario) * 4 + difficulty) * 2^29 + seed`. Use plain `Number` arithmetic with `Math.floor` and `%`; the value is below 2^53. Do not use 32-bit bitwise operators on it.
- Alphabet: `0123456789ABCDEFGHJKMNPQRSTVWXYZ`. When reading, accept lowercase, map `O` to `0` and `I`/`L` to `1`, and ignore hyphens and spaces.
- Check symbol: `(sum over the 8 data symbols of (position+1) * value) mod 32`.
- `decodeCaseCode` returns a typed error for: bad length, bad symbol, bad check, unknown scenario, reserved difficulty, and **version mismatch** ("this code was made by a different version of the game").

### 10.1 Result codes

A result code lets players compare results across phones with no network. It is the case code followed by 8 more symbols, shown `XXXX-XXXXX-XXXX-XXXX` (17 symbols).

| Field | Bits | Notes |
|---|---|---|
| `solved` | 1 | |
| `base` | 10 | score before the difficulty multiplier, 0..1000 |
| `minutes` | 7 | whole minutes played, capped at 127 |
| `questions` | 6 | capped at 63 |
| `wrongAccusations` | 4 | capped at 15 |
| `failedPresses` | 4 | capped at 15 |

Those 32 bits are written as 7 symbols. The 8th is a check symbol computed over all 16 preceding symbols (the case code included), so a result cannot be moved onto another case. The player's name and the answers they gave are not in the code: the host types the name, and answers are compared by looking at each other's result cards. `encodeResultCode` and `decodeResultCode` are in `code.ts`.

## 11. Worked examples

Both use scenario 01 (`scenario-01.md`). Slots: S0 9:00, S1 9:30, S2 10:00, S3 10:30, S4 11:00, S5 11:30.

### 11.1 Easy: the Colonel and the poker

Victim: Lord Edmund. Suspects: Beatrice, Dr Penrose, Colonel Forsythe, Finch. No bonds exist among these four.
Solution: Colonel Forsythe, the fire poker (home: drawing room), debt, in the study, at S3.

Ground truth (who is where):

| | S0 | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|---|
| Edmund (victim) | dining | library | study | **study** | dead | dead |
| Colonel (killer) | dining | drawing, alone | billiard | **study** | billiard, alone | hall |
| Beatrice | dining | library | conservatory | library | conservatory | hall |
| Penrose | dining | billiard | billiard | library | library | hall |
| Finch | kitchen | dining | hall | kitchen | dining | hall |

The Colonel takes the poker at S1 (alone in the drawing room), kills at S3, and hides the poker in the billiard room at S4.

Claims. Everyone's claims are the table above, with complete companion lists, except the Colonel's S3 chain:
- Version 0 (lie, `occupied`): "alone in the library". Refuted by Beatrice's S3 claim (library, with Penrose) and Penrose's S3 claim (library, with Beatrice).
- Version 1 (final lie): "alone in the gallery". Nobody was in the gallery at S3.

Items: `wound` blunt; `tod` S3..S3 (his watch stopped at 10:40); poker missing from the drawing-room fireplace and found, used, under the billiard table; every other weapon in place; motive documents for the Colonel (debt) and for Beatrice (revenge, the red herring).

Closure: the Colonel's version 0 is refuted by a known claim, so version 1 is known and (Colonel, S3) is withdrawn.

Solving. The window forces `tmh = S3`. `A = {Colonel}`, so every valid hypothesis has the Colonel as killer or as a cracked second liar.

| Supposed killer | Opportunity | Means (alone in the drawing room before S3?) | Motive |
|---|---|---|---|
| Beatrice | Fails: Penrose lists her in the library at S3; no bond, not a solo claim | Fails | Has one (revenge) |
| Penrose | Fails: Beatrice lists him | Fails | None |
| Finch | Passes: alone in the kitchen, nobody can confirm | Fails: never alone in the drawing room | None |
| Colonel | Passes: his S3 claim is the lie | Passes: S1, alone in the drawing room | Debt |

Weapons: the wound is blunt and the poker is found used, so only the poker fits. `fits = {(Colonel, poker, debt)}`. Unique.

Grounds: each innocent is eliminated by at least two families, which meets easy's `minGrounds = 2`. Opportunity alone leaves two suspects (Finch and the Colonel), which meets `minOppSurvivors = 1`.

What the player experiences: ask everyone about 10:30; notice three people claim the library but only two saw each other; press the Colonel with Beatrice's statement; he changes his story. Finch has no alibi, but he was never alone with the poker and has no motive.

### 11.2 Medium: a chain through a secret-keeper

(Hand-built to show the chain. A generated medium case also has a decoy: an innocent who was alone with the weapon, so means alone would not clear everyone as it does here.)

Victim: Dr Penrose. Suspects: Lady Margaret, Julian, Violet Marsh, Colonel Forsythe, Finch.
Bonds among them: Margaret -> Julian (public), Finch -> Margaret (public), Violet <-> Julian (secret; a love note is placed as a `bondDoc`).
Solution: Violet, the letter opener (home: study), blackmail, in the conservatory, at S3.
Secret-keeper: Finch, at S3 (he is in the cellar at the port).

| | S0 | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|---|
| Penrose (victim) | dining | drawing | library | **conservatory** | dead | dead |
| Violet (killer) | dining | study, alone | hall | **conservatory** | gallery, alone | hall |
| Margaret | dining | drawing | drawing | drawing | hall | hall |
| Julian | dining | billiard | drawing | billiard, alone | hall | hall |
| Colonel | dining | billiard | library | drawing | hall | hall |
| Finch | kitchen | dining | hall | cellar, alone | kitchen | hall |

Lies:
- Finch S3, version 0: "alone in the drawing room". Refuted by Margaret's and the Colonel's S3 claims. Version 1 (true): "alone in the cellar".
- Violet S3, version 0 (`secretRoom`): "alone in the cellar". Refuted only by Finch's version 1. Version 1 (final): "alone in the library".

Items: `wound` blade; `tod` S2..S3; letter opener missing from the study desk and found, used, in the gallery linen chest; motive documents for Violet (blackmail), Julian and the Colonel (red herrings); the love note; a `secretTrace` in the cellar.

Closure: Finch cracks (refuter known), which makes his version 1 known, which cracks Violet. `A = {Finch, Violet}`.

Solving:
- Two people have withdrawn claims, so the killer is Finch or Violet. Margaret, Julian and the Colonel are out by the admission rule alone.
- Finch as killer, `tmh = S3`, Violet as the cracked second liar: the timeline is consistent, but Finch was never alone in the study before S3 and has no motive. Fails.
- Violet as killer, `tmh = S3`, Finch cracked: consistent. She was alone in the study at S1. Motive: blackmail. Passes.
- `tmh = S2` is impossible for either: each withdrew a claim for S3.

`fits = {(Violet, letter opener, blackmail)}`. Unique.

Without the admissions the case still holds. Julian is alone at S3 and has a motive, so opportunity and motive both pass for him. Only means clears him: he was never alone in the study. The `S2` hypotheses die because the Colonel saw Penrose alive in the library at S2, except for the Colonel himself (his own S2 claim would be the lie); he is cleared by means. Finch fails means and motive.

Both examples are fixtures in `tests/engine/fixtures.ts`, and `worked-examples.test.ts` asserts every cell above.

What the player experiences: Finch's drawing-room story collapses against two witnesses; his confession about the cellar is the evidence that breaks Violet's alibi. Two contradictions, in order.

## 12. Edge cases and rules the code must keep

- A catchable lie must name a room that makes it false **and** refutable. Never let a liar's false claim accidentally be true.
- The final killer claim must not be contradicted by any true claim or presence item (the generator rejects the attempt if it is). Otherwise rule L5 would demand a withdrawal with no version left. The fallback's own record is the one exception (Section 6.4).
- Repairs must never add a presence item for the killer except in the fallback.
- A red-herring motive holder is never the secret-keeper.
- Only one second liar. A shield and a secret-keeper never appear together.
- Bonds are directed. `shield(Y)` needs `bond(Y -> X)`, not the reverse.
- The victim makes no claims. The victim appears only in others' `with` lists.
- `with` lists are sorted in scenario order so equal claims compare equal.
- The solver must enumerate `secretOpen(Y, ts)` even when the real case has no second liar. The player cannot know there is none.
- If `tod` is not in a partial KB, the window is `[1, T-2]`.

## 13. Party mode

`party.ts` holds the deck and the voting rules. Player-facing rules are in `game-design.md` Section 9.2.

### 13.1 The deck

`buildDeck(scenario, case)` returns the cards in a fixed order:

1. **scene**: the wound and the time-of-death window.
2. **papers**: every motive document and bond document.
3. **statements**: everyone's first statement for the slots outside the time-of-death window.
4. **objects**: every weapon item, presence record and secret trace.
5. **statements**: one card per slot in the window.
6. **crack**: one card per lie withdrawn, in the order the closure reaches them. Each names the evidence that broke the claim (`brokenBy`, always already on the table) and reveals the new claim.

If that is more than 8 cards, statement cards are merged from the front until it fits. Decks have 6 to 8 cards.

Guarantees, all tested: every item and every claim version appears on exactly one card; a crack card's evidence was revealed earlier; after the last card the table equals the full closure, so the case is uniquely solvable. Earlier rounds are **not** guaranteed solvable. They are for arguing and guessing, which is the point of the scoring rule. The deck never needs the solver on a partial table, so the partial-notebook caveat in Section 5.5 does not arise.

### 13.2 Voting

`partyReduce(state, action)` is a pure reducer like the solo one. Actions: `addPlayer`, `removePlayer` (both only between cases), `startCase { code, rounds }` (needs 2 to 8 players), `vote { player, suspect }` (may be changed until the round advances), `nextRound` (only when everyone has voted), `endCase { killer }` (only after the last round's votes; adds points to totals), `abandonCase`.

- The UI gets the killer for `endCase` from `partyReveal(case, state)`, which returns null until every player has voted in the last round.
- `partyPoints(votes, killer)`: find the first round from which the player voted for the killer and never changed away. With `R` rounds counted from 0, locking in at round `r` scores `round(100 × (R − r) / R)`. Never settling scores 0.
- `voteTally(state, round)` gives anonymous counts per suspect for display between rounds.

Future extensions, deliberately left out of v1: movement rules between adjacent rooms; a moved body (which would make "where" a real deduction); weapon sightings in testimony; delayed methods such as poison; firearms (a shot would fix the time for everyone).
