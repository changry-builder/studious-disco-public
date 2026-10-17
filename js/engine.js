// Game rules for Capital Clash: answer matching, scoring and round setup.
// No DOM access here, so it runs in the browser and under `node --test`.

const POINTS = { both: 4, capital: 3, largest: 3, major: 1, country: 3, top1: 5, top2: 3, top3: 1, miss: 0, wrong: 0 };
const REVEAL_EVERY_MS = 5000; // Top 3 game: a new city appears this often
const SPRINT_MS = 30000; // Picture sprint: each player's turn
const PASS_PENALTY_MS = 5000; // Picture sprint: passing a picture costs this much clock
const FAST_BONUS = 1;
const COUNTRIES_PER_ROUND = 5;
const ROUND_COUNT = 3;
const FINAL_ROUND_MULTIPLIER = 2;

const KIND_LABELS = {
  both: "Capital + largest",
  capital: "Capital",
  largest: "Largest city",
  major: "Major city",
  country: "Correct",
  top1: "On 1 city",
  top2: "On 2 cities",
  top3: "On 3 cities",
  miss: "Not a match",
  wrong: "Wrong country",
  timeout: "Out of time",
  passed: "Passed",
};

function normalize(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .replace(/ß/g, "ss")
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

// Optimal string alignment distance: Levenshtein plus adjacent swaps ("Olso").
function editDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, (_, i) => {
    const row = new Array(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[rows - 1][cols - 1];
}

// How many typos a name of this length tolerates.
function tolerance(length) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 10) return 2;
  return 3;
}

function displayName(entry) {
  return entry.split("|")[0];
}

// Every city a country knows about, with the roles it plays.
function cityTable(country) {
  const table = new Map();
  const add = (entry, role) => {
    const key = normalize(displayName(entry));
    if (!table.has(key)) {
      table.set(key, { name: displayName(entry), spellings: new Set(), roles: new Set() });
    }
    const city = table.get(key);
    entry.split("|").forEach((s) => city.spellings.add(normalize(s)));
    city.roles.add(role);
  };
  country.capital.forEach((e) => add(e, "capital"));
  country.largest.forEach((e) => add(e, "largest"));
  country.cities.forEach((e) => add(e, "major"));
  return [...table.values()];
}

function kindFor(roles) {
  if (roles.has("capital") && roles.has("largest")) return "both";
  if (roles.has("capital")) return "capital";
  if (roles.has("largest")) return "largest";
  return "major";
}

// Judge a typed answer. Returns { kind, city } where city is the matched name or null.
function judge(country, input) {
  const guess = normalize(input);
  if (!guess) return { kind: "miss", city: null };

  let best = null;
  for (const city of cityTable(country)) {
    for (const spelling of city.spellings) {
      const distance = editDistance(guess, spelling);
      if (distance > tolerance(spelling.length)) continue;
      const kind = kindFor(city.roles);
      const better =
        !best ||
        distance < best.distance ||
        (distance === best.distance && POINTS[kind] > POINTS[best.kind]);
      if (better) best = { distance, kind, city: city.name };
    }
  }
  return best ? { kind: best.kind, city: best.city } : { kind: "miss", city: null };
}

// Points for one answer. `fast` means it was locked in with at least half the clock left.
function score(kind, { fast = false, multiplier = 1 } = {}) {
  const base = POINTS[kind] || 0;
  const bonus = fast && base >= POINTS.capital ? FAST_BONUS : 0;
  return { base, bonus, total: (base + bonus) * multiplier };
}

// Capital and largest city differ, so the "obvious" answer is only half right.
function isTrap(country) {
  const caps = new Set(country.capital.map((e) => normalize(displayName(e))));
  return !country.largest.some((e) => caps.has(normalize(displayName(e))));
}

