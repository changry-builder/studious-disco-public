const test = require("node:test");
const assert = require("node:assert/strict");
const Rng = require("../what-to-eat/js/rng.js");
const Cuisines = require("../what-to-eat/js/cuisines.js");
const E = require("../what-to-eat/js/engine.js");
const Config = require("../what-to-eat/js/config.js");

const IDS = Cuisines.ids();
const SEEDS = [1, 7, 42, 12345, 987654321];

function toDuel(ids, seed) {
  let s = E.initialState();
  for (const id of ids) s = E.reduce(s, { type: "KEEP", id });
  return E.reduce(s, { type: "START", seed });
}
function play(s, seq) {
  for (const side of seq) s = E.reduce(s, { type: "CHOOSE", side });
  return s;
}
function seqFor(n, k) {
  const out = [];
  for (let i = 0; i < n - 1; i++) out.push(((i * 7 + k) >> 1) % 2 ? "L" : "R");
  return out;
}

// ---------- Rng ----------
test("rng: mulberry32 is deterministic and in [0,1)", () => {
  const a = Rng.mulberry32(123), b = Rng.mulberry32(123);
  const sa = Array.from({ length: 20 }, a), sb = Array.from({ length: 20 }, b);
  assert.deepEqual(sa, sb);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(sa, Array.from({ length: 20 }, Rng.mulberry32(124)));
});

test("rng: fixed seed gives fixed sequence snapshot", () => {
  const r = Rng.mulberry32(1);
  const first = [r(), r(), r()].map((x) => Math.round(x * 1e6));
  const again = Rng.mulberry32(1);
  assert.deepEqual([again(), again(), again()].map((x) => Math.round(x * 1e6)), first);
  assert.deepEqual(Rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8], 99), Rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8], 99));
  assert.equal(Rng.hashSeed("abc"), 0x1A47E90B); // FNV-1a 32 of "abc"
  assert.equal(Rng.hashSeed(""), 0x811c9dc5);
});

test("rng: shuffle is a permutation and does not mutate", () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const copy = src.slice();
  for (const seed of SEEDS) {
    const out = Rng.shuffle(src, seed);
    assert.deepEqual(src, copy);
    assert.notEqual(out, src);
    assert.deepEqual(out.slice().sort((a, b) => a - b), copy);
  }
  assert.deepEqual(Rng.shuffle([], 1), []);
});

test("rng: pick", () => {
  assert.equal(Rng.pick([], 1), undefined);
  assert.equal(Rng.pick(["x"], 5), "x");
  assert.equal(Rng.pick([1, 2, 3], 9), Rng.pick([1, 2, 3], 9));
});

// ---------- reducer basics ----------
test("initialState", () => {
  const s = E.initialState();
  assert.equal(s.v, 1);
  assert.equal(s.phase, "pick");
  assert.deepEqual(s.marks, {});
  assert.equal(s.seed, 0);
  assert.deepEqual(s.contenders, []);
  assert.deepEqual(s.choices, []);
  assert.equal(s.winner, null);
  assert.equal(s.cuisine, null);
  assert.equal(s.notice, null);
});

test("reduce: invalid/unknown events return same reference", () => {
  const s = E.initialState();
  assert.equal(E.reduce(s, { type: "NOPE" }), s);
  assert.equal(E.reduce(s, null), s);
  assert.equal(E.reduce(s, {}), s);
  assert.equal(E.reduce(s, { type: "KEEP", id: "bogus" }), s);
  assert.equal(E.reduce(s, { type: "CHOOSE", side: "L" }), s); // wrong phase
  assert.equal(E.reduce(s, { type: "UNDO" }), s);
  assert.equal(E.reduce(s, { type: "SHOW_RESULTS" }), s);
  assert.equal(E.reduce(s, { type: "USE_CUISINE", id: "thai" }), s);
  assert.equal(E.reduce(s, { type: "BACK" }), s);
  const d = toDuel(["thai", "pizza"], 1);
  assert.equal(E.reduce(d, { type: "KEEP", id: "thai" }), d);
  assert.equal(E.reduce(d, { type: "CHOOSE", side: "X" }), d);
});

