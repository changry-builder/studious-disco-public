# Capital Clash

A two-player geography quiz for one device, with two games:

- **Country → city**: you get a country and type a city. The capital and the most
  populous city score the most.
- **City → country**: you get a city and type the country it's in.

Open `index.html` in a browser to play. There's nothing to install or build.

## How a game works

- **3 rounds.** The last round counts double.
- **Difficulty** is chosen at the start: *Easy → Hard* (Easy, Medium, then Hard),
  or stay at *Easy*, *Medium* or *Hard* for all three rounds.
- **5 questions per round.** Both players get the same five.
- **Pass and play.** Player 1 takes their turn, then hands over the device. Neither
  player sees the other's answers until both have played. Then the round's answers
  are revealed side by side.
- **Each question has its own clock** (15 or 20 seconds, chosen at the start).
- **Skip** (`Tab` or the Skip button) moves on to the next question and pauses the
  skipped question's clock. Come back to it later, or tap its tile at the top.
  When only one question is left, Skip becomes Pass.
- **One answer per question.** `Enter` locks it in.

## Scoring: Country → city

| Answer | Points |
|---|---|
| Capital city | 3 |
| Most populous city | 3 |
| Both at once (e.g. Paris for France) | 4 |
| Any other major city | 1 |
| Quick answer (capital or largest, with at least half the clock left) | +1 |

Every round includes at least one **trap**: a country whose capital isn't its
largest city, such as Australia (Canberra / Sydney) or Turkey (Ankara / Istanbul).

## Scoring: City → country

| Answer | Points |
|---|---|
| Right country | 3 |
| Quick answer (at least half the clock left) | +1 |

About half the clues are a capital or largest city and half are another major city
(Perth, Porto, Semarang). City names that give the country away, like Panama City,
are never used. If a city name exists in more than one country (Valencia, Tripoli,
Santiago), any of them counts. Common other names for countries work too: UK,
England, Holland, Burma, Ivory Coast, USA.

Missing accents, capital letters, and small typos are forgiven in both games
("bogota", "Melborne", "Kiev", "Australa" all count).

## Project layout

- `index.html`: the page
- `css/style.css`: departure-board styling
- `js/countries.js`: country data (capitals, largest cities, other major cities, other country names, difficulty tier)
- `js/engine.js`: answer matching, scoring, and round and clue selection (no DOM)
- `js/app.js`: screens, the two game modes, and the per-question clock
- `tests/engine.test.js`: tests for the engine and data

Run the tests with `npm test` (Node 18+).

## Editing the country list

Each entry in `js/countries.js` looks like this:

```js
{ name: "Australia", code: "AUS", tier: 1,
  capital: ["Canberra"],
  largest: ["Sydney", "Melbourne"],
  cities: ["Brisbane", "Perth", "Adelaide"] }
```

Use `|` to separate alternate spellings (`"Kyiv|Kiev"`). The first spelling is the one shown.
Where sources disagree on the largest city, list each one under `largest`.
