const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../depth-chart/js/model.js");
const METS = require("../depth-chart/js/data-mets.js");
const { MEN, WOMEN } = require("../depth-chart/js/data-ucla.js");

const TEAMS = [METS, MEN, WOMEN];
const S0 = M.emptyState();

test("team data is well formed", () => {
  for (const t of TEAMS) {
    const ids = new Set();
    for (const p of t.players) {
      assert.ok(p.id && p.name && Array.isArray(p.pos) && p.pos.length, `${t.id}: ${JSON.stringify(p)}`);
      assert.ok(!ids.has(p.id), `${t.id}: duplicate ${p.id}`);
      ids.add(p.id);
      for (const pos of p.pos) assert.ok(M.POSITIONS[t.sport].includes(pos), `${p.id} position ${pos}`);
      if (t.sport === "basketball") assert.ok(p.year >= 1 && p.year <= 5, `${p.id} year`);
      else assert.ok(p.guaranteed || p.control, `${p.id} needs a contract or control year`);
    }
    for (const [pos, list] of Object.entries(t.depth)) {
      assert.ok(M.POSITIONS[t.sport].includes(pos), `${t.id} depth position ${pos}`);
      for (const id of list) assert.ok(ids.has(id), `${t.id} depth ${pos}: unknown ${id}`);
    }
  }
});

test("the Mets carry 26 active players on Opening Day, 13 pitchers", () => {
  const active = M.playersFor(METS, S0, 2026, "26");
  assert.equal(active.length, 26);
  assert.equal(active.filter(M.isPitcher).length, 13);
  assert.ok(M.playersFor(METS, S0, 2026, "40").length <= 40);
});

test("future Mets seasons keep only players under contract or control", () => {
  const ids = (y) => M.playersFor(METS, S0, y, "40").map((p) => p.id);
  assert.ok(ids(2026).includes("peralta"));
  assert.ok(!ids(2027).includes("peralta"));
  assert.ok(ids(2027).includes("robert"), "club option year counts");
  assert.ok(ids(2031).includes("lindor"));
  assert.ok(!ids(2031).includes("bichette"));
  assert.equal(M.statusFor(METS, METS.players.find((p) => p.id === "robert"), 2027).kind, "option");
});

test("Mets tooltip leads with free agency", () => {
  const soto = METS.players.find((p) => p.id === "soto");
  assert.match(M.tooltipFor(METS, soto, 2026)[0], /Free agent after 2039/);
});

test("college players stay five years and advance a class each season", () => {
  const rice = WOMEN.players.find((p) => p.id === "rice");
  assert.equal(M.statusFor(WOMEN, rice, 2025).short, "Sr");
  assert.equal(M.statusFor(WOMEN, rice, 2026).short, "Gr");
  assert.equal(M.statusFor(WOMEN, rice, 2027), null);
  const freeny = MEN.players.find((p) => p.id === "freeny");
  assert.equal(M.lastSeason(MEN, freeny), 2029);
  assert.equal(M.seasonLabel(MEN, 2025), "2025-26");
  assert.match(M.tooltipFor(MEN, freeny, 2026)[0], /Sophomore in 2026-27/);
});

test("leaving early ends a player's seasons", () => {
  const s = M.editPlayer(WOMEN, S0, "lbetts", { leavesAfter: 2025 });
  assert.ok(!M.playersFor(WOMEN, s, 2026).some((p) => p.id === "lbetts"));
});

test("moving and reordering the depth chart", () => {
  let s = M.moveInDepth(METS, S0, 2026, { id: "baty", to: "SS", beforeId: "lindor" });
  let d = M.depthFor(METS, s, 2026, "40");
  assert.equal(d.SS[0], "baty");
  assert.ok(!d["3B"].includes("baty"), "moving takes a player off their old position");
  s = M.shiftInDepth(METS, s, 2026, "40", "SS", "baty", +1);
  assert.deepEqual(M.depthFor(METS, s, 2026, "40").SS.slice(0, 2), ["lindor", "baty"]);
  // Earlier seasons are untouched; later seasons inherit the edit.
  assert.equal(M.depthFor(METS, S0, 2026, "40")["3B"][1], "baty");
  assert.equal(M.depthFor(METS, s, 2027, "40").SS[1], "baty");
  assert.equal(M.moveInDepth(METS, s, 2026, { id: "baty", to: null }), s, "can't take a player off the field");
});

test("reordering in the 26-man view keeps hidden 40-man players", () => {
  // CF: robert, taylor, morabito (40-man). Move Taylor up in the 26-man view.
  const s = M.shiftInDepth(METS, S0, 2026, "26", "CF", "taylor", -1);
  assert.deepEqual(M.depthFor(METS, s, 2026, "40").CF, ["taylor", "robert", "morabito"]);
});

test("every Mets player sits at exactly one position, their primary one", () => {
  for (const view of ["26", "40"]) {
    const d = M.depthFor(METS, S0, 2026, view);
    const seen = Object.values(d).flat();
    assert.equal(seen.length, new Set(seen).size, `${view}: duplicates`);
    assert.equal(seen.length, M.playersFor(METS, S0, 2026, view).length, `${view}: everyone placed`);
    for (const p of M.playersFor(METS, S0, 2026, view)) assert.ok(d[p.pos[0]].includes(p.id), `${p.id} at ${p.pos[0]}`);
  }
});

