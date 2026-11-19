# Depth Chart

Team rosters and depth charts drawn on the playing surface. Open `index.html` in a browser; there's nothing to build.

- **Baseball:** New York Mets on a baseball field, with a bullpen panel (closer, setup, relief). Toggle the **26-man** active roster or the **40-man** (optioned and injured players too).
- **Basketball:** UCLA Bruins men and women on a half court (PG, SG, SF, PF, C).

## Using it

- **Seasons.** The first season is the settled roster: 2026 Opening Day for the Mets, 2025-26 for UCLA. Later seasons are projections:
  - Mets: players under a guaranteed deal, a club option or team control (pre-arb and arbitration).
  - UCLA: every player stays five years, so a senior returns as a fifth-year graduate and a graduate leaves. Set **Leaves early after** on a player to change that (draft, transfer).
- **Hover a name** for free agency (baseball) or class (basketball) in the season you're viewing. Tap a name on a phone.
- **Move players** by dragging between positions, or use ▲ ▼ ✕ on a row. Dragging from the roster list adds a player to a position, so one player can be listed at several. Drag a row back to the roster list to take it off a position. Depth changes apply to the season you're viewing and carry forward to later seasons until you change those.
- **Add player** for a potential signing, recruit or transfer. Prospects are shown dashed. Click any name to edit contract or class details, change roster status, or remove the player.
- **Contracts & team control / Eligibility by season** shows every player's status season by season.
- **Reset changes** puts the team back to the built-in data. Changes are saved in this browser only; **Refresh from web** has a JSON box to copy them elsewhere.

## Data

`js/data-mets.js` and `js/data-ucla.js` hold the rosters. They were gathered from news reports of the Opening Day roster and the 2025-26 UCLA rosters; entries marked `verify: true` came from secondary sources and should be checked. Contract years for players under team control are estimates (the last three control years are counted as arbitration).

## Refresh from the web

The button is ready but needs a roster service, because a static page can't search the web on its own safely (it would need an API key in the browser). Set `refreshUrl` in `js/config.js`. The service gets `GET <refreshUrl>?team=mets|ucla-m|ucla-w` and returns `{ players, depth, asOf }` in the same shape as the data files. The new roster replaces the built-in one, and your moves and additions are kept.

## Tests

`npm test` from the repository root runs `tests/depth-chart.test.js` along with the other tests.
