# Depth Chart

Team rosters and depth charts drawn on the playing surface. Open `index.html` in a browser; there's nothing to build.

- **Baseball:** New York Mets on a baseball field, with a bullpen panel (closer, setup, relief). Toggle the **26-man** active roster or the **40-man** (optioned and injured players too).
- **Basketball:** UCLA Bruins men and women on a half court (PG, SG, SF, PF, C).

## Using it

- **Seasons.** The first season is the settled roster: 2026 Opening Day for the Mets, 2025-26 for UCLA. Later seasons are projections:
  - Mets: players under a guaranteed deal, a club option or team control (pre-arb and arbitration).
  - UCLA: every player stays five years, so a senior returns as a fifth-year graduate and a graduate leaves. Set **Leaves early after** on a player to change that (draft, transfer).
- **Hover a name** for free agency (baseball) or class (basketball) in the season you're viewing. Tap a name on a phone.
- **Move players** by dragging between positions, or use ▲ ▼ on a row (or click a name and choose **Move to**). Every player is on the field or court once, starting at their primary position; dragging to another position moves them. Depth changes apply to the season you're viewing and carry forward to later seasons until you change those.
- **Starting Lineup** on the field or court names the first player at each position: the nine fielders and the day's starting pitcher for baseball, the five starters for basketball. Click ▾ to hide it.
- The **roster list** sits beside the field (basketball counts centers as forwards).
- **Add player** (or the last row of the table) for a potential signing, recruit or transfer. A dashed outline marks anyone not on the depth chart yet: they sit at the bottom of their primary position until you drag them to a spot or click ✓ to keep them there.
- **Injured list**: drag a player onto the Injured List panel under the field, or tick the box in their details. Injured players leave the field and don't count against the roster limit (26, 40 or 15). An injury applies to that season only. Drag them back to a position, or click ✓ Activate, to return them; they go back to their old spot.
- Basketball class years are colored: Fr green, So blue, Jr purple, Sr orange, Gr red. Click any name to edit contract or class details, change roster status, or remove the player.
- **Contracts & team control / Eligibility by season** shows every player's jersey number and status season by season. Click a season heading to list only that season's players (click it again, or **Show all seasons**, to go back). Type a name in the last row to add a player who joins in the selected season; press Enter to add the next one.
- **Reset changes** puts the team back to the built-in data.

## Your edits and site updates

Edits are saved automatically in the browser you use. They're stored as changes on top of the built-in rosters, keyed by player id, so pulling a new version of the site keeps them. Any roster detail you didn't change picks up the new data.

- Before a new version first runs, the site takes an automatic snapshot of every team's edits. It does the same before a reset, a restore or a web refresh. The last five snapshots are listed under **Save / restore**, each with a **Restore** button.
- **Save / restore → Download backup** saves all teams' edits to a `.json` file. **Restore from file** loads one, so you can move edits to another browser or computer, or onto the GitHub Pages copy. Edits made when you open `index.html` from disk and edits made on the Pages site are stored separately by the browser.
- For future versions: never rename a player id in the data files. When the saved format changes, bump `SCHEMA` and add a migration step in `js/model.js` rather than discarding old data. The tests pin the current ids and check that first-release edits still load.

## Data

`js/data-mets.js` and `js/data-ucla.js` hold the rosters. They were gathered from news reports of the Opening Day roster and the 2025-26 UCLA rosters; entries marked `verify: true` came from secondary sources and should be checked. Contract years for players under team control are estimates (the last three control years are counted as arbitration).

## Refresh from the web

The button is ready but needs a roster service, because a static page can't search the web on its own safely (it would need an API key in the browser). Set `refreshUrl` in `js/config.js`. The service gets `GET <refreshUrl>?team=mets|ucla-m|ucla-w` and returns `{ players, depth, asOf }` in the same shape as the data files. The new roster replaces the built-in one, and your moves and additions are kept.

## Tests

`npm test` from the repository root runs `tests/depth-chart.test.js` along with the other tests.
