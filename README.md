# Capital Clash

A two-player quiz for one device. Pick a topic on the setup screen.

**World geography** has three games:

- **Country → city**: you get a country and type a city. The capital and the most
  populous city score the most.
- **City → country**: you get a city and type the country it's in.
- **Top 3 cities**: you get a country's three biggest cities one at a time, smallest
  first, and type the country. The fewer cities you need, the more you score.

Open `index.html` in a browser to play. There's nothing to install or build.

**School supplies** is a clue game in the style of a category on the TV show *The Floor*:
three clues about an item, hardest first, one every 5 seconds. Name the item; the fewer
clues you need, the more you score.

## How a game works

- **3 rounds.** The last round counts double.
- **Difficulty** is chosen at the start: *Easy → Hard* (Easy, Medium, then Hard),
  or stay at *Easy*, *Medium* or *Hard* for all three rounds.
- **5 questions per round.** Both players get the same five.
- **Pass and play.** Player 1 takes their turn, then hands over the device. Neither
  player sees the other's answers until both have played. Then the round's answers
  are revealed side by side, with a map of the round.
- **Each question has its own clock** (15 or 20 seconds, chosen at the start).
- **Skip** (`Tab` or the Skip button) moves on to the next question and pauses the
  skipped question's clock. Come back to it later, or tap its tile at the top.
  When only one question is left, Skip becomes Pass.
- **One answer per question.** `Enter` locks it in.

## The round map

After each round, the reveal screen shows a world map of that round:

- **Country → city:** the round's countries are highlighted, with each capital (★)
  and largest city (●) marked and each player's answer circled in their colour.
- **City → country:** each clue city is marked on its country, and any wrong
  guesses are outlined in the player's colour, so you can see how far off they were.
- **Top 3 cities:** the three cities are numbered on their country (1 = biggest),
  with wrong guesses outlined the same way.

Tap a country or city above the map, or "Show on map" in the answers table, to zoom
in. The zoomed view labels the country's other major cities too.

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

## Scoring: Top 3 cities

| Answer | Points |
|---|---|
| Right country with 1 city showing | 5 |
| With 2 cities showing | 3 |
| With all 3 showing | 1 |

The third-biggest city shows first, the second-biggest after 5 seconds and the biggest
after 10. Skipping a country pauses its clock, so its cities stop appearing too.
There's no quick-answer bonus in this game, since answering early already scores more.

City sizes come from GeoNames populations. The city the quiz lists as a country's
largest always comes first, so the order matches the other games; the next two
are ranked by population.

## Scoring: School supplies

| Answer | Points |
|---|---|
| Right item after 1 clue | 5 |
| After 2 clues | 3 |
| After all 3 clues | 1 |

There are 66 items over three levels: everyday (pencil, stapler), classroom and craft
(protractor, hole punch) and science lab, old-school and obscure (slide rule, inkwell,
Bunsen burner). Other names count too: rubber for eraser, Post-it for sticky notes,
Sharpie for marker. Naming a different item ("pen" for a pencil) scores 0. There's no
map for this topic.

To add items, edit `js/supplies.js`. `npm test` checks that no clue contains its own
item's name or one of its other names.

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
- `js/supplies.js`: School supplies items, other names and clues
- `js/engine.js`: answer matching, scoring, and round and clue selection (no DOM)
- `js/map.js`: the round map on the reveal screen
- `js/world.js`, `js/places.js`: country outlines and city coordinates and populations, generated by
  `scripts/build-geo.js`
- `js/vendor/`: d3-geo and d3-array (ISC licence), used to draw the map
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

After adding a country or city, rebuild the map data so it has coordinates:

```sh
npm install --no-save world-atlas@2 all-the-cities@3 topojson-client@3 i18n-iso-countries@7
node scripts/build-geo.js
```

The script prints any city it couldn't find; add those to `MANUAL` in the script.
`npm test` fails if a city is missing coordinates.

## Map data credits

- Country outlines: [Natural Earth](https://www.naturalearthdata.com/) (public domain),
  via [world-atlas](https://github.com/topojson/world-atlas).
- City coordinates: [GeoNames](https://www.geonames.org/) (CC BY 4.0), via
  [all-the-cities](https://github.com/zeke/all-the-cities).
