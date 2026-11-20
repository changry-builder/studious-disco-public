# What to Eat — build spec (v1)

A static, no-build, no-API-key, mobile-first PWA in `what-to-eat/`. The user narrows food
cuisines by keeping/rejecting picture tiles, settles ties with left-vs-right showdowns until one
winner remains, then sees real nearby restaurants of that cuisine on a map and in a list.

This document is the contract. Four lanes build in parallel against it without talking to each
other. If something is ambiguous, follow the letter of this spec; do not edit another lane's file.

---

## 0. Ground rules (all lanes)

- Plain classic `<script>` tags, no modules, no bundler, no npm runtime deps. ES2020 is fine.
- One global namespace: `window.WTE`. Every file starts with
  `(function (root) { const WTE = (root.WTE = root.WTE || {}); ... })(typeof window !== "undefined" ? window : globalThis);`
  Lane A files additionally end with `if (typeof module !== "undefined") module.exports = WTE.<Name>;`
  and must `require()` their lane-A deps when `module` exists (see §3.0).
- Lane A files are **pure**: no DOM, no `window.*` access other than the namespace, no timers, no
  `Math.random`/`Date.now` (callers pass `seed` / `now`). `net.js` is the one exception: it does I/O
  but only through injected `fetch`, `storage`, `now`, `sleep`.
- All URLs relative (site is served at `/<repo>/what-to-eat/`). No leading `/`.
- **OSM data is untrusted.** Never put tag values into `innerHTML`. Use `textContent` /
  `createElement`. Only emit `website` links that pass `WTE.Geo.safeUrl` (http/https only).
- Location privacy: coordinates go only to Overpass, Nominatim and the tile server (tiles imply the
  viewport). No analytics, no other third-party requests. Location is not written to the URL hash
  unless the user explicitly shares "with location". Saved location only if the user opts in.
- Text: sentence case, plain English. Units: miles for `en-US`/`en-LR`/`my`, else km (`WTE.Geo.unitsFor(locale)`).

---

## 1. Product flow & screens

```
 PICK ──START──> DUEL ──last choice──> WINNER ──SHOW_RESULTS──> RESULTS
   │  (1 contender) ─────────────────────^                         │
   └─SURPRISE────────────────────────────^      USE_CUISINE(id) ───┘ (stays in RESULTS)
 BACK: RESULTS→WINNER→DUEL (undo last choice) / DUEL→PICK ; RESET: anywhere → PICK (fresh)
```

1. **Pick** — responsive grid of 29 illustrated cuisine tiles (3 cols phone, 4–6 wider). Each tile:
   big emoji over a cuisine-colored SVG pattern background, name, one-line blurb.
   Tap tile = toggle **keep** (check badge, raised). Small ✕ button = **reject** (tile greys,
   strikes, moves nothing — layout never reflows). Tap a rejected tile = back to undecided.
   Sticky bottom bar: "N kept · M out" + primary button whose label depends on
   `Engine.startPreview(state)`: "Eat {name}!" (1 contender) / "Showdown ({n})" / disabled
   "Everything's out" (0). Secondary: "Surprise me" (random non-rejected), "Keep all", "Reset".
   Rules: contenders = kept if ≥1 kept, else all undecided (rejecting is a valid way to narrow).
   If contenders > 16, the engine randomly (seeded) keeps 16 and sets `notice:"capped"`;
   UI shows "That's a lot — 16 of your 24 picked at random for the showdown."
2. **Duel** — two big cards, left vs right (stacked top/bottom under 480px wide, labelled
   "This" / "That"). Tap/click a card, ← / → keys (↑/↓ when stacked too), or swipe the card
   toward the center. Header: "Quarterfinal · match 2 of 4", progress bar `duelsPlayed/duelsTotal`.
   Buttons: Undo (disabled at first match; at first match "Back" returns to Pick), "Flip a coin"
   (seeded random side). Winning card does a short pop; loser slides out (reduced motion: fade).
3. **Winner** — champion art large, "Tonight: Thai." Runner-up chips (top 3 of standings).
   Buttons: "Find Thai nearby" (primary), "Rematch" (same contenders, new seed), "Start over".
   Confetti only when `prefers-reduced-motion: no-preference`.
4. **Results** — cuisine switcher (chips: winner + standings, plus "Other…" select of all 29).
   Location bar: address field + "Search" (submit only — no autocomplete, per Nominatim policy),
   "Use my location", hint "or tap the map to drop a pin". Radius slider (snap steps
   0.5, 1, 2, 3, 5, 8, 12, 25 km; default 2). Filter chips: Open now, Vegetarian, Vegan, Halal,
   Kosher, Gluten-free, Wheelchair. Sort: Distance | Name. "Pick one for me" re-roll button
   (random from filtered list; highlights on map + scrolls list). Share button.
   Layout: map 45vh on top + list below on phone; ≥900px: list left 380px, map right full height.
   Before any center is chosen: map shows the last saved center (if opted in) or a world view with
   an overlay card "Where are you eating?" [Use my location] [Enter an address] [Try the demo city].
   List cards: emoji, name, distance, open badge (Open / Closed / hours unknown), diet badges,
   address line, actions: Directions, Website, Call, "View on OSM". Tapping card ↔ marker sync.
   States: loading (skeleton list + map spinner, Cancel), empty, error, sample banner (§3.6).
   Empty state: "No {cuisine} spots within {r}." → [Widen to {next step}] [Try {runner-up}]
   [Show sample places] [Pick again]. With filters on and raw results > 0: "N places hidden by
   filters" [Clear filters].
5. **About sheet** (footer link): data attribution, privacy note, how it works.
   Persistent footer on Results: "Map & data © OpenStreetMap contributors (ODbL) · Search by Nominatim".

---

## 2. File tree and owner lanes

