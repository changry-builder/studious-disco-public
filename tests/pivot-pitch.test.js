const test = require("node:test");
const assert = require("node:assert/strict");
const Cards = require("../pivot-pitch/js/cards.js");
const G = require("../pivot-pitch/js/game.js");

// Deterministic stand-in for Math.random.
function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

test("the deck has 45 adjectives, 45 nouns and 40 pivot questions", () => {
  assert.equal(Cards.adjectives.length, 45);
  assert.equal(Cards.nouns.length, 45);
  assert.equal(Cards.pivots.length, 40);
});

test("cards are non-empty and never duplicated", () => {
  for (const [kind, list] of Object.entries(Cards)) {
    const seen = new Set();
    for (const card of list) {
      assert.ok(card.trim().length > 0, `blank ${kind} card`);
      const key = card.toLowerCase();
      assert.ok(!seen.has(key), `duplicate ${kind} card: ${card}`);
      seen.add(key);
    }
  }
});

test("pivot questions are questions and word cards are short", () => {
  for (const q of Cards.pivots) assert.match(q, /\?/, `not a question: ${q}`);
  for (const w of [...Cards.adjectives, ...Cards.nouns]) assert.ok(w.length <= 12, `too long for a card: ${w}`);
});

test("dealing gives one adjective and one noun", () => {
  const rng = seeded(7);
  for (let i = 0; i < 200; i++) {
    const combo = G.dealCombo(rng);
    assert.ok(Cards.adjectives.includes(combo.adjective));
    assert.ok(Cards.nouns.includes(combo.noun));
  }
});

test("a challenge pivot changes only the chosen card, to a different word", () => {
  const rng = seeded(3);
  for (let i = 0; i < 200; i++) {
    const combo = G.dealCombo(rng);
    const adj = G.pivotCombo(combo, "adjective", rng);
    assert.notEqual(adj.adjective, combo.adjective);
    assert.equal(adj.noun, combo.noun);
    assert.ok(Cards.adjectives.includes(adj.adjective));

    const noun = G.pivotCombo(combo, "noun", rng);
    assert.notEqual(noun.noun, combo.noun);
    assert.equal(noun.adjective, combo.adjective);
    assert.ok(Cards.nouns.includes(noun.noun));
  }
  assert.throws(() => G.pivotCombo({ adjective: "Tiny", noun: "Hat" }, "both"));
});

test("the audience gets two different pivot questions", () => {
  const rng = seeded(11);
  for (let i = 0; i < 200; i++) {
    const [a, b, ...rest] = G.pivotQuestions(rng);
    assert.equal(rest.length, 0);
    assert.notEqual(a, b);
    assert.ok(Cards.pivots.includes(a) && Cards.pivots.includes(b));
  }
});

test("challenge mode only runs with a timer", () => {
  assert.equal(G.challengeActive({ timer: 60, challenge: "noun" }), true);
  assert.equal(G.challengeActive({ timer: 90, challenge: "adjective" }), true);
  assert.equal(G.challengeActive({ timer: 60, challenge: "off" }), false);
  assert.equal(G.challengeActive({ timer: 0, challenge: "noun" }), false);
});

test("the pivot lands halfway and the last 10 seconds tick", () => {
  assert.equal(G.swapAtMs(60), 30000);
  assert.equal(G.swapAtMs(90), 45000);
  assert.equal(G.secondsLeft(9001), 10);
  assert.equal(G.secondsLeft(-50), 0);
  assert.ok(G.isTickSecond(10) && G.isTickSecond(1));
  assert.ok(!G.isTickSecond(11) && !G.isTickSecond(0));
});

test("clock formatting", () => {
  assert.equal(G.formatClock(90), "1:30");
  assert.equal(G.formatClock(60), "1:00");
  assert.equal(G.formatClock(9.7), "0:09");
  assert.equal(G.formatClock(-3), "0:00");
});

test("saved settings fall back to defaults when stale", () => {
  assert.deepEqual(G.normalizeSettings(null), { timer: 60, challenge: "off", sound: "sound" });
  assert.deepEqual(G.normalizeSettings({ timer: 45, challenge: "both", sound: "loud" }), {
    timer: 60,
    challenge: "off",
    sound: "sound",
  });
  assert.deepEqual(G.normalizeSettings({ timer: 0, challenge: "noun", sound: "vibrate" }), {
    timer: 0,
    challenge: "noun",
    sound: "vibrate",
  });
});
