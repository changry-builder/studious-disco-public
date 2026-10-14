// Game rules for Capital Clash: answer matching, scoring and round setup.
// No DOM access here, so it runs in the browser and under `node --test`.

const POINTS = { both: 4, capital: 3, largest: 3, major: 1, miss: 0 };
const FAST_BONUS = 1;
const COUNTRIES_PER_ROUND = 5;
const ROUND_COUNT = 3;
const FINAL_ROUND_MULTIPLIER = 2;

const KIND_LABELS = {
  both: "Capital + largest",
  capital: "Capital",
  largest: "Largest city",
  major: "Major city",
  miss: "Not a match",
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
  multiplierForRound,
  displayName,
};

if (typeof module !== "undefined") module.exports = Engine;