test("reduce: KEEP/REJECT/TOGGLE/CLEAR do not mutate", () => {
  const s0 = E.initialState();
  const s1 = E.reduce(s0, { type: "KEEP", id: "thai" });
  assert.deepEqual(s0.marks, {});
  assert.equal(s1.marks.thai, "keep");
  const s2 = E.reduce(s1, { type: "REJECT", id: "thai" });
  assert.equal(s2.marks.thai, "reject");
  assert.equal(s1.marks.thai, "keep");
  const s3 = E.reduce(s2, { type: "CLEAR", id: "thai" });
  assert.ok(!("thai" in s3.marks));
});

test("reduce: TOGGLE cycle", () => {
  let s = E.initialState();
  s = E.reduce(s, { type: "TOGGLE", id: "thai" });
  assert.equal(s.marks.thai, "keep");
  s = E.reduce(s, { type: "TOGGLE", id: "thai" });
  assert.ok(!("thai" in s.marks));
  s = E.reduce(s, { type: "REJECT", id: "thai" });
  s = E.reduce(s, { type: "TOGGLE", id: "thai" });
  assert.ok(!("thai" in s.marks));
});

test("reduce: KEEP_ALL and CLEAR_ALL", () => {
  let s = E.reduce(E.initialState(), { type: "KEEP_ALL" });
  assert.equal(Object.keys(s.marks).length, IDS.length);
  assert.ok(Object.values(s.marks).every((m) => m === "keep"));
  s = E.reduce(s, { type: "CLEAR_ALL" });
  assert.deepEqual(s.marks, {});
});

test("contendersFor: kept else undecided, in LIST order", () => {
  assert.deepEqual(E.contendersFor({}), IDS);
  assert.deepEqual(E.contendersFor({ thai: "keep", pizza: "keep" }), ["pizza", "thai"]);
  const m = {};
  IDS.slice(0, 5).forEach((id) => (m[id] = "reject"));
  assert.deepEqual(E.contendersFor(m), IDS.slice(5));
  // rejects ignored if there are keeps
  assert.deepEqual(E.contendersFor({ thai: "keep", pizza: "reject" }), ["thai"]);
});

test("START with 0 kept uses undecided as contenders (capped)", () => {
  let s = E.initialState();
  for (const id of IDS.slice(0, IDS.length - 3)) s = E.reduce(s, { type: "REJECT", id });
  s = E.reduce(s, { type: "START", seed: 5 });
  assert.equal(s.phase, "duel");
  assert.deepEqual(s.contenders.slice().sort(), IDS.slice(-3).sort());
  assert.equal(s.notice, null);
});

test("START with everything rejected: none-left, stays in pick", () => {
  let s = E.initialState();
  for (const id of IDS) s = E.reduce(s, { type: "REJECT", id });
  assert.equal(E.startPreview(s).label, "none");
  assert.equal(E.startPreview(s).count, 0);
  s = E.reduce(s, { type: "START", seed: 5 });
  assert.equal(s.phase, "pick");
  assert.equal(s.notice, "none-left");
});

test("START with 1 contender: winner + notice single", () => {
  let s = E.reduce(E.initialState(), { type: "KEEP", id: "thai" });
  assert.deepEqual(E.startPreview(s), { count: 1, label: "single", willCap: false });
  s = E.reduce(s, { type: "START", seed: 3 });
  assert.equal(s.phase, "winner");
  assert.equal(s.winner, "thai");
  assert.equal(s.notice, "single");
  assert.deepEqual(E.runnerUps(s), []);
});

test("START with all 29 kept: capped to 16", () => {
  let s = E.reduce(E.initialState(), { type: "KEEP_ALL" });
  const pv = E.startPreview(s);
  assert.equal(pv.label, "duel");
  assert.equal(pv.count, Config.MAX_CONTENDERS);
  assert.equal(pv.willCap, true);
  s = E.reduce(s, { type: "START", seed: 11 });
  assert.equal(s.contenders.length, 16);
  assert.equal(new Set(s.contenders).size, 16);
  assert.equal(s.notice, "capped");
  assert.equal(s.phase, "duel");
  assert.equal(E.bracket(s).duelsTotal, 15);
  // deterministic
  const s2 = E.reduce(E.reduce(E.initialState(), { type: "KEEP_ALL" }), { type: "START", seed: 11 });
  assert.deepEqual(s2.contenders, s.contenders);
});

