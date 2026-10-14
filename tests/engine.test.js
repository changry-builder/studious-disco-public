const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../js/engine.js");
const { COUNTRIES } = require("../js/countries.js");

const byCode = (code) => COUNTRIES.find((c) => c.code === code);

test("country data is well formed", () => {
  const codes = new Set();
  for (const c of COUNTRIES) {
    assert.ok(c.name && c.code, `missing name/code: ${JSON.stringify(c)}`);
    assert.ok(!codes.has(c.code), `duplicate code ${c.code}`);
    codes.add(c.code);
    assert.ok([1, 2, 3].includes(c.tier), `${c.name} tier`);
    assert.ok(c.capital.length > 0, `${c.name} needs a capital`);
    assert.ok(c.largest.length > 0, `${c.name} needs a largest city`);
    assert.ok(Array.isArray(c.cities), `${c.name} cities`);
  }
});

test("every tier can fill a round with a trap country", () => {
  for (const tier of [1, 2, 3]) {
    const pool = COUNTRIES.filter((c) => c.tier === tier);
    assert.ok(pool.length >= Engine.COUNTRIES_PER_ROUND * 4, `tier ${tier} too small`);
    assert.ok(pool.some(Engine.isTrap), `tier ${tier} has no trap`);
  }
});

test("judges capitals, largest cities and major cities", () => {
  const aus = byCode("AUS");
  assert.equal(Engine.judge(aus, "Canberra").kind, "capital");
  assert.equal(Engine.judge(aus, "sydney").kind, "largest");
  assert.equal(Engine.judge(aus, "Melbourne").kind, "largest");
  assert.equal(Engine.judge(aus, "Perth").kind, "major");
  assert.equal(Engine.judge(aus, "Paris").kind, "miss");
  assert.equal(Engine.judge(aus, "   ").kind, "miss");
  assert.equal(Engine.judge(byCode("FRA"), "paris").kind, "both");
});

test("forgives accents, case, alternates and small typos", () => {
  assert.equal(Engine.judge(byCode("COL"), "bogota").kind, "both");
  assert.equal(Engine.judge(byCode("UKR"), "Kiev").kind, "both");
  assert.equal(Engine.judge(byCode("NOR"), "Olso").kind, "both");
  assert.equal(Engine.judge(byCode("AUS"), "Melborne").kind, "largest");
  assert.equal(Engine.judge(byCode("USA"), "Washington D.C.").kind, "capital");
  assert.equal(Engine.judge(byCode("RUS"), "St. Petersburg").city, "Saint Petersburg");
  assert.equal(Engine.judge(byCode("NLD"), "the hague").city, "The Hague");
  assert.equal(Engine.judge(byCode("VNM"), "Saigon").kind, "largest");
});

test("short names need to be exact-ish", () => {
  assert.equal(Engine.judge(byCode("SLE"), "Bo").kind, "major");
  assert.equal(Engine.judge(byCode("SLE"), "Boo").kind, "miss");
});

test("scoring applies the fast bonus and the final-round multiplier", () => {
  assert.deepEqual(Engine.score("capital"), { base: 3, bonus: 0, total: 3 });
  assert.deepEqual(Engine.score("both", { fast: true }), { base: 4, bonus: 1, total: 5 });
  assert.deepEqual(Engine.score("major", { fast: true }), { base: 1, bonus: 0, total: 1 });
  assert.deepEqual(Engine.score("largest", { fast: true, multiplier: 2 }), { base: 3, bonus: 1, total: 8 });
  assert.equal(Engine.score("miss", { fast: true }).total, 0);
  assert.equal(Engine.multiplierForRound(2), 2);
  assert.equal(Engine.multiplierForRound(0), 1);
});

test("pickRound returns unique countries from one tier including a trap", () => {
  const used = new Set();
  for (let round = 0; round < 50; round++) {
    const picked = Engine.pickRound(COUNTRIES, 2, used);
    assert.equal(picked.length, 5);
    assert.ok(picked.every((c) => c.tier === 2));
    assert.equal(new Set(picked.map((c) => c.code)).size, 5);
    assert.ok(picked.some(Engine.isTrap));
  }
  const exclude = new Set(COUNTRIES.filter((c) => c.tier === 1).slice(0, 10).map((c) => c.code));
  const picked = Engine.pickRound(COUNTRIES, 1, exclude);
  assert.ok(picked.every((c) => !exclude.has(c.code)));
});
