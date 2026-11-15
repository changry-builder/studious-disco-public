// Hand-built cases matching the worked examples in docs/case-engine.md section 11.
import type { Case, CharId, Claim, ClaimChain, ClaimVersion, Item, Solution } from "../../src/engine/index";
import { blackthorn } from "../../src/scenarios/blackthorn/facts";

type Grid = Record<CharId, (string | null)[]>;

function truthClaim(grid: Grid, c: CharId, t: number): Claim {
  const room = grid[c]![t]!;
  const order = blackthorn.characters.map((ch) => ch.id);
  return { room, with: order.filter((d) => d !== c && grid[d] && grid[d]![t] === room) };
}

export function makeCase(o: {
  victim: CharId; suspects: CharId[]; grid: Grid; solution: Solution; items: Item[];
  lies: { speaker: CharId; slot: number; versions: ClaimVersion[] }[];
}): Case {
  const claims: ClaimChain[] = [];
  for (const c of o.suspects) {
    for (let t = 0; t < 6; t++) {
      const lie = o.lies.find((l) => l.speaker === c && l.slot === t);
      claims.push({ speaker: c, slot: t, versions: lie ? lie.versions : [{ claim: truthClaim(o.grid, c, t), lie: false, refutedBy: [] }] });
    }
  }
  return {
    genVersion: 1, scenarioId: "blackthorn", seed: 0, difficulty: "easy", attempt: 0, fallback: false, repairs: 0,
    victim: o.victim, suspects: o.suspects, body: { room: o.solution.room }, claims, items: o.items, solution: o.solution,
    truth: { loc: o.grid, secondLiar: null, weaponTakenSlot: 1, disposition: "hidden" }, par: { questions: 8 },
  };
}

const ref = (speaker: CharId, slot: number, version = 0) => ({ kind: "claim" as const, speaker, slot, version });
const inPlace = (ids: string[]): Item[] =>
  blackthorn.weapons.filter((w) => ids.includes(w.id)).map((w) => ({ id: `w:${w.id}:inplace`, kind: "weaponInPlace", weapon: w.id, room: w.home, spot: w.homeSpot }));

// 11.1 Easy: the Colonel and the poker
export const colonelCase = makeCase({
  victim: "edmund",
  suspects: ["beatrice", "penrose", "forsythe", "finch"],
  grid: {
    edmund: ["dining", "library", "study", "study", null, null],
    forsythe: ["dining", "drawing", "billiard", "study", "billiard", "hall"],
    beatrice: ["dining", "library", "conservatory", "library", "conservatory", "hall"],
    penrose: ["dining", "billiard", "billiard", "library", "library", "hall"],
    finch: ["kitchen", "dining", "hall", "kitchen", "dining", "hall"],
  },
  solution: { killer: "forsythe", weapon: "poker", motive: "debt", room: "study", slot: 3 },
  lies: [
    {
      speaker: "forsythe", slot: 3,
      versions: [
        { claim: { room: "library", with: [] }, lie: true, refutedBy: [ref("beatrice", 3), ref("penrose", 3)] },
        { claim: { room: "gallery", with: [] }, lie: true, refutedBy: [] },
      ],
    },
  ],
  items: [
    { id: "wound", kind: "wound", class: "blunt" },
    { id: "tod", kind: "tod", from: 3, to: 3 },
    { id: "w:poker:missing", kind: "weaponMissing", weapon: "poker", room: "drawing", spot: "fireplace" },
    { id: "w:poker:found", kind: "weaponFound", weapon: "poker", used: true, room: "billiard", spot: "table" },
    ...inPlace(["candlestick", "bookend", "letter-opener", "carving-knife", "pruning-knife", "curtain-cord", "picture-wire"]),
    { id: "m:forsythe-edmund-debt", kind: "motiveDoc", link: "forsythe-edmund-debt", room: "study", spot: "desk" },
    { id: "m:beatrice-edmund-revenge", kind: "motiveDoc", link: "beatrice-edmund-revenge", room: "library", spot: "reading-desk" },
  ],
});

// 11.2 Medium: a chain through a secret-keeper
export const violetCase = makeCase({
  victim: "penrose",
  suspects: ["margaret", "julian", "violet", "forsythe", "finch"],
  grid: {
    penrose: ["dining", "drawing", "library", "conservatory", null, null],
    violet: ["dining", "study", "hall", "conservatory", "gallery", "hall"],
    margaret: ["dining", "drawing", "drawing", "drawing", "hall", "hall"],
    julian: ["dining", "billiard", "drawing", "billiard", "hall", "hall"],
    forsythe: ["dining", "billiard", "library", "drawing", "hall", "hall"],
    finch: ["kitchen", "dining", "hall", "cellar", "kitchen", "hall"],
  },
  solution: { killer: "violet", weapon: "letter-opener", motive: "blackmail", room: "conservatory", slot: 3 },
  lies: [
    {
      speaker: "finch", slot: 3,
      versions: [
        { claim: { room: "drawing", with: [] }, lie: true, refutedBy: [ref("margaret", 3), ref("forsythe", 3)] },
        { claim: { room: "cellar", with: [] }, lie: false, refutedBy: [] },
      ],
    },
    {
      speaker: "violet", slot: 3,
      versions: [
        { claim: { room: "cellar", with: [] }, lie: true, refutedBy: [ref("finch", 3, 1)] },
        { claim: { room: "library", with: [] }, lie: true, refutedBy: [] },
      ],
    },
  ],
  items: [
    { id: "wound", kind: "wound", class: "blade" },
    { id: "tod", kind: "tod", from: 2, to: 3 },
    { id: "w:letter-opener:missing", kind: "weaponMissing", weapon: "letter-opener", room: "study", spot: "desk" },
    { id: "w:letter-opener:found", kind: "weaponFound", weapon: "letter-opener", used: true, room: "gallery", spot: "linen-chest" },
    ...inPlace(["poker", "candlestick", "bookend", "carving-knife", "pruning-knife", "curtain-cord", "picture-wire"]),
    { id: "m:violet-penrose-blackmail", kind: "motiveDoc", link: "violet-penrose-blackmail", room: "hall", spot: "telephone-table" },
    { id: "m:julian-penrose-blackmail", kind: "motiveDoc", link: "julian-penrose-blackmail", room: "billiard", spot: "cue-rack" },
    { id: "m:forsythe-penrose-exposure", kind: "motiveDoc", link: "forsythe-penrose-exposure", room: "library", spot: "shelves" },
    { id: "b:violet-julian", kind: "bondDoc", pairs: [{ from: "violet", to: "julian" }, { from: "julian", to: "violet" }], room: "gallery", spot: "linen-chest" },
    { id: "s:finch", kind: "secretTrace", who: "finch", room: "cellar", spot: "racks" },
  ],
});
