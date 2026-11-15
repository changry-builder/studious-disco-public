// The game reducer, driven by the hand-built fixtures. Spec: docs/case-engine.md section 9.
// No clock and no randomness: every action carries a fixed `at`.
import { holds, initialState, reduce, replay, reveal, view, type Action, type EvidenceRef } from "../../src/engine/index";
import { colonelCase, violetCase } from "./fixtures";

const c = (speaker: string, slot: number, version = 0): EvidenceRef => ({ kind: "claim", speaker, slot, version });
const i = (id: string): EvidenceRef => ({ kind: "item", id });

/** Recursively freezes a value. Strict-mode code that mutates a frozen object throws. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as object)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

// Scripted play-throughs. Worked example 11.1 (Colonel) and 11.2 (Violet), in the same order as the spec.
const colonelPlay: Action[] = [
  { at: 1000, type: "examineBody" },
  { at: 2000, type: "ask", suspect: "forsythe", slot: 3 },
  { at: 3000, type: "ask", suspect: "beatrice", slot: 3 },
  { at: 4000, type: "press", suspect: "beatrice", slot: 3, evidence: c("forsythe", 3) }, // stands firm
  { at: 5000, type: "press", suspect: "forsythe", slot: 3, evidence: c("beatrice", 3) }, // cracks
  { at: 6000, type: "search", room: "billiard", spot: "table" },
  { at: 7000, type: "search", room: "study", spot: "desk" },
  { at: 8000, type: "accuse", who: "finch", weapon: "poker", room: "study", motive: "debt", support: { who: c("beatrice", 3), what: i("w:poker:found"), why: i("m:forsythe-edmund-debt") } },
  { at: 9000, type: "accuse", who: "forsythe", weapon: "poker", room: "study", motive: "debt", support: { who: i("wound"), what: i("w:poker:found"), why: i("m:forsythe-edmund-debt") } },
  { at: 10000, type: "accuse", who: "forsythe", weapon: "poker", room: "study", motive: "debt", support: { who: c("beatrice", 3), what: i("w:poker:found"), why: i("m:forsythe-edmund-debt") } },
];

const violetPlay: Action[] = [
  { at: 1000, type: "examineBody" },
  { at: 2000, type: "ask", suspect: "violet", slot: 3 },
  { at: 3000, type: "ask", suspect: "finch", slot: 3 },
  { at: 4000, type: "ask", suspect: "margaret", slot: 3 },
  { at: 5000, type: "press", suspect: "finch", slot: 3, evidence: c("margaret", 3) }, // Finch cracks
  { at: 6000, type: "press", suspect: "violet", slot: 3, evidence: c("finch", 3, 1) }, // Violet cracks
  { at: 7000, type: "search", room: "gallery", spot: "linen-chest" },
  { at: 8000, type: "search", room: "hall", spot: "telephone-table" },
  { at: 9000, type: "accuse", who: "violet", weapon: "letter-opener", room: "conservatory", motive: "blackmail", support: { who: c("finch", 3, 1), what: i("w:letter-opener:found"), why: i("m:violet-penrose-blackmail") } },
];

describe("examineBody", () => {
  it("adds the wound and tod items", () => {
    const s = reduce(colonelCase, initialState(), { at: 1, type: "examineBody" });
    expect(s.bodyExamined).toBe(true);
    expect(s.items).toEqual(["wound", "tod"]);
  });
  it("a second examineBody returns the identical state object", () => {
    const s = replay(colonelCase, [{ at: 1, type: "examineBody" }]);
    expect(reduce(colonelCase, s, { at: 2, type: "examineBody" })).toBe(s);
  });
});

describe("search", () => {
  it("adds exactly the items at that room and spot", () => {
    const s = reduce(colonelCase, initialState(), { at: 1, type: "search", room: "study", spot: "desk" });
    expect(s.items).toEqual(["w:letter-opener:inplace", "m:forsythe-edmund-debt"]);
    expect(s.searched).toEqual(["study/desk"]);
  });
  it("a spot with nothing in it adds no items", () => {
    const s = reduce(colonelCase, initialState(), { at: 1, type: "search", room: "drawing", spot: "piano" });
    expect(s.items).toEqual([]);
  });
  it("searching the same spot again returns the identical state object", () => {
    const s = replay(colonelCase, [{ at: 1, type: "search", room: "study", spot: "desk" }]);
    expect(reduce(colonelCase, s, { at: 2, type: "search", room: "study", spot: "desk" })).toBe(s);
  });
});

describe("ask", () => {
  it("increments questions once, and asking the same chain again changes nothing", () => {
    const s1 = reduce(colonelCase, initialState(), { at: 1, type: "ask", suspect: "forsythe", slot: 3 });
    expect(s1.questions).toBe(1);
    expect(s1.versions["forsythe:3"]).toBe(0);
    const s2 = reduce(colonelCase, s1, { at: 2, type: "ask", suspect: "forsythe", slot: 3 });
    expect(s2).toBe(s1);
    expect(s2.questions).toBe(1);
  });
  it("asking an unknown suspect returns the identical state object", () => {
    const s = initialState();
    expect(reduce(colonelCase, s, { at: 1, type: "ask", suspect: "nobody", slot: 3 })).toBe(s);
  });
  it("asking an existing suspect at a slot with no chain returns the identical state object", () => {
    const s = initialState();
    expect(reduce(colonelCase, s, { at: 1, type: "ask", suspect: "forsythe", slot: 9 })).toBe(s);
  });
});

describe("press", () => {
  it("with evidence the player does not hold returns the identical state and is not a failed press", () => {
    const asked = replay(colonelCase, [{ at: 1, type: "ask", suspect: "forsythe", slot: 3 }]);
    // beatrice's claim was never asked
    expect(reduce(colonelCase, asked, { at: 2, type: "press", suspect: "forsythe", slot: 3, evidence: c("beatrice", 3) })).toBe(asked);
    // the item is not found yet
    expect(reduce(colonelCase, asked, { at: 2, type: "press", suspect: "forsythe", slot: 3, evidence: i("m:forsythe-edmund-debt") })).toBe(asked);
    expect(asked.failedPresses).toBe(0);
  });
  it("with held but non-refuting evidence increments failedPresses and leaves versions unchanged", () => {
    const base = replay(colonelCase, [
      { at: 1, type: "examineBody" },
      { at: 2, type: "ask", suspect: "forsythe", slot: 3 },
      { at: 3, type: "ask", suspect: "beatrice", slot: 3 },
    ]);
    // the wound is held but does not refute the Colonel's lie
    const withWound = reduce(colonelCase, base, { at: 4, type: "press", suspect: "forsythe", slot: 3, evidence: i("wound") });
    expect(withWound.failedPresses).toBe(1);
    expect(withWound.versions).toEqual(base.versions);
    expect(withWound.lastResult).toEqual({ kind: "stoodFirm", suspect: "forsythe", slot: 3 });
    // the Colonel's own claim, held, does not refute an innocent's claim
    const withLie = reduce(colonelCase, base, { at: 4, type: "press", suspect: "beatrice", slot: 3, evidence: c("forsythe", 3, 0) });
    expect(withLie.failedPresses).toBe(1);
    expect(withLie.versions).toEqual(base.versions);
    expect(withLie.questions).toBe(base.questions);
  });
});

describe("violetCase: the chain through the secret-keeper", () => {
  const askThree = (): Action[] => [
    { at: 1, type: "ask", suspect: "violet", slot: 3 },
    { at: 2, type: "ask", suspect: "finch", slot: 3 },
    { at: 3, type: "ask", suspect: "margaret", slot: 3 },
  ];

  it("pressing Violet with Finch's version-0 lie fails", () => {
    const s = replay(violetCase, askThree().slice(0, 2));
    const after = reduce(violetCase, s, { at: 4, type: "press", suspect: "violet", slot: 3, evidence: c("finch", 3, 0) });
    expect(after.versions["violet:3"]).toBe(0);
    expect(after.failedPresses).toBe(1);
    expect(after.lastResult).toEqual({ kind: "stoodFirm", suspect: "violet", slot: 3 });
  });

  it("after Finch cracks, Violet cracks on Finch's revised claim, and the withdrawn version is no longer held", () => {
    const s = replay(violetCase, askThree());
    const finchCracked = reduce(violetCase, s, { at: 4, type: "press", suspect: "finch", slot: 3, evidence: c("margaret", 3) });
    expect(finchCracked.lastResult).toEqual({ kind: "cracked", suspect: "finch", slot: 3 });
    expect(finchCracked.versions["finch:3"]).toBe(1);

    expect(holds(finchCracked, c("finch", 3, 0))).toBe(false);
    expect(holds(finchCracked, c("finch", 3, 1))).toBe(true);

    const violetCracked = reduce(violetCase, finchCracked, { at: 5, type: "press", suspect: "violet", slot: 3, evidence: c("finch", 3, 1) });
    expect(violetCracked.lastResult).toEqual({ kind: "cracked", suspect: "violet", slot: 3 });
    expect(violetCracked.versions["violet:3"]).toBe(1);
    expect(violetCracked.failedPresses).toBe(0);

    // the withdrawn version can no longer be used as evidence
    expect(reduce(violetCase, finchCracked, { at: 5, type: "press", suspect: "violet", slot: 3, evidence: c("finch", 3, 0) })).toBe(finchCracked);
  });
});

describe("view and reveal", () => {
  const SECRET_KEY = /"(solution|truth|lie|refutedBy)":/;

  it("the regex does match a secret key, so the check below has teeth", () => {
    expect(JSON.stringify({ lie: true })).toMatch(SECRET_KEY);
  });

  it("view() never carries solution, truth, lie or refutedBy, at any stage of play", () => {
    const stages: [typeof colonelCase, ReturnType<typeof initialState>][] = [
      [colonelCase, initialState()],
      [colonelCase, replay(colonelCase, colonelPlay.slice(0, 5))],
      [colonelCase, replay(colonelCase, colonelPlay)],
      [violetCase, replay(violetCase, violetPlay.slice(0, 6))],
      [violetCase, replay(violetCase, violetPlay)],
    ];
    for (const [cs, s] of stages) {
      expect(JSON.stringify(view(cs, s))).not.toMatch(SECRET_KEY);
    }
  });

  it("view() shows the statements the player has heard, oldest version first", () => {
    const v = view(violetCase, replay(violetCase, violetPlay.slice(0, 6)));
    const finch = v.statements.find((st) => st.speaker === "finch" && st.slot === 3);
    expect(finch?.versions.map((x) => x.room)).toEqual(["drawing", "cellar"]);
  });

  it("reveal() is null before the case is over, and shows the hidden facts after giving up", () => {
    const s = replay(colonelCase, [{ at: 1, type: "examineBody" }]);
    expect(reveal(colonelCase, s)).toBeNull();
    const gave = reduce(colonelCase, s, { at: 2, type: "giveUp" });
    expect(reveal(colonelCase, gave)).toEqual({ solution: colonelCase.solution, truth: colonelCase.truth });
  });

  it("after giving up, an ask returns the identical state object", () => {
    const gave = replay(colonelCase, [{ at: 1, type: "giveUp" }]);
    expect(reduce(colonelCase, gave, { at: 2, type: "ask", suspect: "forsythe", slot: 3 })).toBe(gave);
  });
});

describe("reduce never mutates its input", () => {
  it("a full scripted play-through of the Colonel runs on deep-frozen states without throwing", () => {
    const cs = deepFreeze(structuredClone(colonelCase));
    let s = initialState();
    for (const a of colonelPlay) s = reduce(cs, deepFreeze(s), deepFreeze(a));
    expect(s.solved).toBe(true);
  });
  it("a full scripted play-through of the Violet case runs on deep-frozen states without throwing", () => {
    const cs = deepFreeze(structuredClone(violetCase));
    let s = initialState();
    for (const a of violetPlay) s = reduce(cs, deepFreeze(s), deepFreeze(a));
    expect(s.solved).toBe(true);
  });
});