test("the Mets starting lineup is the nine fielders and the day's starter", () => {
  const lineup = M.starters(METS, S0, 2026, "26");
  assert.deepEqual(lineup.map((x) => x.pos), ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "SP"]);
  assert.deepEqual(lineup.map((x) => x.id), ["alvarez", "polanco", "semien", "bichette", "lindor", "soto", "robert", "benge", "vientos", "peralta"]);
});

test("saved edits from the first release still load", () => {
  // The first release saved edits without a version number.
  const old = { added: [{ id: "new-x", name: "X", pos: ["RP"], guaranteed: 2027, prospect: true }], edits: { soto: { num: 99 } }, removed: ["raley"], depth: { 2026: { SS: ["lindor", "bichette"] } }, extra: 1 };
  const s = M.normalizeState(old);
  assert.equal(s.v, M.SCHEMA);
  assert.equal(s.extra, 1, "unknown fields are kept");
  assert.deepEqual(s.added, old.added);
  const ps = M.playersFor(METS, s, 2026, "40");
  assert.equal(ps.find((p) => p.id === "soto").num, 99);
  assert.ok(!ps.some((p) => p.id === "raley"));
  assert.ok(ps.some((p) => p.id === "new-x"));
  assert.equal(M.normalizeState(s).v, M.SCHEMA, "normalizing twice is harmless");
});

test("player ids never change, so saved edits keep pointing at the right players", () => {
  // If a new data version drops one of these on purpose (a trade, a departure), remove it here too.
  const ids = {
    mets: "peralta senga holmes manaea peterson mclean williams weaver raley garcia brazoban lovelady myers alvarez torrens lindor bichette semien polanco vientos baty young soto robert benge taylor minter tong scott ross gerber warren pintaro senger mauricio melendez morabito",
    "ucla-m": "dent perry clark dailey bilodeau booker brown jamerson bwilliams freeny peoples horry seidler alston jovic",
    "ucla-w": "rice karamouzi legerwalker aarnisalo kneepkens bilic jaquez sbetts gardiner dugalic muse lbetts grant",
  };
  for (const t of TEAMS) {
    const have = new Set(t.players.map((p) => p.id));
    for (const id of ids[t.id].split(" ")) assert.ok(have.has(id), `${t.id}: ${id} is missing`);
  }
});

test("adding a recruit places them at their position from their first season", () => {
  const { state, id } = M.addPlayer(MEN, S0, { name: "Test Recruit", pos: ["SF"], year: 1, firstSeason: 2026 }, 2026);
  assert.ok(!M.playersFor(MEN, state, 2025).some((p) => p.id === id));
  assert.ok(M.depthFor(MEN, state, 2026).SF.includes(id));
  const p = M.allPlayers(MEN, state).find((x) => x.id === id);
  assert.equal(M.lastSeason(MEN, p), 2030);
  assert.ok(p.prospect);
  assert.equal(M.removePlayer(MEN, state, id).added.length, 0);
});

test("a signing with only a guaranteed year is a free agent after it", () => {
  const { state, id } = M.addPlayer(METS, S0, { name: "Free Agent", pos: ["RP"], guaranteed: 2028, firstSeason: 2027, roster: "26" }, 2027);
  const p = M.allPlayers(METS, state).find((x) => x.id === id);
  assert.equal(M.lastSeason(METS, p), 2028);
  assert.ok(M.playersFor(METS, state, 2027, "26").some((x) => x.id === id));
});

test("basketball players sit at exactly one position, their primary one by default", () => {
  for (const t of [MEN, WOMEN]) {
    for (const season of t.seasons) {
      const d = M.depthFor(t, S0, season);
      const seen = Object.values(d).flat();
      const onTeam = M.playersFor(t, S0, season);
      assert.equal(seen.length, new Set(seen).size, `${t.id} ${season}: duplicates`);
      assert.equal(seen.length, onTeam.length, `${t.id} ${season}: everyone placed`);
      if (season === t.baseSeason) for (const p of onTeam) assert.ok(d[p.pos[0]].includes(p.id), `${p.id} at ${p.pos[0]}`);
    }
  }
});

test("moving a basketball player takes them off their old position", () => {
  let s = M.moveInDepth(MEN, S0, 2025, { id: "perry", to: "PG", beforeId: "dent" });
  const d = M.depthFor(MEN, s, 2025);
  assert.equal(d.PG[0], "perry");
  assert.ok(!d.SG.includes("perry"));
  assert.equal(M.moveInDepth(MEN, s, 2025, { id: "perry", to: null }), s, "can't take a player off the court");
  assert.deepEqual(M.starters(MEN, s, 2025).map((x) => x.id), ["perry", "clark", "dailey", "bilodeau", "booker"]);
});

test("old saved depth with a player at two positions shows them once, at their primary", () => {
  const s = Object.assign(M.emptyState(), { depth: { 2025: { PG: ["perry", "dent"], SG: ["perry", "clark"], SF: [], PF: [], C: [] } } });
  const d = M.depthFor(MEN, s, 2025);
  assert.ok(!d.PG.includes("perry"));
  assert.equal(d.SG[0], "perry");
});
