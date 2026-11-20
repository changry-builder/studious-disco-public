const test = require("node:test");
const assert = require("node:assert/strict");
const Cuisines = require("../what-to-eat/js/cuisines.js");
const SampleData = require("../what-to-eat/js/sample-data.js");
const Geo = require("../what-to-eat/js/geo.js");

const LIST = Cuisines.LIST;
const SPEC_IDS = ["pizza", "italian", "mexican", "chinese", "japanese", "korean", "thai", "vietnamese", "indian", "burger", "american", "bbq", "steak", "chicken", "seafood", "sandwich", "mediterranean", "middle_eastern", "spanish", "french", "german", "caribbean", "latin", "african", "veggie", "breakfast", "coffee", "dessert", "bakery"];
const PATTERNS = ["dots", "stripes", "waves", "grid", "zigzag", "rings"];
const TAGS = ["asian", "european", "american", "latin", "middle_eastern", "african", "spicy", "comfort", "healthy", "quick", "sweet", "drinks", "breakfast", "veggie"];

function lum(hex) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const contrastWhite = (hex) => 1.05 / (lum(hex) + 0.05);

test("cuisine count and ids", () => {
  assert.ok(LIST.length >= 24 && LIST.length <= 30);
  const ids = LIST.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z_]+$/);
  assert.deepEqual(ids.slice().sort(), SPEC_IDS.slice().sort());
  assert.deepEqual(Cuisines.ids(), ids);
  assert.equal(Cuisines.byId("thai").name, "Thai");
  assert.equal(Cuisines.byId("nope"), null);
});

test("cuisine fields and types", () => {
  for (const c of LIST) {
    for (const k of ["id", "name", "emoji", "color", "accent", "pattern", "blurb"]) assert.equal(typeof c[k], "string", `${c.id}.${k}`);
    assert.ok(c.name.length > 0 && c.name.length <= 18, c.id + " name");
    assert.ok(c.blurb.length > 0 && c.blurb.length <= 40, c.id + " blurb " + c.blurb.length);
    assert.ok(c.emoji.length > 0);
    assert.equal([...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(c.emoji)].length, 1, c.id + " emoji grapheme");
    assert.ok(PATTERNS.includes(c.pattern), c.id + " pattern");
    assert.ok(Array.isArray(c.tags) && c.tags.length >= 1);
    for (const t of c.tags) assert.ok(TAGS.includes(t), `${c.id} tag ${t}`);
    assert.ok(Array.isArray(c.osmCuisine) && c.osmCuisine.length >= 1);
    assert.ok(Array.isArray(c.osmExtra));
    for (const e of c.osmExtra) {
      assert.ok(Array.isArray(e) && e.length === 2 && typeof e[0] === "string" && typeof e[1] === "string");
    }
  }
});

test("osmCuisine tokens normalized and globally unique", () => {
  const seen = new Map();
  for (const c of LIST) {
    for (const t of c.osmCuisine) {
      assert.equal(t, t.toLowerCase().trim().replace(/ /g, "_"), `${c.id}: ${t}`);
      assert.ok(!/[;,]/.test(t));
      assert.ok(!seen.has(t), `token "${t}" in both ${seen.get(t)} and ${c.id}`);
      seen.set(t, c.id);
    }
  }
});

test("forOsmValue round trips every token; unknown/generic -> null", () => {
  for (const c of LIST) for (const t of c.osmCuisine) assert.equal(Cuisines.forOsmValue(t), c.id, t);
  for (const t of ["asian", "international", "regional", "fusion", "local", "zzz", ""]) assert.equal(Cuisines.forOsmValue(t), null, t);
});

test("spec synonyms present (spot checks)", () => {
  assert.equal(Cuisines.forOsmValue("sushi"), "japanese");
  assert.equal(Cuisines.forOsmValue("tex-mex"), "mexican");
  assert.equal(Cuisines.forOsmValue("shawarma"), "middle_eastern");
  assert.equal(Cuisines.forOsmValue("ice_cream"), "dessert");
  assert.equal(Cuisines.forOsmValue("coffee_shop"), "coffee");
  assert.equal(Cuisines.forOsmValue("steak_house"), "steak");
  assert.equal(Cuisines.forOsmValue("plant_based"), "veggie");
  assert.deepEqual(Cuisines.byId("german").osmExtra, [["amenity", "biergarten"]]);
  assert.deepEqual(Cuisines.byId("coffee").osmExtra, [["amenity", "cafe"]]);
  assert.deepEqual(Cuisines.byId("bakery").osmExtra, [["shop", "bakery"], ["shop", "pastry"]]);
  assert.deepEqual(Cuisines.byId("dessert").osmExtra, [["amenity", "ice_cream"], ["shop", "confectionery"]]);
});