test("startPreview for exactly 16 kept: no cap", () => {
  let s = E.initialState();
  for (const id of IDS.slice(0, 16)) s = E.reduce(s, { type: "KEEP", id });
  assert.equal(E.startPreview(s).willCap, false);
  assert.equal(E.reduce(s, { type: "START", seed: 1 }).notice, null);
});

test("notice cleared by successful events", () => {
  let s = E.reduce(E.initialState(), { type: "KEEP_ALL" });
  s = E.reduce(s, { type: "START", seed: 1 });
  assert.equal(s.notice, "capped");
  s = E.reduce(s, { type: "CHOOSE", side: "L" });
  assert.equal(s.notice, null);
});

// ---------- bracket ----------
test("bracket sizes 2..16: structure, byes, winners, standings", () => {
  for (let n = 2; n <= 16; n++) {
    for (const seed of SEEDS) {
      const ids = IDS.slice(0, n);
      let s = toDuel(ids, seed);
      assert.equal(s.contenders.length, n);
      const R = Math.ceil(Math.log2(n));
      const b0 = E.bracket(s);
      assert.equal(b0.size, n);
      assert.equal(b0.rounds, R);
      assert.equal(b0.byes, 2 ** R - n);
      assert.equal(b0.duelsTotal, n - 1);
      assert.equal(b0.duelsPlayed, 0);
      assert.equal(b0.done, false);
      assert.equal(b0.round, 1);
      assert.equal(b0.winner, null);

      // bye entrants skip round 1
      const byeIds = s.contenders.slice(0, b0.byes);
      const seenInRound1 = new Set();
      const appeared = new Set();
      for (let k = 0; k < n - 1; k++) {
        const b = E.bracket(s);
        assert.ok(b.current, `n=${n} step ${k}`);
        assert.ok(s.contenders.includes(b.current.left) && s.contenders.includes(b.current.right));
        assert.notEqual(b.current.left, b.current.right);
        if (b.round === 1) {
          seenInRound1.add(b.current.left);
          seenInRound1.add(b.current.right);
        }
        appeared.add(b.current.left);
        appeared.add(b.current.right);
        s = E.reduce(s, { type: "CHOOSE", side: seqFor(n, seed)[k] });
      }
      for (const id of byeIds) assert.ok(!seenInRound1.has(id), `bye ${id} played round 1 (n=${n})`);
      assert.equal(appeared.size, n, `every contender plays at least once (n=${n})`);
      assert.equal(seenInRound1.size, n - b0.byes);

      const b = E.bracket(s);
      assert.equal(b.done, true);
      assert.equal(b.current, null);
      assert.equal(b.round, R);
      assert.ok(s.contenders.includes(b.winner));
      assert.equal(b.history.length, n - 1);
      assert.equal(b.standings.length, n);
      assert.deepEqual(b.standings.slice().sort(), s.contenders.slice().sort());
      assert.equal(b.standings[0], b.winner);
      const finalMatch = b.history[b.history.length - 1];
      assert.equal(finalMatch.winner, b.winner);
      const finalLoser = finalMatch.left === b.winner ? finalMatch.right : finalMatch.left;
      assert.equal(b.standings[1], finalLoser);
      assert.equal(s.phase, "winner");
      assert.equal(s.winner, b.winner);
      assert.deepEqual(E.runnerUps(s, 3), b.standings.slice(1, 4));
    }
  }
});

test("bracket: round names", () => {
  const names = (n) => {
    let s = toDuel(IDS.slice(0, n), 3);
    const out = [];
    for (let k = 0; k < n - 1; k++) {
      out.push(E.bracket(s).roundName);
      s = E.reduce(s, { type: "CHOOSE", side: "L" });
    }
    return out;
  };
  assert.deepEqual(names(2), ["Final"]);
  assert.deepEqual(names(4), ["Semifinal", "Semifinal", "Final"]);
  assert.deepEqual(names(8), ["Quarterfinal", "Quarterfinal", "Quarterfinal", "Quarterfinal", "Semifinal", "Semifinal", "Final"]);
  assert.equal(names(16)[0], "Round of 16");
});

