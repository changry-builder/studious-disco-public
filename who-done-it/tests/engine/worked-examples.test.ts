import { buildKB, replay, score, solve, survivingKillers, type Action } from "../../src/engine/index";
import { blackthorn } from "../../src/scenarios/blackthorn/facts";
import { colonelCase, violetCase } from "./fixtures";

describe("worked example 11.1 (easy)", () => {
  const { kb, versions } = buildKB(blackthorn, colonelCase);

  it("cracks the Colonel in the closure", () => {
    expect(versions["forsythe:3"]).toBe(1);
    expect(kb.withdrawn).toEqual([{ who: "forsythe", slot: 3 }]);
  });
  it("has exactly one solution", () => {
    expect(solve(kb).fits).toEqual([{ killer: "forsythe", weapon: "poker", motive: "debt" }]);
    expect(solve(kb, { ignoreAdmissions: true }).fits).toEqual([{ killer: "forsythe", weapon: "poker", motive: "debt" }]);
  });
  it("matches each cell of the table", () => {
    expect(survivingKillers(kb, ["opportunity"])).toEqual(["forsythe", "finch"]);
    expect(survivingKillers(kb, ["means"])).toEqual(["forsythe"]);
    expect(survivingKillers(kb, ["motive"])).toEqual(["beatrice", "forsythe"]);
  });
  it("is not solvable before the body is examined and people are asked", () => {
    const partial = buildKB(blackthorn, colonelCase, { asked: new Set(), items: new Set() }).kb;
    expect(solve(partial).unique).toBe(false);
  });
});

describe("worked example 11.2 (medium)", () => {
  const { kb, versions } = buildKB(blackthorn, violetCase);

  it("cracks Finch, and only then Violet", () => {
    expect(versions["finch:3"]).toBe(1);
    expect(versions["violet:3"]).toBe(1);
    const withoutFinch = buildKB(blackthorn, violetCase, {
      asked: new Set(violetCase.claims.filter((c) => c.speaker !== "finch").map((c) => `${c.speaker}:${c.slot}`)),
      items: new Set(violetCase.items.map((i) => i.id)),
    });
    expect(withoutFinch.versions["violet:3"]).toBe(0);
  });
  it("has exactly one solution, with or without the admission rule", () => {
    const want = [{ killer: "violet", weapon: "letter-opener", motive: "blackmail" }];
    expect(solve(kb).fits).toEqual(want);
    expect(solve(kb, { ignoreAdmissions: true }).fits).toEqual(want);
  });
  it("leaves only the two who changed their story under the admission rule", () => {
    expect(survivingKillers(kb, ["opportunity"])).toEqual(["violet", "finch"]);
  });
  it("without admissions: alibis leave four, means leaves one", () => {
    expect(survivingKillers(kb, ["opportunity"], true)).toEqual(["julian", "violet", "forsythe", "finch"]);
    expect(survivingKillers(kb, ["means"], true)).toEqual(["violet"]);
    expect(survivingKillers(kb, ["motive"], true)).toEqual(["julian", "violet", "forsythe"]);
  });
});

describe("playing example 11.1 through the reducer", () => {
  const c = (speaker: string, slot: number, version = 0) => ({ kind: "claim" as const, speaker, slot, version });
  const i = (id: string) => ({ kind: "item" as const, id });
  const actions: Action[] = [
    { at: 1000, type: "examineBody" },
    { at: 2000, type: "ask", suspect: "forsythe", slot: 3 },
    { at: 3000, type: "ask", suspect: "beatrice", slot: 3 },
    { at: 4000, type: "press", suspect: "beatrice", slot: 3, evidence: c("forsythe", 3) }, // honest: stands firm
    { at: 5000, type: "press", suspect: "forsythe", slot: 3, evidence: c("beatrice", 3) }, // cracks
    { at: 6000, type: "search", room: "billiard", spot: "table" },
    { at: 7000, type: "search", room: "study", spot: "desk" },
    { at: 8000, type: "accuse", who: "finch", weapon: "poker", room: "study", motive: "debt", support: { who: c("beatrice", 3), what: i("w:poker:found"), why: i("m:forsythe-edmund-debt") } },
    { at: 9000, type: "accuse", who: "forsythe", weapon: "poker", room: "study", motive: "debt", support: { who: i("wound"), what: i("w:poker:found"), why: i("m:forsythe-edmund-debt") } },
    { at: 10000, type: "accuse", who: "forsythe", weapon: "poker", room: "study", motive: "debt", support: { who: c("beatrice", 3), what: i("w:poker:found"), why: i("m:forsythe-edmund-debt") } },
  ];
  it("stands firm, cracks, rejects, and solves in order", () => {
    expect(replay(colonelCase, actions.slice(0, 4)).lastResult).toEqual({ kind: "stoodFirm", suspect: "beatrice", slot: 3 });
    const cracked = replay(colonelCase, actions.slice(0, 5));
    expect(cracked.lastResult).toEqual({ kind: "cracked", suspect: "forsythe", slot: 3 });
    expect(cracked.versions["forsythe:3"]).toBe(1);
    expect(replay(colonelCase, actions.slice(0, 8)).lastResult).toEqual({ kind: "wrong", wrongCount: 1 });
    expect(replay(colonelCase, actions.slice(0, 9)).lastResult).toEqual({ kind: "weakProof" });
    const end = replay(colonelCase, actions);
    expect(end.solved).toBe(true);
    expect(end.questions).toBe(2);
    // 1000 - one failed press (40) - one wrong accusation (150); questions under par; fast.
    expect(score(colonelCase, end)).toMatchObject({ base: 810, total: 810, rank: "Inspector" });
  });
  it("ignores actions that are not allowed", () => {
    const s = replay(colonelCase, actions.slice(0, 2));
    expect(replay(colonelCase, [...actions.slice(0, 2), { at: 1, type: "ask", suspect: "forsythe", slot: 3 }])).toEqual(s);
    expect(replay(colonelCase, [...actions.slice(0, 2), { at: 1, type: "press", suspect: "forsythe", slot: 3, evidence: c("beatrice", 3) }])).toEqual(s);
  });
});
