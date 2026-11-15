# Game design

"Who Done It?" is a murder mystery for one phone, played in portrait, in 10 to 20 minutes. This doc covers what the player does and sees. The logic underneath is in `case-engine.md`.

## 1. What we are protecting

The fun is the moment when clues the player already holds suddenly fit together. Every rule here serves that:

- **Fair play.** Every case is proven solvable by logic alone before the player sees it. All suspects are introduced on the first screen. Every needed clue can be found. Red herrings can be ruled out.
- **The game never does the deduction for the player.** The notebook records and arranges. It never highlights a contradiction, never marks a statement as a lie, never greys out a cleared suspect unless the player tagged them.
- **The rules of lying are public.** The player is told exactly who may lie and how. Deduction comes from applying those rules.

## 2. Core loop

1. **Briefing.** Who died, where the body was found, who was in the house.
2. **Investigate**, in any order:
   - examine the body (wound type, time-of-death window);
   - search rooms, spot by spot, for physical evidence;
   - question suspects about each half-hour of the evening;
   - press a suspect: pick one of their statements and a piece of evidence that contradicts it.
3. **Think** in the notebook: timeline grid, clues, testimony, pins, tags.
4. **Accuse**: who, with what, where, why, with one piece of supporting evidence for who, what and why.
5. **Result**: score, rank, and the full true timeline revealed.

## 3. The rules shown to the player ("How to play")

Short, on one screen, always reachable from the notebook:

1. Everyone stays in one room for each half-hour.
2. Innocent people tell the truth, and they name everyone who was in the room with them.
3. The killer lies about one thing only: where they were in the half-hour of the murder. Everything else the killer says is true.
4. At most one other person lies, about one half-hour only, in one of two ways:
   - **Covering for the killer.** They have a bond with the killer that you can find. They say the killer was with them during the murder. Where they say they were, and who else they name, is true.
   - **Hiding a private errand.** They say "I was alone" in a room they were not in.
5. Any lie other than that cover story has the form "I was alone in such a room". So two people with no bond who name each other are both telling the truth.
6. Show a liar any true evidence that contradicts them and they will change their story. The other liar then tells the truth. The killer tells a new lie. Someone who changes their story is the killer or that one other liar.
7. During the murder, only the killer and the victim were in the room. Nobody entered that room afterwards.
8. The killer took the weapon from where it is kept while alone there, or it was already in the room. A locked weapon can only be taken by someone with a key.
9. The killer has a motive, and proof of it can be found.
10. Physical evidence never lies.

These are the engine's rules M1–M6 and L1–L7 in plain words, and the list must stay complete: the solver assumes exactly these, so a rule missing here would be a deduction the player cannot fairly make. If the engine rules change, this list changes in the same commit.

## 4. Screens and flows

Bottom navigation during a case: **House**, **People**, **Notebook**, **Accuse**. All primary actions sit in the lower two thirds of the screen for one-handed reach.

| Screen | What it does |
|---|---|
| Home | Continue (if a save exists), New case, Enter a code, Party mode, How to play |
| New case | Pick difficulty. Shows the case code with a share button |
| Briefing | Victim, where found, the suspects (portrait, name, one line each). "Begin" |
| House | Map of rooms as a tappable grid. The murder room is marked. Tap a room to enter |
| Room | Short description, then its spots as large buttons. Tapping a spot searches it and shows what is there (or a line saying nothing of note). The body, if here, has an "Examine" button |
| People | List of suspects with the player's tag. Tap one to open their dossier |
| Dossier | Bio, public bonds, then the evening as six time rows. An unasked row says "Ask". An asked row shows the statement. Each shown statement has a "Press" button |
| Press | Choose evidence from the notebook to confront the statement. Confirm. Result: the suspect cracks (new statement appears, old one struck through) or stands firm |
| Notebook | Tabs: Timeline, Clues, Testimony, Pinned, Rules |
| Accuse | Four pickers (who, weapon, room, motive) and three evidence slots. "Make the accusation" needs a confirm tap |
| Result | Solved or not, score breakdown, rank, the true timeline, the case code. Buttons: Share result, New case |

Notebook detail:
- **Timeline**: grid of suspects by time slots. Cells fill in as statements are collected (room name, small avatars of who they named). Withdrawn statements stay visible, struck through, under the new one. Tap a cell to see the full statement and pin it.
- **Clues**: physical evidence, newest first, filter by room.
- **Testimony**: statements grouped by person or by time (toggle).
- **Pinned**: whatever the player pinned, in the order they choose.
- Tags on people (none, suspect, cleared) are set by the player only.

