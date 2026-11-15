// Blackthorn Hall: the load-bearing facts, transcribed from docs/scenario-01.md.
// Changing anything here changes generated cases. It needs the lead architect's
// sign-off and a GEN_VERSION bump. Display text lives in text.ts, never here.

import type { MotiveLink, MotiveType, Scenario } from "../../engine/types";

function link(suspect: string, victim: string, type: MotiveType, room: string, spot: string): MotiveLink {
  return { id: `${suspect}-${victim}-${type}`, suspect, victim, type, doc: { room, spot } };
}

export const blackthorn: Scenario = {
  id: "blackthorn",
  index: 0,
  slots: [
    { id: 0, label: "9:00 pm" },
    { id: 1, label: "9:30 pm" },
    { id: 2, label: "10:00 pm" },
    { id: 3, label: "10:30 pm" },
    { id: 4, label: "11:00 pm" },
    { id: 5, label: "11:30 pm" },
  ],
  rooms: [
    { id: "hall", adjacent: ["drawing", "dining", "library", "study", "gallery"], spots: ["telephone-table", "coat-stand", "long-case-clock"], proofSpot: "telephone-table" },
    { id: "drawing", adjacent: ["hall", "conservatory"], spots: ["fireplace", "card-table", "piano"], proofSpot: "card-table" },
    { id: "dining", adjacent: ["hall", "kitchen"], spots: ["sideboard", "table"], proofSpot: "sideboard" },
    { id: "library", adjacent: ["hall", "study"], spots: ["reading-desk", "shelves", "globe"], proofSpot: "reading-desk" },
    { id: "study", adjacent: ["hall", "library"], spots: ["desk", "safe", "wastepaper-basket"], proofSpot: "desk" },
    { id: "billiard", adjacent: ["gallery"], spots: ["table", "cue-rack", "drinks-cabinet"], proofSpot: "cue-rack" },
    { id: "conservatory", adjacent: ["drawing"], spots: ["potting-bench", "tool-cabinet", "wicker-chairs"], proofSpot: "potting-bench" },
    { id: "kitchen", adjacent: ["dining", "cellar"], spots: ["range", "pantry", "bell-board"], proofSpot: "bell-board" },
    { id: "cellar", adjacent: ["kitchen"], spots: ["racks", "crates"], proofSpot: "racks" },
    { id: "gallery", adjacent: ["hall", "billiard"], spots: ["window-seat", "portraits", "linen-chest"], proofSpot: "window-seat" },
  ],
  characters: [
    { id: "edmund", secret: { room: "hall", evidenceSpot: "telephone-table" } },
    { id: "margaret", secret: { room: "gallery", evidenceSpot: "portraits" } },
    { id: "julian", secret: { room: "study", evidenceSpot: "safe" } },
    { id: "beatrice", secret: { room: "conservatory", evidenceSpot: "wicker-chairs" } },
    { id: "penrose", secret: { room: "kitchen", evidenceSpot: "pantry" } },
    { id: "violet", secret: { room: "study", evidenceSpot: "desk" } },
    { id: "forsythe", secret: { room: "library", evidenceSpot: "shelves" } },
    { id: "finch", secret: { room: "cellar", evidenceSpot: "racks" } },
  ],
  weapons: [
    { id: "poker", class: "blunt", home: "drawing", homeSpot: "fireplace" },
    { id: "candlestick", class: "blunt", home: "dining", homeSpot: "sideboard" },
    { id: "bookend", class: "blunt", home: "library", homeSpot: "shelves" },
    { id: "letter-opener", class: "blade", home: "study", homeSpot: "desk" },
    { id: "carving-knife", class: "blade", home: "kitchen", homeSpot: "pantry" },
    { id: "pruning-knife", class: "blade", home: "conservatory", homeSpot: "tool-cabinet", access: ["margaret", "finch"] },
    { id: "curtain-cord", class: "ligature", home: "gallery", homeSpot: "window-seat" },
    { id: "picture-wire", class: "ligature", home: "cellar", homeSpot: "crates" },
  ],
  bonds: [
    { from: "margaret", to: "julian", public: true },
    { from: "margaret", to: "beatrice", public: true },
    { from: "beatrice", to: "julian", public: true },
    { from: "finch", to: "margaret", public: true },
    { from: "forsythe", to: "edmund", public: true },
    { from: "penrose", to: "margaret", public: false, doc: { room: "conservatory", spot: "potting-bench" } },
    { from: "violet", to: "julian", public: false, doc: { room: "gallery", spot: "linen-chest" } },
    { from: "julian", to: "violet", public: false, doc: { room: "gallery", spot: "linen-chest" } },
  ],
  victims: ["edmund", "penrose", "forsythe"],
  motives: [
    // Lord Edmund is the victim
    link("margaret", "edmund", "jealousy", "gallery", "linen-chest"),
    link("julian", "edmund", "inheritance", "study", "safe"),
    link("julian", "edmund", "debt", "billiard", "drinks-cabinet"),
    link("beatrice", "edmund", "revenge", "library", "reading-desk"),
    link("penrose", "edmund", "exposure", "study", "wastepaper-basket"),
    link("violet", "edmund", "exposure", "hall", "coat-stand"),
    link("forsythe", "edmund", "debt", "study", "desk"),
    link("finch", "edmund", "revenge", "kitchen", "pantry"),
    link("finch", "edmund", "inheritance", "library", "shelves"),
    // Dr Penrose is the victim
    link("edmund", "penrose", "blackmail", "study", "safe"),
    link("margaret", "penrose", "blackmail", "gallery", "portraits"),
    link("julian", "penrose", "blackmail", "billiard", "cue-rack"),
    link("beatrice", "penrose", "revenge", "library", "globe"),
    link("violet", "penrose", "blackmail", "hall", "telephone-table"),
    link("forsythe", "penrose", "exposure", "library", "shelves"),
    link("finch", "penrose", "revenge", "kitchen", "range"),
    // Colonel Forsythe is the victim
    link("edmund", "forsythe", "revenge", "study", "desk"),
    link("margaret", "forsythe", "exposure", "drawing", "piano"),
    link("julian", "forsythe", "debt", "billiard", "table"),
    link("beatrice", "forsythe", "revenge", "gallery", "window-seat"),
    link("penrose", "forsythe", "exposure", "conservatory", "wicker-chairs"),
    link("violet", "forsythe", "inheritance", "hall", "long-case-clock"),
    link("finch", "forsythe", "blackmail", "cellar", "crates"),
  ],
};
