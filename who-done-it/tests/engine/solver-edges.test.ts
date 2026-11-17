// Task 2.5: hand-built knowledge bases for solver edge cases.
import { solve, survivingKillers, todWindow, type Claim, type Item, type KB } from "../../src/engine/index";

const SLOTS = 6;
const lone = (room: string): Claim => ({ room, with: [] });

/** Four suspects a..d and a victim. Everyone has a quiet, consistent evening away from the body room r1. */
function makeKB(over: { slot2?: Record<string, Claim>; items?: Item[]; bonds?: KB["bonds"]; withdrawn?: KB["withdrawn"] } = {}): KB {
  const base: Record<string, Claim> = { a: lone("r2"), b: lone("r3"), c: lone("r4"), d: lone("r5") };
  const current: KB["current"] = {};
  for (const [id, claim] of Object.entries(base)) {
    current[id] = Array.from({ length: SLOTS }, (_, t) => (t === 2 && over.slot2?.[id] ? over.slot2[id] : claim));
  }
  return {
    suspects: ["a", "b", "c", "d"],
    victim: "v",
    bodyRoom: "r1",
    slots: SLOTS,
    rooms: ["r1", "r2", "r3", "r4", "r5"],
    current,
    withdrawn: over.withdrawn ?? [],
    bonds: over.bonds ?? [],
    items: over.items ?? [],
    weapons: [{ id: "w", class: "blunt", home: "r1", homeSpot: "s" }], // one weapon at the scene, so only opportunity decides
    motiveLinks: [],
  };
}
const tod = (from: number, to: number): Item => ({ id: "tod", kind: "tod", from, to });
const opp = ["opportunity"] as const;

describe("solver edge cases", () => {
  it("two suspects alone at the murder slot cannot be told apart", () => {
    // a and b vouch for each other at slot 2; c and d each claim to be alone.
    const kb = makeKB({
      items: [tod(2, 2)],
      slot2: { a: { room: "r2", with: ["b"] }, b: { room: "r2", with: ["a"] }, c: lone("r4"), d: lone("r5") },
    });
    expect(survivingKillers(kb, opp)).toEqual(["c", "d"]);
    expect(solve(kb, { families: opp }).unique).toBe(false);
  });

  it("a bonded pair vouching for each other is not cleared; an unbonded pair is", () => {
    const slot2 = { a: { room: "r2", with: ["b"] }, b: { room: "r2", with: ["a"] } };
    const unbonded = makeKB({ items: [tod(2, 2)], slot2 });
    expect(survivingKillers(unbonded, opp)).not.toContain("a");
    expect(survivingKillers(unbonded, opp)).not.toContain("b");
    // b would lie to protect a, so a's alibi from b is worthless.
    const bonded = makeKB({ items: [tod(2, 2)], slot2, bonds: [{ from: "b", to: "a" }] });
    expect(survivingKillers(bonded, opp)).toContain("a");
    expect(survivingKillers(bonded, opp)).not.toContain("b");
  });

  it("without a time-of-death item the window widens to every middle slot", () => {
    expect(todWindow(makeKB())).toEqual([1, 2, 3, 4]);
    expect(todWindow(makeKB({ items: [tod(2, 3)] }))).toEqual([2, 3]);
    // a truthfully sits in the body room at slot 3, so the murder cannot be at or before slot 3.
    const sighting = (t: number): Item => ({ id: "p", kind: "presence", who: "a", at: "r1", slot: t, room: "r2", spot: "x" });
    const kbNoTod = makeKB({ items: [sighting(3)] });
    const kbTod = makeKB({ items: [sighting(3), tod(2, 2)] });
    expect(solve(kbNoTod, { families: opp }).survivors.every((s) => s.slot === 4 || s.killer === "a")).toBe(true);
    expect(solve(kbNoTod, { families: opp }).survivors.length).toBeGreaterThan(0);
    expect(solve(kbTod, { families: opp }).survivors.filter((s) => s.killer !== "a")).toEqual([]);
  });

  it("a presence record in the murder room makes that person the only possible killer", () => {
    const kb = makeKB({ items: [tod(2, 2), { id: "p", kind: "presence", who: "c", at: "r1", slot: 2, room: "r2", spot: "x" }] });
    expect(survivingKillers(kb, opp)).toEqual(["c"]);
  });

  it("two withdrawn claims mean the killer is one of those two", () => {
    const kb = makeKB({
      items: [tod(2, 2)],
      withdrawn: [{ who: "a", slot: 2 }, { who: "c", slot: 2 }],
    });
    expect(survivingKillers(kb, opp)).toEqual(["a", "c"]);
    // Without the admission rule nobody is ruled out by who changed their story.
    expect(survivingKillers(kb, opp, true)).toEqual(["a", "b", "c", "d"]);
  });
});
