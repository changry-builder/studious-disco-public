# What to Eat

A small web app for the "what should we eat?" argument.

1. **Pick cuisines.** Keep or reject 29 picture tiles. Kept tiles are the candidates; if nothing is kept, every undecided tile is a candidate.
2. **Settle it.** Left-vs-right showdowns (single-elimination bracket) run until one cuisine wins.
3. **Find it nearby.** See real restaurants of that cuisine around an address, your location, or a pin you drop on the map, as a map and a list.

It is a static site: plain HTML, CSS and classic JavaScript, with Leaflet vendored. There is no build step, no npm runtime dependency, no API key and no account.

## Run it locally

Serve the `what-to-eat/` folder with any static server. Do not open `index.html` from `file://`: the service worker and geolocation need a secure context, and the app expects to be served over HTTP.

```sh
cd what-to-eat
python3 -m http.server 8000
# or: npx --yes serve .
```

Then open http://localhost:8000/. `localhost` counts as a secure context, so the service worker and location work there.

The app is served from a sub-path on GitHub Pages (`/<repo>/what-to-eat/`), so every URL in the code is relative. Keep it that way.

## How it works

- **Pick.** Tap a tile to keep it. The small x button rejects a tile (it greys out and does not move). Tap a rejected tile to clear it. If more than 16 candidates remain, 16 are chosen at random (seeded) and the app says so.
- **Duel.** The candidates play a single-elimination bracket: n candidates means n-1 duels. Byes fill the first round so the bracket is a power of two. Undo steps back one duel. Keyboard: left and right arrows. "Flip a coin" picks a side at random.
- **Winner.** The winner, the runner-ups, and "Rematch" (same candidates, new seed) or "Start over".
- **Results.** Restaurants of the winning cuisine within a radius (0.5 to 25 km, default 2 km). Filters (open now, vegetarian, vegan, halal, kosher, gluten-free, wheelchair) and sort (distance or name) run on the client and never refetch. "Pick one for me" chooses at random from the filtered list. If nothing is found, the app offers a wider radius, the runner-up cuisine, sample places, or a retry.
- **Shareable state.** The whole session (phase, picks, seed, duel choices, winner, cuisine) is encoded in the URL hash. Reloading or sharing the link reopens the same place. The bracket is rebuilt by replaying the duel choices, so a tampered winner in the link is ignored. Share can optionally include the search location (off by default).
- **Architecture.** The state machine (`js/engine.js`) is a pure reducer. Geometry, Overpass parsing, filtering and opening hours (`js/geo.js`) and the network client (`js/net.js`) are pure or take injected I/O, so the tests run in Node. `js/app.js` wires them to the DOM. Random seeds come from `crypto.getRandomValues` in the app, never from the engine.
- **Offline.** The app shell is cached by the service worker. Restaurant results are cached in the browser for 24 hours. If the live services are unreachable, the app falls back to a stale cached result or to clearly labelled sample places.

## Data sources and attribution