function shuffle(list, rng = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Pick the countries for one round: from one tier, never repeating within a match,
// and with at least one trap country so every round has a twist.
function pickRound(countries, tier, usedCodes = new Set(), rng = Math.random, count = COUNTRIES_PER_ROUND) {
  const pool = shuffle(
    countries.filter((c) => c.tier === tier && !usedCodes.has(c.code)),
    rng
  );
  const trap = pool.find(isTrap);
  const rest = pool.filter((c) => c !== trap);
  const picked = trap ? [trap, ...rest.slice(0, count - 1)] : rest.slice(0, count);
  return shuffle(picked, rng);
}

// ---------- City → Country games ----------

// Names a player can type for a country: its name, anything in brackets, and `aka`.
function countryNames(country) {
  const match = country.name.match(/^(.*?)\s*\((.*)\)$/);
  const main = match ? [match[1], match[2]] : [country.name];
  return [...main, ...(country.aka || [])];
}

function cityRoleLabel(roles) {
  return { both: "Capital and largest city", capital: "Capital", largest: "Largest city", major: "Major city" }[kindFor(roles)];
}

// Cities that make a fair clue: the name must not give the country away
// ("Panama City", "Santiago de Cuba") or be a country name itself ("Liberia" in Costa Rica).
function cluesFor(country, countries) {
  const countryKeys = new Set(countries.flatMap((c) => countryNames(c).map(normalize)));
  const own = countryNames(country).map(normalize).filter((n) => n.length >= 4); // skip "US", "UK"
  return cityTable(country)
    .filter((city) => {
      const key = normalize(city.name);
      if (own.some((n) => key.includes(n))) return false;
      return ![...city.spellings].some((s) => countryKeys.has(s));
    })
    .map((city) => ({ name: city.name, role: cityRoleLabel(city.roles) }));
}

// Codes of every country that has a city by this name, e.g. Valencia → Spain and Venezuela.
function countriesWithCity(countries, cityName) {
  const key = normalize(cityName);
  return countries.filter((c) => cityTable(c).some((city) => city.spellings.has(key))).map((c) => c.code);
}

// Pick a round of city clues. Each question keeps its country, the clue, and every
// country that counts as a right answer.
function pickReverseRound(countries, tier, usedCodes = new Set(), rng = Math.random, count = COUNTRIES_PER_ROUND) {
  const withClues = countries.filter((c) => cluesFor(c, countries).length > 0);
  return pickRound(withClues, tier, usedCodes, rng, count).map((country) => {
    // Half the time the clue is the capital or largest city, half the time another major city.
    const options = cluesFor(country, countries);
    const headline = options.filter((o) => o.role !== "Major city");
    const others = options.filter((o) => o.role === "Major city");
    const pool = headline.length && others.length ? (rng() < 0.5 ? headline : others) : options;
    const clue = pool[Math.floor(rng() * pool.length)];
    return {
      country,
      clue: clue.name,
      clueRole: clue.role,
      answers: countriesWithCity(countries, clue.name),
    };
  });
}

// Judge a typed country. Returns { kind: "country" | "wrong" | "miss", country, code }.
function judgeCountry(countries, answerCodes, input) {
  const guess = normalize(input);
  if (!guess) return { kind: "miss", country: null };

  let best = null;
  for (const c of countries) {
    const correct = answerCodes.includes(c.code);
    for (const name of countryNames(c)) {
      const spelling = normalize(name);
      const distance = editDistance(guess, spelling);
      if (distance > tolerance(spelling.length)) continue;
      const better = !best || distance < best.distance || (distance === best.distance && correct && !best.correct);
      if (better) best = { distance, correct, country: countryNames(c)[0], code: c.code };
    }
  }
  if (!best) return { kind: "miss", country: null };
  return { kind: best.correct ? "country" : "wrong", country: best.country, code: best.code };
}

// ---------- Top 3 cities games ----------

// A country's three biggest cities, biggest first. The city the quiz lists as largest
// always leads; the rest follow by population. Names that are another country's name
// ("Liberia" in Costa Rica) are skipped as too confusing.
function top3For(country, places, countries) {
  const otherNames = new Set(
    countries.filter((c) => c !== country).flatMap((c) => countryNames(c).map(normalize))
  );
  const pop = (city) => ((places[country.code] || {})[city.name] || [])[2] || 0;
  return cityTable(country)
    .filter((city) => ![...city.spellings].some((s) => otherNames.has(s)))
    .sort((a, b) => b.roles.has("largest") - a.roles.has("largest") || pop(b) - pop(a))
    .slice(0, 3)
    .map((city) => city.name);
}

function pickTop3Round(countries, places, tier, usedCodes = new Set(), rng = Math.random, count = COUNTRIES_PER_ROUND) {
  const eligible = countries.filter((c) => top3For(c, places, countries).length === 3);
  return pickRound(eligible, tier, usedCodes, rng, count).map((country) => ({
    country,
    cities: top3For(country, places, countries),
    answers: [country.code],
  }));
}

// How many of the three cities are showing after this much time on the question.
function citiesShown(elapsedMs) {
  return Math.min(3, 1 + Math.floor(Math.max(0, elapsedMs) / REVEAL_EVERY_MS));
}

// ---------- Clue games (School supplies) ----------

// Pick a round of items from one tier, never repeating within a match.
function pickItems(items, tier, usedKeys = new Set(), rng = Math.random, count = COUNTRIES_PER_ROUND) {
  return shuffle(
    items.filter((it) => it.tier === tier && !usedKeys.has(it.name)),
    rng
  )
    .slice(0, count)
    .map((item) => ({ item, key: item.name, clues: item.clues }));
}

// Judge a typed item name against every item, so "pen" for a pencil is "wrong", not close enough.
// Returns { kind: "right" | "wrong" | "miss", item }.
function judgeItem(items, target, input) {
  const guess = normalize(input);
  if (!guess) return { kind: "miss", item: null };
  let best = null;
  for (const it of items) {
    const correct = it === target;
    for (const name of [it.name, ...(it.aka || [])]) {
      const spelling = normalize(name);
      const distance = editDistance(guess, spelling);
      if (distance > tolerance(spelling.length)) continue;
      const better = !best || distance < best.distance || (distance === best.distance && correct && !best.correct);
      if (better) best = { distance, correct, item: it.name };
    }
  }
  if (!best) return { kind: "miss", item: null };
  return { kind: best.correct ? "right" : "wrong", item: best.item };
}

// ---------- Picture sprint ----------

// The order pictures appear in for one round. This tier's unseen pictures come first,
// then ones already shown in an earlier round, then other tiers, so a fast player never runs out.
function buildSprintQueue(pool, tier, usedKeys = new Set(), rng = Math.random, keyOf = (p) => p.code || p.name) {
  const inTier = pool.filter((p) => p.tier === tier);
  const others = pool.filter((p) => p.tier !== tier);
  const fresh = (list, seen) => list.filter((p) => usedKeys.has(keyOf(p)) === seen);
  return [
    ...shuffle(fresh(inTier, false), rng),
    ...shuffle(fresh(inTier, true), rng),
    ...shuffle(fresh(others, false), rng),
    ...shuffle(fresh(others, true), rng),
  ];
}

function multiplierForRound(roundIndex) {
  return roundIndex === ROUND_COUNT - 1 ? FINAL_ROUND_MULTIPLIER : 1;
}

const Engine = {
  POINTS,
  FAST_BONUS,
  COUNTRIES_PER_ROUND,
  ROUND_COUNT,
  FINAL_ROUND_MULTIPLIER,
  KIND_LABELS,
  normalize,
  editDistance,
  judge,
  score,
  isTrap,
  pickRound,
  pickReverseRound,
  pickTop3Round,
  pickItems,
  buildSprintQueue,
  SPRINT_MS,
  PASS_PENALTY_MS,
  judgeItem,
  top3For,
  citiesShown,
  REVEAL_EVERY_MS,
  judgeCountry,
  countryNames,
  cluesFor,
  multiplierForRound,
  displayName,
};

if (typeof module !== "undefined") module.exports = Engine;