test("bracket: n=3 has one bye, 2 duels; matchIndex progression", () => {
  let s = toDuel(["thai", "pizza", "bbq"], 2);
  let b = E.bracket(s);
  assert.equal(b.byes, 1);
  assert.equal(b.matchesInRound, 1);
  assert.equal(b.matchIndex, 0);
  assert.deepEqual([b.current.left, b.current.right], [s.contenders[1], s.contenders[2]]);
  s = E.reduce(s, { type: "CHOOSE", side: "L" });
  b = E.bracket(s);
  assert.equal(b.round, 2);
  assert.equal(b.current.left, s.contenders[0]); // bye advancer first
  assert.equal(b.current.right, s.contenders[1]);
});

test("bracket: n=8 matchIndex counts within round", () => {
  let s = toDuel(IDS.slice(0, 8), 4);
  const idx = [];
  for (let k = 0; k < 7; k++) {
    const b = E.bracket(s);
    idx.push([b.round, b.matchIndex, b.matchesInRound]);
    s = E.reduce(s, { type: "CHOOSE", side: "R" });
  }
  assert.deepEqual(idx, [[1, 0, 4], [1, 1, 4], [1, 2, 4], [1, 3, 4], [2, 0, 2], [2, 1, 2], [3, 0, 1]]);
});

test("bracket: n=1 degenerate is safe", () => {
  const s = E.reduce(E.reduce(E.initialState(), { type: "KEEP", id: "thai" }), { type: "START", seed: 1 });
  const b = E.bracket(s);
  assert.equal(b.current, null);
  assert.equal(b.winner, "thai");
});

test("extra CHOOSE after done is ignored", () => {
  let s = play(toDuel(IDS.slice(0, 4), 9), ["L", "L", "L"]);
  assert.equal(s.phase, "winner");
  assert.equal(E.reduce(s, { type: "CHOOSE", side: "L" }), s);
  assert.equal(s.choices.length, 3);
});

test("standings mid-bracket: undecided entrants after, still length n", () => {
  let s = toDuel(IDS.slice(0, 8), 4);
  s = E.reduce(s, { type: "CHOOSE", side: "L" });
  const b = E.bracket(s);
  assert.equal(b.standings.length, 8);
  assert.deepEqual(b.standings.slice().sort(), s.contenders.slice().sort());
});

// ---------- undo / back / rematch ----------
test("UNDO restores previous current exactly (replay)", () => {
  for (const n of [2, 3, 5, 8, 11, 16]) {
    let s = toDuel(IDS.slice(0, n), 77);
    const snaps = [];
    for (let k = 0; k < n - 1; k++) {
      snaps.push(JSON.stringify(E.bracket(s)));
      s = E.reduce(s, { type: "CHOOSE", side: k % 2 ? "L" : "R" });
    }
    assert.equal(s.phase, "winner");
    for (let k = n - 2; k >= 0; k--) {
      s = E.reduce(s, { type: "UNDO" });
      assert.equal(s.phase, "duel");
      assert.equal(s.winner, null);
      assert.equal(JSON.stringify(E.bracket(s)), snaps[k]);
    }
  }
});

test("UNDO at first duel goes to pick with marks preserved", () => {
  let s = toDuel(["thai", "pizza", "bbq"], 1);
  const marks = s.marks;
  s = E.reduce(s, { type: "UNDO" });
  assert.equal(s.phase, "pick");
  assert.deepEqual(s.marks, marks);
  assert.deepEqual(s.choices, []);
});

test("UNDO from winner via single/surprise returns to pick", () => {
  let s = E.reduce(E.reduce(E.initialState(), { type: "KEEP", id: "thai" }), { type: "START", seed: 1 });
  assert.equal(E.reduce(s, { type: "UNDO" }).phase, "pick");
  s = E.reduce(E.initialState(), { type: "SURPRISE", seed: 4 });
  assert.equal(E.reduce(s, { type: "UNDO" }).phase, "pick");
  assert.equal(E.reduce(s, { type: "BACK" }).phase, "pick");
});