- **Restaurants:** [OpenStreetMap](https://www.openstreetmap.org/copyright) data, queried through the [Overpass API](https://overpass-api.de/). Three public mirrors are tried in turn, with a 25 second server timeout and a 30 second client timeout per attempt. Results are capped at 150 per query.
- **Address search and pin labels:** [Nominatim](https://nominatim.org/) (OpenStreetMap Foundation). Search runs only when you submit the address, never on each keystroke. Requests are throttled to one per second and cached. Reverse geocoding runs only when you drop a pin, not while dragging.
- **Map tiles:** the OpenStreetMap tile server. Tiles are not prefetched or cached by the service worker, in line with the tile usage policy.
- **Map library:** [Leaflet](https://leafletjs.com/) 1.9.4, BSD-2-Clause, vendored unmodified in `js/vendor/leaflet/` with its LICENSE.
- **Required attribution,** shown on the map and in the Results footer: "Map & data © OpenStreetMap contributors (ODbL) · Search by Nominatim". The About sheet repeats it.
- **Sample places** (`js/sample-data.js`) are invented. Every name ends in "(sample)", and a banner appears whenever they are shown.
- **Untrusted data.** OSM tag values are written with `textContent` only, never `innerHTML`. Website links pass a check that allows only http and https.

## Privacy

- No analytics, advertising, tracking pixels or third-party scripts.
- The only third-party requests are to Overpass, Nominatim and the OpenStreetMap tile server, and each one is triggered by something you did (choosing a cuisine, centre, or radius). Check the Network tab to confirm.
- Location is requested only when you tap "Use my location". Coordinates go only to Overpass, Nominatim and the tile server (tiles reveal the area you are viewing).
- Your location is not written to the URL unless you tick "Include my search location" when sharing.
- Remembering a location is opt-in. It is stored only in this browser and is cleared when the option is turned off.
- What is stored in `localStorage`, all under the `wte:v1:` prefix: preferences; the last centre (opt-in only); the last 20 winners, shown as "Recent" and clearable from About; and a cache of restaurant results (up to 30 entries, 24 hours each).

## File layout

```
what-to-eat/
  SPEC.md                      build contract for the modules
  index.html                   shell, screen markup, CSP meta, script tags
  manifest.webmanifest         install metadata and icon list
  sw.js                        service worker (must sit at this folder's root for scope)
  README.md                    this file
  css/app.css                  all styles, tokens, dark mode, animation
  js/
    config.js                  endpoints, limits, defaults (CSP hosts must match)
    cuisines.js                the 29 cuisines and OSM synonyms
    sample-data.js             fictional offline places, placed relative to the centre
    rng.js                     seeded PRNG and shuffle
    engine.js                  state machine, bracket, hash codec
    geo.js                     distance, Overpass query and parse, filters, hours, formatting
    storage.js                 namespaced localStorage wrapper
    net.js                     Overpass and Nominatim clients, caching
    art.js                     inline-SVG tile art and map markers
    map-view.js                the only file that touches Leaflet
    pwa.js                     service worker registration and install and update prompts
    ui-pick.js, ui-duel.js, ui-results.js   screen renderers
    app.js                     controller: state, dispatch, render, hash, wiring
    vendor/leaflet/            Leaflet 1.9.4 (unmodified) and LICENSE
  icons/
    icon.svg                   master artwork
    icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, favicon-32.png
  tools/make-icons.js          renders the PNG icons from the same art (no dependencies)
../tests/                      node tests (at the repository root)
```

## Tests

Run from the repository root, not from inside `what-to-eat/`:

```sh
node --test tests/*.test.js
```

No dependencies are needed. The four test files load the modules from `what-to-eat/js/` directly:

- `what-to-eat-data.test.js`: cuisine data, colour contrast, sample-data rules
- `what-to-eat-engine.test.js`: RNG, reducer events, bracket invariants, hash round-trip
- `what-to-eat-geo.test.js`: distance, Overpass query and parse, opening hours, filters, formatting
- `what-to-eat-net.test.js`: caching, mirror fallback, rate limiting, abort, storage failures (fake fetch, sleep and clock)

## Icons

`icons/icon.svg` is the master art. The PNGs are generated from the same art by `tools/make-icons.js`. To regenerate:

```sh
node what-to-eat/tools/make-icons.js
```

The script keeps the art as a list of shapes, so if you edit `icon.svg`, make the same change in `artShapes()`. The script also checks that the art stays inside the maskable safe zone and fails if it does not.

## Maintenance notes

- **Bump the cache.** Whenever a file in the service worker's shell list changes, bump `CACHE` in `sw.js` (currently `wte-shell-v1`). Otherwise returning visitors keep the old shell.
- **Keep CSP in step.** The Content Security Policy meta tag in `index.html` must list the same hosts as `js/config.js`.
- **Deployment.** `.github/workflows/pages.yml` copies only named folders. It needs `cp -r what-to-eat site/what-to-eat` added to its "Assemble the site" step. Without that line the app is not published. Linking it from the root README is optional.
- **Cuisine data.** OSM tokens (`osmCuisine`) must be unique across all cuisines. The data test enforces this.

## Manual QA checklist

- [ ] Phone (375px) and desktop: no horizontal scroll; pick grid is 3 columns; duel stacks under 480px.
- [ ] Keep 1 goes straight to the winner. Keep 0 and reject 5 gives a duel of the rest (capped at 16 with a notice). Reject all: the main button is disabled and "Surprise me" still works.
- [ ] Keep 3, 5 or 7 (byes): correct match counts. Undo returns to Pick; browser Back mirrors Undo.
- [ ] Coin flip, keyboard left and right arrows, Tab, Enter and Space everywhere, visible focus rings. A screen reader announces "Thai versus Pizza" (aria-live polite) and the winner.
- [ ] Reduced motion: no confetti and no slide or zoom animations. Dark mode is readable. 200% zoom is usable.
- [ ] Results: geolocation allow, deny and timeout; address search ("Paris", "10001", "40.73,-73.98"); map click and pin drag refetch; radius steps refit the circle; filters and sort do not refetch.
- [ ] Zero results: Widen, runner-up and sample actions work. Overpass blocked (block the host in DevTools): falls back to a mirror, then to the sample banner. Airplane mode after first load: the shell loads, cached or sample results show, map tiles are grey but the list works.
- [ ] Attribution visible on the map and in the footer; About sheet privacy text; no requests to any other host (Network tab).
- [ ] A shared link reopens the same phase and winner; with "include location" it restores the centre.
- [ ] Install to home screen (Android Chrome, iOS Safari); update prompt appears after bumping `CACHE`.
- [ ] A malicious-looking OSM name (for example `<img onerror>`) renders as plain text (use a `parseOverpass` fixture in the console).
