# Capital Clash

A two-player geography quiz for one device. You get a country and type a city.
The capital and the most populous city score the most.

Open `index.html` in a browser to play. There's nothing to install or build.

## How a game works

- **3 rounds**: Easy, Medium, then Hard. Hard counts double.
- **5 countries per round.** Both players get the same five countries.
- **Pass and play.** Player 1 takes their turn, then hands over the device. Neither
  player sees the other's answers until both have played. Then the round's answers
  are revealed side by side.
- **Each country has its own clock** (15 or 20 seconds, chosen at the start).
- **Skip** (`Tab` or the Skip button) moves on to the next country and pauses the
  skipped country's clock. Come back to it later, or tap its tile at the top.
  When only one country is left, Skip becomes Pass.
- **One answer per country.** `Enter` locks it in.

## Scoring

| Answer | Points |
|---|---|
| Capital city | 3 |
| Most populous city | 3 |
| Both at once (e.g. Paris for France) | 4 |
| Any other major city | 1 |
| Quick answer (capital or largest, with at least half the clock left) | +1 |

Every round includes at least one **trap**: a country whose capital isn't its
largest city, such as Australia (Canberra / Sydney) or Turkey (Ankara / Istanbul).

Missing accents, capital letters, and small typos are forgiven
("bogota", "Melborne", "Kiev" all count).

## Project layout

- `index.html`: the page
- `css/style.css`: departure-board styling
- `js/countries.js`: country data (capitals, largest cities, other major cities, difficulty tier)
- `js/engine.js`: answer matching, scoring, and round selection (no DOM)
- `js/app.js`: screens and the per-country clock
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