test("REMATCH keeps contender set, resets choices", () => {
  let s = play(toDuel(IDS.slice(0, 8), 5), seqFor(8, 1));
  assert.equal(s.phase, "winner");
  const r = E.reduce(s, { type: "REMATCH", seed: 6 });
  assert.equal(r.phase, "duel");
  assert.deepEqual(r.choices, []);
  assert.equal(r.winner, null);
  assert.deepEqual(r.contenders.slice().sort(), s.contenders.slice().sort());
  assert.equal(r.seed, 6);
  assert.deepEqual(r.contenders, Rng.shuffle(s.contenders, 6));
  // from results too
  let res = E.reduce(s, { type: "SHOW_RESULTS" });
  assert.equal(E.reduce(res, { type: "REMATCH", seed: 6 }).phase, "duel");
  // not valid in pick
  const p = E.initialState();
  assert.equal(E.reduce(p, { type: "REMATCH", seed: 1 }), p);
});

test("REMATCH with <2 contenders goes to pick", () => {
  const s = E.reduce(E.initialState(), { type: "SURPRISE", seed: 4 });
  assert.equal(E.reduce(s, { type: "REMATCH", seed: 1 }).phase, "pick");
});

test("SURPRISE never picks a rejected id", () => {
  let base = E.initialState();
  for (const id of IDS.slice(1)) base = E.reduce(base, { type: "REJECT", id });
  for (let seed = 0; seed < 50; seed++) {
    const s = E.reduce(base, { type: "SURPRISE", seed });
    assert.equal(s.winner, IDS[0]);
    assert.equal(s.phase, "winner");
    assert.equal(s.notice, "surprise");
    assert.deepEqual(s.contenders, [IDS[0]]);
  }
  // all rejected: picks anything
  let all = E.initialState();
  for (const id of IDS) all = E.reduce(all, { type: "REJECT", id });
  const s = E.reduce(all, { type: "SURPRISE", seed: 3 });
  assert.ok(IDS.includes(s.winner));
});

test("winner -> results -> back chain, USE_CUISINE, RESET", () => {
  let s = play(toDuel(IDS.slice(0, 4), 2), ["L", "R", "L"]);
  const w = s.winner;
  s = E.reduce(s, { type: "SHOW_RESULTS" });
  assert.equal(s.phase, "results");
  assert.equal(s.cuisine, w);
  s = E.reduce(s, { type: "USE_CUISINE", id: "thai" });
  assert.equal(s.cuisine, "thai");
  assert.equal(s.phase, "results");
  assert.equal(E.reduce(s, { type: "USE_CUISINE", id: "nope" }), s);
  s = E.reduce(s, { type: "BACK" });
  assert.equal(s.phase, "winner");
  s = E.reduce(s, { type: "BACK" });
  assert.equal(s.phase, "duel");
  assert.equal(s.choices.length, 2);
  s = E.reduce(s, { type: "BACK" });
  s = E.reduce(s, { type: "BACK" });
  s = E.reduce(s, { type: "BACK" });
  assert.equal(s.phase, "pick");
  const r = E.reduce(play(toDuel(IDS.slice(0, 4), 2), ["L", "R", "L"]), { type: "RESET" });
  assert.deepEqual(r, E.initialState());
  assert.deepEqual(E.reduce(s, { type: "RESET" }), E.initialState());
});

test("reduce never mutates input state", () => {
  const s = toDuel(IDS.slice(0, 6), 3);
  const snap = JSON.stringify(s);
  E.reduce(s, { type: "CHOOSE", side: "L" });
  E.reduce(s, { type: "UNDO" });
  E.reduce(s, { type: "RESET" });
  E.reduce(s, { type: "REMATCH", seed: 1 });
  assert.equal(JSON.stringify(s), snap);
});

test("determinism: same events -> same result", () => {
  const run = () => play(toDuel(IDS.slice(0, 13), 31337), seqFor(13, 3));
  assert.deepEqual(run(), run());
});

// ---------- hash ----------
function stripNotice(s) {
  return Object.assign({}, s, { notice: null });
}