## 5. Interrogation and pressing

- Asking a suspect about a time slot costs one **question**. Re-reading an answer is free.
- Pressing is free when it works. A failed press costs points (Section 7).
- A press works only when the chosen evidence is true and directly contradicts the current statement (engine rule L5). Pressing an honest suspect always fails.
- When a suspect cracks, the old statement is struck through and the new one appears. A second liar's new statement is the truth, with a line of confession. The killer's new statement is another lie.
- Suspects react to being pressed with a short line in their own voice. That text is flavor; it never carries a fact (see `content-style-guide.md`).

## 6. The accusation

- Who: one suspect. With what: one weapon from the scenario's list. Where: one room. Why: one motive type.
- Supporting evidence: one item each for who, what and why, chosen from the notebook.
- Outcomes:
  - **All correct, with valid support**: solved.
  - **Answers right, support weak**: "Your theory is right, but that would not convince a jury." No penalty. The player swaps evidence and tries again.
  - **Something wrong**: "Not quite." On easy the game says how many of the four answers are wrong. On medium and hard it says nothing more. Each wrong accusation costs points.
- There is no limit on accusations. The score carries the cost.

In v1 the body is always found where the murder happened, so "where" is easy. It stays in the accusation because a later version may move the body (see open decisions in `HANDOFF.md`).

## 7. Scoring

Start from 1,000 and subtract:

| Cost | Points |
|---|---|
| Each question beyond par | 15 |
| Each failed press | 40 |
| Each wrong accusation | 150 |
| Each full minute beyond 12 minutes of play | 10 (at most 200) |

Minimum score 0. Par is computed per case by the engine (`case-engine.md` Section 8). Searching rooms is free: exploration should never feel taxed.

Difficulty multiplier on the final score: easy ×1, medium ×1.5, hard ×2.

Ranks, by score before the multiplier: 900+ Chief Inspector, 750+ Inspector, 550+ Sergeant, 300+ Constable, below that Bystander.

Play time counts only while the case screen is open and the app is in the foreground. The UI passes elapsed time into each action; the engine never reads a clock.

## 8. Difficulty

Three presets: Easy, Medium, Hard. The parameters are in `case-engine.md` Section 7. In player terms:

| | Easy | Medium | Hard |
|---|---|---|---|
| Suspects | 4 | 5 | 6 |
| Lies to catch | 1 | 2, in order | 3 |
| Time of death | exact | one of two half-hours | one of three |
| Weapon | found | found, hidden | may never be found |
| Feels like | one clean contradiction | a confession that unlocks the real lie | a covered alibi, and alibis alone are not enough |

## 9. Multiplayer

No backend in v1. See `architecture.md` for the seam where live sync would attach.

### 9.1 Shared case codes

- One player makes a case and shares its code (9 characters, e.g. `4K2M-9QX7T`). The code holds the scenario, difficulty and seed, so every phone builds the identical case.
- Everyone solves on their own phone.
- The Result screen shows a **result card**: name, solved or not, the four answers given, score, time, questions, wrong accusations. The answers stay hidden behind a "Reveal" button so players can count down and reveal together.
- Each result also has a short **result code**. A host can type the others' result codes into a "Compare" screen to get a ranked table. This is optional; holding phones side by side works too.

### 9.2 Pass-and-play party mode

One phone, 2 to 8 players, each with a name.

- The case is dealt as a **deck of clue cards** in a fixed order built by the engine: the scene first, then statements and evidence, then the cracks. The deck has 6 to 8 rounds.
- Each round: the new card is read aloud; the phone is passed; each player privately votes for a suspect.
- After the last round the killer is revealed.
- **Scoring**: a player's points for the case depend on the first round from which they voted for the killer and never changed away. With `R` rounds, locking in at round `r` earns `100 × (R − r + 1) / R`, rounded. Never settling on the killer earns 0. Early and steady beats late; guessing a new name each round earns nothing.
- A scoreboard keeps totals across cases until the party ends.
- The votes of each round are shown as anonymous counts before the next card, so the table can argue.

## 10. Atmosphere

- 1926, an English country house, dry and understated. Text carries it: see the style guide.
- Visuals: dark paper, warm ink, one accent colour. Portraits can start as initials in a frame.
- Sound is optional and off by default. The code exposes hooks (`onAsk`, `onCrack`, `onFind`, `onSolve`) so sound can be added in the polish milestone without touching logic.