test("colors: hex, distinct, white-text contrast >= 4.5", () => {
  const seen = new Set();
  for (const c of LIST) {
    assert.match(c.color, /^#[0-9A-Fa-f]{6}$/, c.id);
    assert.match(c.accent, /^#[0-9A-Fa-f]{6}$/, c.id);
    assert.ok(!seen.has(c.color.toLowerCase()), "duplicate color " + c.color);
    seen.add(c.color.toLowerCase());
    const ratio = contrastWhite(c.color);
    assert.ok(ratio >= 4.5, `${c.id} ${c.color} contrast ${ratio.toFixed(2)}`);
  }
});

// ---------- sample data ----------
const FILTER_PREDICATES = {
  vegetarian: (p) => ["yes", "only", "limited"].includes(p.tags["diet:vegetarian"]) || ["yes", "only", "limited"].includes(p.tags["diet:vegan"]),
  vegan: (p) => ["yes", "only", "limited"].includes(p.tags["diet:vegan"]),
  halal: (p) => ["yes", "only", "limited"].includes(p.tags["diet:halal"]),
  kosher: (p) => ["yes", "only", "limited"].includes(p.tags["diet:kosher"]),
  glutenFree: (p) => ["yes", "only", "limited"].includes(p.tags["diet:gluten_free"]),
  wheelchair: (p) => ["yes", "limited"].includes(p.tags.wheelchair),
};

test("sample data: shape and counts", () => {
  const places = SampleData.places;
  assert.equal(typeof SampleData.NOTE, "string");
  assert.ok(places.length >= 87);
  const keys = places.map((p) => p.key);
  assert.equal(new Set(keys).size, keys.length);
  const ids = new Set(Cuisines.ids());
  for (const p of places) {
    assert.ok(ids.has(p.cuisine), p.key);
    assert.ok(p.name.endsWith(" (sample)"), p.name);
    assert.equal(typeof p.dx, "number");
    assert.equal(typeof p.dy, "number");
    assert.ok(Math.abs(p.dx) <= 2500 && Math.abs(p.dy) <= 2500, p.key);
    assert.ok(p.tags && typeof p.tags === "object");
    assert.ok(p.tags.amenity || p.tags.shop, p.key + " needs amenity/shop");
  }
  for (const c of LIST) {
    const mine = places.filter((p) => p.cuisine === c.id);
    assert.ok(mine.length >= 3, `${c.id} has ${mine.length}`);
    assert.ok(mine.some((p) => Math.hypot(p.dx, p.dy) <= 500), `${c.id} needs one within 500 m`);
  }
});

test("sample data: no real-chain-ish names and no real URLs besides example.*", () => {
  for (const p of SampleData.places) {
    const w = p.tags.website;
    if (w) assert.match(w, /example\.(org|com|net)/, p.key);
    assert.ok(!/mcdonald|starbucks|subway|domino|kfc|burger king|pizza hut|wendy/i.test(p.name), p.name);
  }
});

test("sample data: every filter has hits; hours variety", () => {
  const places = SampleData.places;
  for (const [k, pred] of Object.entries(FILTER_PREDICATES)) {
    assert.ok(places.filter(pred).length >= 1, "filter " + k);
  }
  // Open-now needs parseable hours somewhere; unknown forms present too
  const hours = places.map((p) => p.tags.opening_hours);
  assert.ok(hours.some((h) => h && Geo.parseOpeningHours(h)), "parseable hours");
  assert.ok(hours.some((h) => h && !Geo.parseOpeningHours(h)), "unparseable hours");
  assert.ok(hours.some((h) => !h), "missing hours");
  assert.ok(hours.some((h) => h === "24/7"));
});

test("sample data: normalizes via Geo.sampleRestaurants for every cuisine", () => {
  const C = { lat: 51.5, lng: -0.12 };
  for (const c of LIST) {
    const list = Geo.sampleRestaurants(c.id, C);
    assert.ok(list.length >= 3, c.id);
    assert.ok(list.some((r) => r.distanceM <= 2000), c.id + " visible at default radius");
    for (const r of list) {
      assert.equal(r.primaryCuisine, c.id);
      assert.ok(r.cuisineIds.length >= 1);
      assert.equal(r.source, "sample");
      if (r.website) assert.equal(Geo.safeUrl(r.website), r.website);
    }
  }
});