test("hash round trip: pick", () => {
  let s = E.reduce(E.reduce(E.initialState(), { type: "KEEP", id: "thai" }), { type: "REJECT", id: "pizza" });
  const h = E.encodeHash(s);
  assert.equal(typeof h, "string");
  assert.ok(!h.startsWith("#"));
  const d = E.decodeHash(h);
  assert.deepEqual(d.state, stripNotice(s));
});

test("hash round trip: duel mid-bracket, winner, results", () => {
  let s = toDuel(IDS.slice(0, 7), 424242);
  s = play(s, ["L", "R"]);
  assert.deepEqual(E.decodeHash(E.encodeHash(s)).state, stripNotice(s));
  s = play(s, ["R", "L", "L", "R"]);
  assert.equal(s.phase, "winner");
  assert.deepEqual(E.decodeHash(E.encodeHash(s)).state, stripNotice(s));
  s = E.reduce(s, { type: "SHOW_RESULTS" });
  s = E.reduce(s, { type: "USE_CUISINE", id: "bbq" });
  assert.deepEqual(E.decodeHash(E.encodeHash(s)).state, stripNotice(s));
});

test("hash round trip: capped, single, surprise", () => {
  let s = E.reduce(E.reduce(E.initialState(), { type: "KEEP_ALL" }), { type: "START", seed: 8 });
  assert.deepEqual(E.decodeHash(E.encodeHash(s)).state, stripNotice(s));
  s = E.reduce(E.reduce(E.initialState(), { type: "KEEP", id: "thai" }), { type: "START", seed: 8 });
  assert.deepEqual(E.decodeHash(E.encodeHash(s)).state, stripNotice(s));
  s = E.reduce(E.initialState(), { type: "SURPRISE", seed: 8 });
  assert.deepEqual(E.decodeHash(E.encodeHash(s)).state, stripNotice(s));
});

test("hash: extra at/r round trips", () => {
  const s = toDuel(["thai", "pizza"], 3);
  const h = E.encodeHash(s, { at: { lat: 40.730612, lng: -73.986599 }, r: 2000 });
  assert.match(h, /at=40\.73061,-73\.9866/);
  assert.match(h, /r=2000/);
  const d = E.decodeHash(h);
  assert.equal(d.extra.r, 2000);
  assert.ok(Math.abs(d.extra.at.lat - 40.73061) < 1e-5);
  assert.ok(Math.abs(d.extra.at.lng - -73.9866) < 1e-5);
  const plain = E.decodeHash(E.encodeHash(s));
  assert.ok(!plain.extra || (!plain.extra.at && !plain.extra.r));
});

test("hash: unknown ids dropped", () => {
  const d = E.decodeHash("v=1&p=pick&k=thai,bogus,pizza&x=zzz,bbq");
  assert.deepEqual(d.state.marks, { thai: "keep", pizza: "keep", bbq: "reject" });
});

test("hash: tampered winner is ignored and recomputed", () => {
  let s = play(toDuel(IDS.slice(0, 4), 9), ["L", "L", "L"]);
  let h = E.encodeHash(s);
  const real = s.winner;
  const fake = IDS.find((i) => i !== real);
  h = h.replace(/(^|&)w=[^&]*/, "$1w=" + fake);
  const d = E.decodeHash(h);
  assert.equal(d.state.winner, real);
});

test("hash: garbage and wrong version return null", () => {
  assert.equal(E.decodeHash(""), null);
  assert.equal(E.decodeHash("garbage"), null);
  assert.equal(E.decodeHash("v=2&p=pick"), null);
  assert.equal(E.decodeHash("p=pick"), null);
  assert.equal(E.decodeHash(null), null);
  assert.equal(E.decodeHash("v=abc&p=%%%"), null);
});

test("hash: bogus choice history does not crash", () => {
  const s = toDuel(IDS.slice(0, 4), 9);
  const h = E.encodeHash(s).replace(/(^|&)h=[^&]*/, "") + "&h=LRXLRLRLRL";
  const d = E.decodeHash(h);
  if (d) {
    assert.ok(d.state.choices.length <= 3);
    assert.ok(d.state.choices.every((c) => c === "L" || c === "R"));
  }
});
