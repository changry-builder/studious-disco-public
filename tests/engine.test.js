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

test("a whole match can stay on one tier without repeating a country", () => {
  for (const tier of [1, 2, 3]) {
    const used = new Set();
    for (let round = 0; round < Engine.ROUND_COUNT; round++) {
      const picked = Engine.pickRound(COUNTRIES, tier, used);
      assert.equal(picked.length, Engine.COUNTRIES_PER_ROUND, `tier ${tier} round ${round + 1}`);
      assert.ok(picked.some(Engine.isTrap), `tier ${tier} round ${round + 1} has a trap`);
      picked.forEach((c) => {
        assert.ok(!used.has(c.code));
        used.add(c.code);
      });
    }
  }
});

test("city clues never give the country away", () => {
  const clues = (code) => Engine.cluesFor(byCode(code), COUNTRIES).map((c) => c.name);
  assert.ok(!clues("PAN").includes("Panama City"));
  assert.ok(!clues("CUB").includes("Santiago de Cuba"));
  assert.ok(!clues("CRI").includes("Liberia"));
  assert.ok(clues("USA").includes("Houston"));
  for (const c of COUNTRIES) assert.ok(Engine.cluesFor(c, COUNTRIES).length > 0, `${c.name} has no clue`);
});

test("reverse rounds accept every country that has the clue city", () => {
  for (const tier of [1, 2, 3]) {
    const used = new Set();
    for (let round = 0; round < Engine.ROUND_COUNT; round++) {
      const qs = Engine.pickReverseRound(COUNTRIES, tier, used);
      assert.equal(qs.length, Engine.COUNTRIES_PER_ROUND);
      qs.forEach((q) => {
        assert.ok(q.answers.includes(q.country.code));
        used.add(q.country.code);
      });
    }
  }
});

test("judges typed countries", () => {
  const j = (codes, text) => Engine.judgeCountry(COUNTRIES, codes, text).kind;
  assert.equal(j(["NGA"], "nigeria"), "country");
  assert.equal(j(["NGA"], "Niger"), "wrong");
  assert.equal(j(["AUS"], "Austria"), "wrong");
  assert.equal(j(["AUS"], "Australa"), "country");
  assert.equal(j(["MMR"], "Burma"), "country");
  assert.equal(j(["CIV"], "ivory coast"), "country");
  assert.equal(j(["GBR"], "England"), "country");
  assert.equal(j(["ESP", "VEN"], "Venezuela"), "country");
  assert.equal(j(["USA"], "Atlantis"), "miss");
});

test("every country has an outline and every city has coordinates for the map", () => {
  const { WORLD } = require("../js/world.js");
  const { PLACES } = require("../js/places.js");
  const outlined = new Set(WORLD.features.map((f) => f.id));
  for (const c of COUNTRIES) {
    assert.ok(outlined.has(c.code), `${c.name} has no outline`);
    for (const entry of [...c.capital, ...c.largest, ...c.cities]) {
      const name = Engine.displayName(entry);
      const at = (PLACES[c.code] || {})[name];
      assert.ok(at, `${name} (${c.name}) has no coordinates`);
      assert.ok(Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 90, `${name} coordinates out of range`);
    }
  }
});

test("top 3 rounds list three cities, biggest first, led by the largest city", () => {
  const { PLACES } = require("../js/places.js");
  assert.deepEqual(Engine.top3For(byCode("ZAF"), PLACES, COUNTRIES)[0], "Johannesburg");
  assert.deepEqual(Engine.top3For(byCode("TUR"), PLACES, COUNTRIES), ["Istanbul", "Ankara", "İzmir"]);
  assert.ok(!Engine.top3For(byCode("CRI"), PLACES, COUNTRIES).includes("Liberia"));
  for (const tier of [1, 2, 3]) {
    const used = new Set();
    for (let round = 0; round < Engine.ROUND_COUNT; round++) {
      const qs = Engine.pickTop3Round(COUNTRIES, PLACES, tier, used);
      assert.equal(qs.length, Engine.COUNTRIES_PER_ROUND);
      qs.forEach((q) => {
        assert.equal(new Set(q.cities).size, 3, `${q.country.name}: ${q.cities}`);
        used.add(q.country.code);
      });
    }
  }
});

test("top 3 reveals a city every 5 seconds and scores fewer clues higher", () => {
  assert.equal(Engine.citiesShown(0), 1);
  assert.equal(Engine.citiesShown(4999), 1);
  assert.equal(Engine.citiesShown(5000), 2);
  assert.equal(Engine.citiesShown(10000), 3);
  assert.equal(Engine.citiesShown(19000), 3);
  assert.equal(Engine.score("top1").total, 5);
  assert.equal(Engine.score("top2").total, 3);
  assert.equal(Engine.score("top3").total, 1);
  assert.equal(Engine.score("top1", { multiplier: 2 }).total, 10);
});