```
what-to-eat/
  SPEC.md                         (this file; nobody edits)
  index.html                      B  shell, screens' static markup, script tags in the order below, CSP meta
  manifest.webmanifest            C
  sw.js                           C  service worker (must live at what-to-eat/ root for scope)
  README.md                       D
  css/
    app.css                       B  all app styles, tokens, dark mode, animations
  js/
    config.js                     A  WTE.Config constants (endpoints, limits, defaults)
    cuisines.js                   A  WTE.Cuisines data (may be produced by the data/Haiku task, lane A owns)
    sample-data.js                A  WTE.SampleData bundled fake restaurants (offset-based, §3.6)
    rng.js                        A  WTE.Rng seeded PRNG + shuffle
    engine.js                     A  WTE.Engine state machine + bracket + hash codec
    geo.js                        A  WTE.Geo distance, Overpass query/parse, filters, hours, formatting
    storage.js                    A  WTE.Storage namespaced localStorage wrapper
    net.js                        A  WTE.Net Overpass + Nominatim clients (injected fetch), caching
    art.js                        B  WTE.Art inline-SVG tile art
    ui-pick.js                    B  WTE.UI.Pick
    ui-duel.js                    B  WTE.UI.Duel
    ui-results.js                 B  WTE.UI.Results
    app.js                        B  WTE.App controller: state, dispatch, render, hash, storage, wiring
    map-view.js                   C  WTE.MapView (only file that touches Leaflet `L`)
    pwa.js                        C  WTE.PWA SW registration, update + install prompts
    vendor/leaflet/leaflet.js     C  Leaflet 1.9.4 (unmodified, from npm leaflet@1.9.4 dist/)
    vendor/leaflet/leaflet.css    C  (B links it from index.html at this exact path)
    vendor/leaflet/LICENSE        C  BSD-2
  icons/
    icon.svg                      D  master art (plate + fork, brand colors)
    icon-192.png  icon-512.png    D
    icon-maskable-512.png         D  (safe zone: art within central 80%)
    apple-touch-icon.png          D  180×180
    favicon-32.png                D  (no .ico; index.html links icon.svg + this)
  tools/
    make-icons.js                 D  pure-Node (zlib) PNG rasterizer of the icon art; run once, commit PNGs
tests/                            (repo root, picked up by `node --test tests/*.test.js`)
  what-to-eat-engine.test.js      D
  what-to-eat-geo.test.js         D
  what-to-eat-net.test.js         D
  what-to-eat-data.test.js        D
```

Script order in `index.html` (B writes it exactly; all `defer`-less at end of `<body>`):
`js/vendor/leaflet/leaflet.js, js/config.js, js/cuisines.js, js/sample-data.js, js/rng.js,
js/engine.js, js/geo.js, js/storage.js, js/net.js, js/art.js, js/map-view.js, js/pwa.js,
js/ui-pick.js, js/ui-duel.js, js/ui-results.js, js/app.js`. `app.js` boots on `DOMContentLoaded`
(or immediately if already loaded) via `WTE.App.start(document.getElementById("app"))`.

**Not touched by any lane** (integration step, done by the orchestrator after merge):
`.github/workflows/pages.yml` needs `cp -r what-to-eat site/what-to-eat` in "Assemble the site";
optional link from root `README.md`.

CSP meta (B puts in `index.html`, hosts must match `WTE.Config`):
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: https://tile.openstreetmap.org;
connect-src 'self' https://overpass-api.de https://overpass.private.coffee https://overpass.kumi.systems https://nominatim.openstreetmap.org;
manifest-src 'self'; worker-src 'self'
```
(`'unsafe-inline'` styles are required by Leaflet's inline transforms.) No inline `<script>`.

---

## 3. Module contracts

Shared shapes:

```js
LatLng      = { lat: number, lng: number }           // degrees, WGS84
CuisineId   = string                                  // /^[a-z_]+$/, from §4
Marks       = { [CuisineId]: "keep" | "reject" }      // absent = undecided
```

### 3.0 Node loading (lane A)
Each lane-A file, when `module` exists, pulls its deps:
`const Config = WTE.Config || require("./config.js");` etc. Dep graph:
`config ← cuisines ← engine(rng, cuisines) ; geo(config, cuisines) ; net(config, geo, sample-data) ;
storage(config)`. `sample-data` and `cuisines` have no deps except config (optional).

### 3.1 `WTE.Config` (config.js)
```js
{
  VERSION: "1.0.0",
  STORAGE_PREFIX: "wte:v1:",
  MAX_CONTENDERS: 16,
  RADIUS_STEPS_M: [500, 1000, 2000, 3000, 5000, 8000, 12000, 25000],
  DEFAULT_RADIUS_M: 2000,
  MAX_RESULTS: 150,                      // Overpass `out ... 150`
  OVERPASS_ENDPOINTS: [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ],
  OVERPASS_TIMEOUT_S: 25,                // server [timeout:25]
  CLIENT_TIMEOUT_MS: 30000,              // per endpoint attempt
  CACHE_TTL_MS: 24 * 3600 * 1000,
  CACHE_MAX_ENTRIES: 30,
  NOMINATIM_URL: "https://nominatim.openstreetmap.org",
  NOMINATIM_MIN_INTERVAL_MS: 1100,       // policy: max 1 req/s
  TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  TILE_MAX_ZOOM: 19,
  ATTRIBUTION_HTML: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  DEMO_CENTER: { lat: 40.7306, lng: -73.9866, label: "East Village, New York (demo)" },
  FOOD_AMENITIES: ["restaurant", "fast_food", "cafe", "food_court", "ice_cream", "pub", "bar", "biergarten"],
}
```

### 3.2 `WTE.Cuisines` (cuisines.js)
`WTE.Cuisines = { LIST: Cuisine[], byId(id) → Cuisine|null, ids() → CuisineId[], forOsmValue(token) → CuisineId|null }`
```js
Cuisine = {
  id: "thai",                         // unique, matches §4
  name: "Thai",                       // display, ≤ 18 chars
  emoji: "🌶️",                        // single grapheme, Unicode ≤ 14 (renders on iOS 15+/Android 12+)
  color: "#E4572E",                   // tile base color; white text must reach 4.5:1 on it
  accent: "#FFD166",                  // pattern color for WTE.Art
  pattern: "dots",                    // one of "dots"|"stripes"|"waves"|"grid"|"zigzag"|"rings"
  blurb: "Curries, noodles, basil heat.",   // ≤ 40 chars
  tags: ["asian", "spicy"],           // from: asian, european, american, latin, middle_eastern, african,
                                      // spicy, comfort, healthy, quick, sweet, drinks, breakfast, veggie
  osmCuisine: ["thai"],               // normalized OSM cuisine=* tokens (lowercase, spaces→_), unique ACROSS all cuisines
  osmExtra: [],                       // [[key, value], ...] tags that match without a cuisine tag, e.g. [["amenity","cafe"]]
}
```
`forOsmValue` takes one normalized token. Tokens not listed anywhere map to null (ignored).

### 3.3 `WTE.Rng` (rng.js)
- `mulberry32(seed:uint32) → () => float in [0,1)`
- `shuffle(array, seed) → new array` (Fisher–Yates using mulberry32; input untouched)
- `pick(array, seed) → element | undefined`
- `hashSeed(string) → uint32` (FNV-1a), for turning text into seeds.
Determinism is tested: same seed ⇒ same output, across Node and browsers.

### 3.4 `WTE.Engine` (engine.js) — pure reducer
```js
State = {
  v: 1,
  phase: "pick" | "duel" | "winner" | "results",
  marks: Marks,
  seed: uint32,                 // bracket seed, set by START/REMATCH
  contenders: CuisineId[],      // snapshot at START, already shuffled & capped (bracket order)
  choices: ("L"|"R")[],         // one per played duel, in play order (the whole duel history)
  winner: CuisineId | null,
  cuisine: CuisineId | null,    // cuisine shown in results (defaults to winner)
  notice: null | "capped" | "none-left" | "surprise" | "single",
}
```
Functions:
- `initialState() → State` (phase "pick", empty marks, seed 0, everything else empty/null).
- `reduce(state, event) → State` — never mutates; unknown/invalid events return `state` unchanged
  (same reference). Events:

| event | valid in | effect |
|---|---|---|
| `{type:"KEEP", id}` | pick | marks[id]="keep" |
| `{type:"REJECT", id}` | pick | marks[id]="reject" |
| `{type:"CLEAR", id}` | pick | delete marks[id] |
| `{type:"TOGGLE", id}` | pick | undecided→keep, keep→undecided, reject→undecided |
| `{type:"KEEP_ALL"}` | pick | every id "keep" |
| `{type:"CLEAR_ALL"}` | pick | marks={} |
| `{type:"START", seed}` | pick | c=`contendersFor(marks)`; 0 → notice "none-left", stay; 1 → phase winner, winner=c[0], notice "single"; ≥2 → shuffle(c, seed), cap to MAX_CONTENDERS (notice "capped" if cut), phase duel, choices=[] |
| `{type:"SURPRISE", seed}` | pick | pool=non-rejected ids (all ids if none); winner=pick(pool,seed); contenders=[winner]; phase winner; notice "surprise" |
| `{type:"CHOOSE", side:"L"\|"R"}` | duel | push choice; if bracket done → phase winner, winner set |
| `{type:"UNDO"}` | duel, winner | duel: pop last choice (if none: phase pick). winner (from a bracket): phase duel, pop last choice. winner (single/surprise): phase pick |
| `{type:"REMATCH", seed}` | winner, results | same contenders, reshuffled with seed, choices=[], phase duel (if <2 contenders → phase pick) |
| `{type:"SHOW_RESULTS"}` | winner | phase results, cuisine=winner |
| `{type:"USE_CUISINE", id}` | results | cuisine=id (any valid id) |
| `{type:"BACK"}` | any | results→winner; winner→same as UNDO; duel→same as UNDO; pick→no-op |
| `{type:"RESET"}` | any | initialState() |

  `notice` is cleared to null by every successful event that doesn't set it.
- `contendersFor(marks) → CuisineId[]` in `Cuisines.LIST` order: kept if any kept, else undecided.
- `startPreview(state) → { count, label: "none"|"single"|"duel", willCap: boolean }` (count after cap).
- `bracket(state) → Bracket` (derived purely from `contenders` + `choices`; replay):
```js
Bracket = {
  size: n, rounds: R = ceil(log2 n), byes: 2^R − n,
  round: 1..R,                    // current round (R when done)
  roundName: "Final"|"Semifinal"|"Quarterfinal"|"Round of 16",
  matchIndex: 0-based in round, matchesInRound,
  current: { left: CuisineId, right: CuisineId } | null,  // null when done
  duelsPlayed: choices.length, duelsTotal: n − 1,
  done: boolean, winner: CuisineId | null,
  standings: CuisineId[],         // winner first, then final loser, then losers of earlier rounds
                                  // (later-round losers first; ties in the same round keep bracket order);
                                  // undecided entrants after, in contender order. Always length n.
  history: [{ round, left, right, winner }],
}
```
  **Bracket algorithm (normative):** `entrants = contenders` (already shuffled). Round 1: the first
  `byes` entrants advance automatically (no duel, no choice consumed); the remaining `n − byes`
  (always even) play in order as pairs (e[b], e[b+1]), (e[b+2], e[b+3]) …; left = first of pair.
  Next round's order = `[...byeAdvancers, ...matchWinners in match order]`; every later round has
  2^k players and pairs sequentially. Each choice consumes exactly one duel. n=2 ⇒ 1 duel, n=16 ⇒ 15.
  `choices.length > n−1` is impossible (extra CHOOSE ignored).
- `runnerUps(state, k=3) → CuisineId[]` = `bracket(state).standings.slice(1, 1+k)` (for single/
  surprise: empty).
- `encodeHash(state, extra?) → string` / `decodeHash(str) → { state, extra } | null`
  Format (no leading `#`): `v=1&p=duel&s=<seed base36>&k=<kept ids ,>&x=<rejected ids ,>&c=<contenders ,>&h=<choices "LRRL">&w=<winner>&q=<cuisine>`
  plus `extra`: `{ at?: LatLng (5 decimals), r?: radiusM }` as `&at=lat,lng&r=2000`.
  Omit empty params. Decoder validates every id against `Cuisines`, drops unknown ids, rebuilds
  state by replaying (never trusts `w`; recomputes winner), returns null on garbage / wrong `v`.
  Round-trip property: `decodeHash(encodeHash(s)).state` deep-equals `s` minus `notice`.

### 3.5 `WTE.Geo` (geo.js) — pure
- `distanceM(a:LatLng, b:LatLng) → number` haversine, R = 6371008.8.
- `bboxAround(center, radiusM) → [south, west, north, east]`.
- `clampLatLng(p) → LatLng` (lat −85..85, lng wrapped to −180..180); `isLatLng(p) → boolean`.
- `parseLatLngText(text) → LatLng | null` accepts "40.73, -73.98", "40.73 -73.98", with ° / N S E W.
- `normalizeCuisineTokens(value:string) → string[]` split on `;` and `,`, trim, lowercase, spaces→`_`, dedupe.
- `cuisineIdsForTags(tags) → CuisineId[]` (tokens via `Cuisines.forOsmValue`, plus any cuisine whose
  `osmExtra` [k,v] matches tags; plus "veggie" if `diet:vegan|diet:vegetarian === "only"`). Order = LIST order.
- `buildOverpassQuery(cuisineId, center, radiusM, opts?) → string`, exactly this shape
  (r rounded to integer, coords to 5 decimals, `amen` = FOOD_AMENITIES joined `|`, `toks` =
  osmCuisine regex-escaped joined `|`):
```
[out:json][timeout:25];
(
  nwr["amenity"~"^(amen)$"]["cuisine"~"(^|;) *(toks) *(;|$)",i](around:R,LAT,LNG);
  nwr["K"="V"](around:R,LAT,LNG);            // one line per osmExtra pair
);
out center tags 150;
```
  For "veggie" add `nwr["amenity"~"^(amen)$"]["diet:vegan"="only"](around…)` and same for `diet:vegetarian`.
  Unknown cuisineId throws `Error("unknown cuisine")`.
- `parseOverpass(json, center, cuisineId) → Restaurant[]` — accepts `{elements:[...]}`; uses
  `el.lat/lon` or `el.center.lat/lon`; skips elements without coords or without `name`; dedupes by
  `id`, then by (same lowercase name within 30 m — keep the element with more tags); sorted by distance ascending. Throws on non-object input; `{elements:[]}` → `[]`.
  If `json.remark` contains "runtime error" → throws `Error("overpass-runtime")`.
```js
Restaurant = {
  id: "node/123",                        // `${type}/${id}`; sample: "sample/thai-3"
  name: string,
  lat, lng, distanceM: number,           // from center passed to parseOverpass/sampleRestaurants
  cuisineIds: CuisineId[],               // may be empty for osmExtra-only hits → then [cuisineId]
  primaryCuisine: CuisineId,             // the queried cuisineId
  cuisineLabel: string,                  // raw cuisine tag prettified "pizza; italian" → "Pizza, Italian", or ""
  kind: string,                          // amenity or shop value, e.g. "restaurant", "bakery"
  address: string,                       // "12 Main St, Springfield" from addr:housenumber/street/city; "" if none
  phone: string | null,                  // phone || contact:phone, first of ";" list
  website: string | null,                // website || contact:website, passed through safeUrl
  openingHours: string | null,           // raw opening_hours
  diet: { vegetarian, vegan, halal, kosher, gluten_free },   // each "only"|"yes"|"limited"|"no"|null
  wheelchair: "yes" | "limited" | "no" | null,
  takeaway: boolean | null, delivery: boolean | null,
  osmUrl: string | null,                 // https://www.openstreetmap.org/node/123 ; null for sample
  source: "live" | "cache" | "sample",
}
```
- `safeUrl(s) → string | null` (adds `https://` to bare domains; rejects other schemes / spaces).
- `parseOpeningHours(str) → Schedule | null` supported subset: `24/7`; rules separated by `;`;
  each rule `[days] [times|off|closed]`; days `Mo Tu We Th Fr Sa Su`, ranges `Mo-Fr`, wrap `Fr-Mo`,
  lists `Mo,We,Fr`; times `HH:MM-HH:MM` comma lists, end > 24:00 or end < start ⇒ past midnight;
  rule without days = every day; later rules override earlier ones for the same day (OSM semantics).
  Anything else (PH, SH, months, weeks, sunrise, `"…"` comments, `+`) ⇒ return null (unknown).
  `Schedule = { days: [ [ [startMin, endMin], ... ] × 7 ] }` index 0 = Monday, minutes 0..2880.
- `isOpenAt(str|Schedule, date:Date) → true | false | null` uses date's local day/time; checks
  previous day's past-midnight spans. null when unparseable/missing.
- `openStatus(r, date) → { open: boolean|null, label: "Open"|"Closed"|"Hours unknown"|"Open 24/7", closesAt?: "22:00" }`.
- `filterRestaurants(list, f:Filters, date) → Restaurant[]`
  `Filters = { openNow: bool, vegetarian: bool, vegan: bool, halal: bool, kosher: bool, glutenFree: bool, wheelchair: bool }`
  diet filter passes when value ∈ {"yes","only","limited"} (vegetarian also passes if vegan does);
  `openNow` passes only `true` (unknown excluded); wheelchair passes "yes"|"limited".
- `sortRestaurants(list, by:"distance"|"name") → new array` (name: `localeCompare`, base sensitivity).
- `unitsFor(locale) → "mi"|"km"`; `formatDistance(m, units) → "350 m" | "1.2 km" | "0.2 mi" | "800 ft"`
  (km: <1000 m → "N m" rounded to 10; mi: <0.1 mi → feet rounded to 50).
- `nextRadius(radiusM) → number | null` next step in RADIUS_STEPS_M, null at max.
- `directionsUrl(r, platform:"apple"|"other") → string` apple: `https://maps.apple.com/?daddr=LAT,LNG`;
  other: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`. (User-initiated link only.)
- `parseNominatim(json) → Place[]`, `Place = { label: string, lat, lng, bbox: [s,w,n,e] | null }`.
- `sampleRestaurants(cuisineId, center, sampleData = WTE.SampleData) → Restaurant[]` (§3.6), source "sample".

### 3.6 `WTE.SampleData` (sample-data.js)
Fictional places placed **relative to any center**, so the demo works anywhere offline.
```js
WTE.SampleData = {
  NOTE: "Fictional sample places for demo/offline use.",
  places: [
    { key: "thai-1", cuisine: "thai", name: "Lemongrass Lane (sample)", dx: 220, dy: -140,  // metres east / north of center
      tags: { amenity: "restaurant", cuisine: "thai", "diet:vegetarian": "yes",
              opening_hours: "Mo-Su 11:00-22:00", "addr:street": "Sample Street", "addr:housenumber": "12" } },
    ...
  ],
}
```
Rules: ≥3 places per cuisine id (≥ 87 total), every name ends with " (sample)", obviously invented,
no real chains; `dx, dy` within ±2500 m (some within 500 m so the default radius shows results);
mix of opening_hours forms (incl. one unparseable and one missing per ~5) and diet tags so every
filter has hits. `sampleRestaurants` converts offsets (dy/111320 deg lat, dx/(111320·cos lat) deg lng),
builds Restaurants with the same normalizer as live data, and returns ALL places for the cuisine
(sorted by distance); callers filter by radius using `distanceM`. Sample results always render with the banner
"Showing sample places — couldn't reach OpenStreetMap" (or "…demo" when chosen by the user).

### 3.7 `WTE.Storage` (storage.js)
`create(backend = safe localStorage | in-memory fallback) → Store`
`Store = { get(key, fallback), set(key, value) → boolean, remove(key), keys(prefix) → string[] }`
JSON-encoded values, all keys prefixed `Config.STORAGE_PREFIX`; every access wrapped in try/catch
(private mode, quota) — failures return fallback / false, never throw.
Keys used by the app (B reads/writes; A's net.js uses `cache:*`):
`prefs` → `{ radiusM, filters: Filters, sort, rememberLocation: false }`
`lastCenter` → `{ lat, lng, label }` (written only when `prefs.rememberLocation`; cleared when turned off)
`history` → `[{ cuisine, at: ISOString }]` last 20 winners (shown as "Recent" on Pick; clearable in About)
`cache:<key>` → `{ t: ms, restaurants: Restaurant[] }` and `cache:index` → LRU key list.

### 3.8 `WTE.Net` (net.js)
`create({ fetch, store, now = Date.now, sleep = ms => Promise, config = WTE.Config }) → Client`
```js
Client.findRestaurants(cuisineId, center, radiusM, { signal } = {})
  → Promise<{ restaurants: Restaurant[], source: "live"|"cache"|"sample",
              endpoint: string|null, error: null|"offline"|"timeout"|"rate-limited"|"server"|"bad-response",
              stale: boolean }>
Client.geocode(query, { signal, lang }) → Promise<Place[]>        // throws Error("rate-limited"|"offline"|"server")
Client.reverse(center, { signal, lang }) → Promise<string|null>   // short label, null on any failure
Client.clearCache()
```
Behaviour (normative):
- Cache key `${cuisineId}|${lat.toFixed(3)}|${lng.toFixed(3)}|${radiusM}`. Fresh (< TTL) cache hit
  → return `source:"cache"`, no network. Distances are recomputed against the requested center.
- In-flight dedupe: identical key while a request is pending returns the same promise.
- POST `body: "data=" + encodeURIComponent(query)`, header `Content-Type: application/x-www-form-urlencoded`.
  Endpoints tried in order starting from the last one that succeeded (remembered in memory).
  Per attempt timeout `CLIENT_TIMEOUT_MS` via AbortController (linked to caller's `signal`).
  429 → `sleep(2000)` then next endpoint; 504/5xx/network/timeout/bad JSON → next endpoint.
  Caller abort → reject with `AbortError` immediately (no fallback).
- All endpoints failed → if a stale cache entry exists return it (`source:"cache", stale:true`), else
  return `sampleRestaurants(...)` filtered to `radiusM` with `source:"sample"` and `error` set.
  `findRestaurants` never rejects except on abort.
- Successful live result (even empty) is cached; LRU trimmed to `CACHE_MAX_ENTRIES`.
- Nominatim: GET `${NOMINATIM_URL}/search?format=jsonv2&limit=5&q=…&accept-language=…`,
  reverse: `/reverse?format=jsonv2&zoom=17&lat=…&lon=…`. Client-side throttle: calls are spaced
  ≥ `NOMINATIM_MIN_INTERVAL_MS` (queued via `sleep`); results cached in memory per query.
  No custom headers (browser Referer identifies the app; avoids CORS preflight). Never call on keystroke.
  Before calling `geocode`, B first tries `Geo.parseLatLngText` (no network for raw coordinates).

### 3.9 `WTE.Art` (art.js, lane B)
`tileSvg(cuisine, { size = 160 }) → string` — SVG markup built only from Cuisine fields (trusted
bundled data), background `color`, `pattern` in `accent`, emoji as `<text>`. `markerHtml(cuisine)` →
small circular badge HTML for map markers (`<span class="wte-pin" style="--c:#hex">🌶️</span>`).

### 3.10 `WTE.MapView` (map-view.js, lane C) — the only Leaflet consumer
```js
WTE.MapView = {
  isAvailable() → boolean,                         // typeof L !== "undefined"
  init(el: HTMLElement, opts) → void,              // idempotent; second call = no-op
    // opts = { center?: LatLng, zoom?: number (default 2 if no center, else fits radius),
    //          radiusM: number,
    //          onPinMove(center: LatLng, reason: "click"|"drag"|"locate") — user moved the search pin,
    //          onSelect(restaurantId: string) — user tapped a marker,
    //          markerHtml(r: Restaurant) → string  — B passes WTE.Art.markerHtml-based fn,
    //          labels: { pin: "Search center", you: "You are here" } }
  setCenter(center: LatLng, { fit = true } = {}) → void,   // moves pin + radius circle; fit → fitBounds(circle)
  setRadius(radiusM) → void,                       // redraws circle; refits if pin visible
  setUserLocation(p: LatLng | null, accuracyM?) → void,     // blue dot + accuracy ring
  setRestaurants(list: Restaurant[]) → void,       // replaces markers (L.divIcon with markerHtml); keyboard-focusable
  highlight(id: string | null, { pan = true, openPopup = true } = {}) → void,
  fitToResults() → void,                           // bounds of pin + markers, padding 32px
  invalidateSize() → void,                         // call after container shown/resized
  setInteractive(on: boolean) → void,              // disables click-to-drop while loading overlays
  destroy() → void,
}
```
- Pin: draggable `L.marker` with divIcon (`.wte-center-pin`); map `click` moves it; both fire
  `onPinMove` (drag: on `dragend` only). `setCenter` never fires `onPinMove`.
- Popup content built with DOM nodes + `textContent` only: name, distance (C formats it with
  `WTE.Geo.formatDistance(r.distanceM, WTE.Geo.unitsFor(navigator.language))`), "Details" button that
  calls `onSelect(id)`.
- Tile layer `Config.TILE_URL`, `maxZoom TILE_MAX_ZOOM`, attribution `Config.ATTRIBUTION_HTML`
  (Leaflet attribution control must stay visible; keep Leaflet prefix). `crossOrigin` not set.
- Keyboard: Leaflet defaults + markers get `keyboard: true`, `title: name`, `alt: name`.
- Reduced motion: pass `zoomAnimation/fadeAnimation/markerZoomAnimation: false` when
  `matchMedia("(prefers-reduced-motion: reduce)")` matches; `flyTo` never used (use `setView`/`fitBounds`).
- If `isAvailable()` is false all methods are no-ops and B shows list-only mode.

### 3.11 `WTE.PWA` (pwa.js, lane C)
```js
WTE.PWA = {
  register() → void,            // only if 'serviceWorker' in navigator and location.protocol === "https:" or localhost
  onUpdateReady(cb: (apply: () => void) => void),   // apply() posts {type:"SKIP_WAITING"} then reloads on controllerchange
  canInstall() → boolean,       // a captured beforeinstallprompt exists
  promptInstall() → Promise<"accepted"|"dismissed"|"unavailable">,
  onInstallAvailable(cb: () => void),
  isStandalone() → boolean,
}
```
`sw.js`: `const CACHE = "wte-shell-v1";` precache exactly the shell list: `./`, `index.html`,
`manifest.webmanifest`, `css/app.css`, every `js/*.js` in §2 script order, `js/vendor/leaflet/leaflet.css`,
`icons/icon.svg`, `icons/icon-192.png`, `icons/favicon-32.png`. Fetch: same-origin GET → cache-first,
then network update in background (stale-while-revalidate); navigation requests fall back to cached
`index.html`. **Cross-origin requests (Overpass, Nominatim, tiles) are not intercepted** — no
`respondWith` (OSM tile policy forbids offline prefetching; app-level cache handles Overpass).
`activate` deletes caches whose name starts with `wte-` and ≠ CACHE; handles `SKIP_WAITING` message.
Bump `CACHE` whenever any shell file changes (README states this).

`manifest.webmanifest`: `{ "id": "./", "name": "What to Eat", "short_name": "What to Eat",
"start_url": "./", "scope": "./", "display": "standalone", (no "orientation"),
"background_color": "#FFF8F0", "theme_color": "#E4572E", "icons": [192 png "any", 512 png "any",
maskable-512 png "maskable", icon.svg "any" sizes "any"] , "categories": ["food","lifestyle"] }`.

### 3.12 `WTE.App` and UI modules (lane B)
`WTE.App.start(rootEl)`; internal store `{ engine: State, results: { center, centerLabel, radiusM,
filters, sort, status: "idle"|"locating"|"loading"|"ready"|"empty"|"error", data: Restaurant[],
source, error, selectedId } }`. Single `dispatch(event)` → `Engine.reduce` → `render()` →
`history.replaceState` with `Engine.encodeHash` (pushState on phase change so the browser Back
button maps to `BACK`; `popstate` → decode & adopt). On load: `decodeHash(location.hash)` if present.
Each UI module: `WTE.UI.X.render(container, viewModel, actions)`; modules never call Net/MapView
directly — `app.js` does. Seeds come from `crypto.getRandomValues` in app.js.
Results flow in app.js: center change / radius change / cuisine change ⇒ abort previous request,
`MapView.setCenter`, `Net.findRestaurants`, then `Geo.filterRestaurants` + `sortRestaurants`
client-side (filters/sort never refetch). Radius slider changes debounce 400 ms.
Geolocation: only on button press; `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }`;
denied → "Location is off for this site — enter an address or tap the map." and focus the address
input; unavailable/timeout → retry offer; hide the button when `!isSecureContext || !navigator.geolocation`.
Share: `navigator.share({ title, url })` if available else copy URL to clipboard + toast; dialog
checkbox "Include my search location" (default off) adds `at`/`r`.

---

## 4. Cuisine ids (29) and OSM synonyms

`osmCuisine` tokens must be unique across all rows (data test enforces). Emoji/colors are
suggestions for the data task; ids, names, tokens and extras are normative.

| id | name | emoji | osmCuisine tokens | osmExtra |
|---|---|---|---|---|
| pizza | Pizza | 🍕 | pizza | |
| italian | Italian | 🍝 | italian, pasta, trattoria, italian_pizza | |
| mexican | Mexican | 🌮 | mexican, tex-mex, tex_mex, tacos, taco, burrito | |
| chinese | Chinese | 🥟 | chinese, cantonese, sichuan, szechuan, dim_sum, dumpling, dumplings, hot_pot, hunan, shanghainese, taiwanese | |
| japanese | Japanese | 🍣 | japanese, sushi, ramen, izakaya, udon, soba, teriyaki, tonkatsu, yakitori | |
| korean | Korean | 🍲 | korean, korean_bbq, bibimbap | |
| thai | Thai | 🌶️ | thai | |
| vietnamese | Vietnamese | 🍜 | vietnamese, pho, banh_mi | |
| indian | Indian | 🍛 | indian, curry, punjabi, south_indian, north_indian, tandoori, biryani, pakistani, nepalese, bangladeshi, sri_lankan | |
| burger | Burgers | 🍔 | burger, hamburger | |
| american | American | 🌭 | american, diner, hot_dog, soul_food, southern, cajun, new_american | |
| bbq | Barbecue | 🍖 | barbecue, bbq, smokehouse | |
| steak | Steakhouse | 🥩 | steak_house, steak, steakhouse | |
| chicken | Chicken & wings | 🍗 | chicken, fried_chicken, wings, chicken_wings, rotisserie | |
| seafood | Seafood | 🦞 | seafood, fish, fish_and_chips, oyster, poke, hawaiian | |
| sandwich | Sandwiches | 🥪 | sandwich, sub, deli, wrap, wraps, bagel | |
| mediterranean | Mediterranean | 🫒 | mediterranean, greek, gyro, gyros, cypriot | |
| middle_eastern | Middle Eastern | 🧆 | middle_eastern, lebanese, turkish, kebab, doner, shawarma, falafel, persian, iranian, israeli, arab, syrian, afghan | |
| spanish | Spanish & tapas | 🥘 | spanish, tapas, paella, portuguese | |
| french | French | 🥐 | french, bistro, brasserie, crepe, crepes, creperie | |
| german | German | 🥨 | german, austrian, bavarian, schnitzel, currywurst | [["amenity","biergarten"]] |
| caribbean | Caribbean | 🌴 | caribbean, jamaican, cuban, puerto_rican, haitian, dominican, trinidadian | |
| latin | Latin American | 🫓 | latin_american, peruvian, brazilian, colombian, venezuelan, arepa, arepas, salvadoran, argentinian, argentine, empanada, empanadas | |
| african | African | 🫘 | african, ethiopian, eritrean, nigerian, west_african, somali, senegalese, moroccan | |
| veggie | Veggie & vegan | 🥗 | vegetarian, vegan, salad, plant_based | (+ diet:*=only, §3.5) |
| breakfast | Breakfast & brunch | 🍳 | breakfast, brunch, pancake, pancakes, waffle, waffles | |
| coffee | Coffee & tea | ☕ | coffee_shop, coffee, tea, bubble_tea, juice, smoothie | [["amenity","cafe"]] |
| dessert | Sweets & ice cream | 🍦 | ice_cream, dessert, desserts, frozen_yogurt, gelato, donut, doughnut, donuts, cake, chocolate | [["amenity","ice_cream"],["shop","confectionery"]] |
| bakery | Bakery | 🥖 | bakery, pastry, patisserie | [["shop","bakery"],["shop","pastry"]] |

Notes: generic tokens (`asian`, `international`, `regional`, `fusion`, `local`) are deliberately
unmapped. Colors: 29 distinct hues, each ≥ 4.5:1 against white text (data test checks contrast).

---

## 5. Test plan (lane D; `node --test tests/*.test.js`, no deps)

Tests `require("../what-to-eat/js/<file>.js")`. Lane D writes tests from this spec, not from code.

**what-to-eat-data.test.js** — 24 ≤ LIST.length ≤ 30; ids unique & `/^[a-z_]+$/`; ids equal §4 set;
required fields/types; blurb ≤ 40, name ≤ 18; pattern in allowed set; tags in allowed set;
osmCuisine tokens normalized & globally unique; `forOsmValue` round-trips every token; color hex &
WCAG contrast vs #FFFFFF ≥ 4.5; SampleData: ≥3 per cuisine, unique keys, names end "(sample)",
|dx|,|dy| ≤ 2500, every cuisine has one within 500 m, every Filters key has ≥1 matching sample place.

**what-to-eat-engine.test.js** — Rng determinism (fixed seed ⇒ fixed sequence snapshot), shuffle is a
permutation and doesn't mutate. Reducer: invalid events return same ref; KEEP/REJECT/TOGGLE/CLEAR;
START with 0 kept + some undecided ⇒ undecided become contenders; reject all ⇒ notice "none-left",
phase stays pick; exactly 1 contender ⇒ winner, notice "single"; keep all 29 ⇒ 16 contenders,
notice "capped"; for every n in 2..16 and several seeds: duelsTotal = n−1, playing any L/R sequence
of length n−1 ends done with a winner that is a contender, each contender appears in exactly one
`current` before losing (except byes), byes = 2^R−n and bye entrants skip round 1, standings is a
permutation of contenders with winner first and final loser second; extra CHOOSE ignored; UNDO
restores previous `current` exactly; UNDO at first duel ⇒ pick (marks preserved); UNDO from winner
⇒ duel at last match; REMATCH keeps contenders set, resets choices; SURPRISE never picks a rejected
id (unless all rejected); BACK chain results→winner→duel; RESET. Hash: round-trip for states in each
phase; unknown ids dropped; tampered `w` ignored (winner recomputed); garbage/`v=2` ⇒ null; `at`/`r` extra.

**what-to-eat-geo.test.js** — distance (NYC–LA ≈ 3936 km ±0.5%, same point 0); bbox symmetric;
parseLatLngText variants & rejects; normalizeCuisineTokens ("Pizza; Italian ,burger" →
["pizza","italian","burger"]); cuisineIdsForTags incl. osmExtra & diet only; buildOverpassQuery
contains `around:2000,40.73060,-73.98660`, every token, escapes `-`, extra lines, veggie diet lines,
throws on unknown id; parseOverpass on a fixture (node + way with center + no-name + no-coords +
duplicate) ⇒ correct count, ids, distance-sorted, address/phone/website/diet mapping, unsafe
`javascript:` website ⇒ null, runtime-error remark throws; opening hours: `24/7`, `Mo-Fr 09:00-17:00`
(Wed 10:00 open, Sat closed), `Mo-Su 18:00-02:00` (Tue 01:00 open via Monday spill), `Fr-Mo`,
`Mo,We 11:00-14:00,17:00-22:00`, `Mo-Su 10:00-22:00; Su off`, `PH off`/`sunrise-sunset`/`""` ⇒ null;
filterRestaurants each flag & openNow excludes unknown; sort by name locale; formatDistance both
units & boundaries; unitsFor("en-US")="mi", ("en-GB")="km"; nextRadius; parseNominatim fixture;
sampleRestaurants offsets ≈ dx/dy within 1 m via distanceM.

**what-to-eat-net.test.js** (fake fetch/sleep/now, in-memory store) — first endpoint OK ⇒ live +
cached; second call ⇒ cache without fetch; TTL expiry refetches; 429 then OK ⇒ uses mirror 2 and
calls sleep(2000); all fail ⇒ sample with error, never rejects; stale cache preferred over sample;
abort rejects AbortError; in-flight dedupe (one fetch for two concurrent calls); LRU trims to 30;
POST body encoding; geocode builds URL with `format=jsonv2&limit=5`, throttles (two calls ⇒ sleep ≥1100
between), caches identical query; reverse returns null on failure; Storage with throwing backend never throws.

### Manual QA checklist (README carries a copy)
- [ ] Phone (375px) and desktop: no horizontal scroll; pick grid 3 cols; duel stacks under 480px.
- [ ] Keep 1 → straight to winner. Keep 0, reject 5 → duel of the rest (capped at 16 with notice). Reject all → disabled CTA + "Surprise me" still works (picks any).
- [ ] Keep 3, 5, 7 (byes) → correct match counts; Undo back to Pick; browser Back mirrors Undo.
- [ ] Coin flip, keyboard ←/→, Tab/Enter/Space everywhere, visible focus rings, screen reader announces "Thai versus Pizza" (aria-live polite) and winner.
- [ ] Reduced motion: no confetti, no slide/zoom animations. Dark mode readable. 200% zoom usable.
- [ ] Results: geolocation allow / deny / timeout; address search ("Paris", "10001", "40.73,-73.98"); map click and pin drag refetch; radius steps refit circle; filters/sort without refetch.
- [ ] Zero results → Widen / runner-up / sample work. Overpass blocked (DevTools block host) → mirror then sample banner. Airplane mode after first load → app shell loads, sample/cached results, map tiles grey but list usable.
- [ ] Attribution visible on map and footer; About sheet privacy text; no requests to any other host (Network tab).
- [ ] Share link reopens same phase/winner; with "include location" restores center.
- [ ] Install to home screen (Android Chrome, iOS Safari); update toast after bumping CACHE.
- [ ] Malicious-looking OSM name (`<img onerror>`) renders as text (use a parseOverpass fixture via console).

---

## 6. Lane task lists (summary)

- **A**: config, cuisines (§4 table → full objects), sample-data (≥87 places), rng, engine, geo, storage, net. Pure + UMD. Run `node --test tests/*.test.js` once D's tests land; fix lane-A code, not tests, unless a test contradicts this spec.
- **B**: index.html (CSP, landmarks: `<header>`, `<main id="app">`, `<footer>`; one `<section>` per screen, `hidden` toggling; `<noscript>` message), app.css (tokens, light/dark, 44px touch targets, focus-visible, `prefers-reduced-motion`, safe-area insets), art.js, ui-*.js, app.js. Screen changes move focus to the screen `<h1>`. Toasts in an `aria-live` region.
- **C**: vendor Leaflet 1.9.4 (`npm pack leaflet@1.9.4`, copy `dist/leaflet.js` + `dist/leaflet.css` + LICENSE; do not modify), map-view.js, pwa.js, sw.js, manifest. Marker/pin CSS lives in app.css (B) using classes `.wte-pin`, `.wte-center-pin`, `.wte-user-dot`, `.wte-pin.is-active` — C only emits these class names.
- **D**: the four test files, README.md (what it is, how it works, data sources & attribution, privacy, how to run tests, cache bump note, QA checklist), icons + tools/make-icons.js.

---

## 7. Risks & decisions log

1. **Overpass reliability** — public, rate-limited, sometimes slow. Mitigations: 3 mirrors, client cache 24 h keyed at ~100 m grid, in-flight dedupe, result cap 150, `[timeout:25]`, stale-cache then sample fallback; requests only on explicit center/radius/cuisine changes (debounced).
2. **Nominatim policy** — ≤1 req/s, no autocomplete, attribution, no bulk. We search on submit only, throttle client-side, cache, and reverse-geocode only on pin drop (not drag).
3. **OSM tile policy** — attribution required, no offline prefetch: SW never intercepts tiles; browser HTTP cache only. If traffic grows, swap `TILE_URL` for a keyless-friendly provider (one config line).
4. **Bracket length** — n−1 duels; capped at 16 contenders (15 duels) to avoid fatigue. Bracket state is (contenders, choices) and fully derived by replay ⇒ trivial undo, deep links, and tests.
5. **Randomness purity** — engine takes seeds in events; app.js supplies `crypto.getRandomValues`. Tests are deterministic.
6. **Sample data honesty** — fictional, "(sample)" in every name, banner whenever shown, offsets around the user's center so the demo works anywhere without pretending to be real.
7. **Cuisine mapping** — OSM `cuisine` is free-form & multi-valued; we normalize tokens, use a unique synonym index, and add `osmExtra` (cafes, bakeries, ice cream, biergartens) for places that rarely carry `cuisine`. Unmapped tokens are ignored; venues can match several cuisines.
8. **Opening hours** — full spec is huge; we parse a common subset and say "Hours unknown" otherwise; "Open now" excludes unknown. Uses device local time (assumes the user searches near their own time zone).
9. **Untrusted data / XSS** — textContent only, `safeUrl`, CSP with no inline script.
10. **Privacy** — no location on load; geolocation only on tap; location not in URL by default; remembered only by opt-in; third parties limited to Overpass/Nominatim/OSM tiles (listed in About).
11. **No build, classic scripts** — matches repo; UMD lets Node test lane A. Script order in §2 is the dependency order.
12. **Deployment** — `pages.yml` copies named dirs only; adding `what-to-eat` is a post-merge integration step (not owned by any lane).
13. **Leaflet vendored** (≈150 KB) instead of CDN: offline-capable, CSP-friendly, no third-party script host.
14. **Emoji art** — zero image deps, tiny, but rendering varies by OS; art.js pattern backgrounds carry most of the visual identity, emoji limited to Unicode ≤ 14.
