import { DIFFICULTIES, generateCase } from "../../src/engine/index";
import {
  charName, claimSentence, companyPhrase, itemText, itemTitle, motiveLabel, roomInline, roomName, slotInline, slotLabel,
  spotName, t, variantHash, weaponName,
} from "../../src/app/text";
import { scenarios, type ScenarioEntry } from "../../src/scenarios/index";

const facts = scenarios[0]!.facts;
const empty: ScenarioEntry = { facts, text: {} };
const tiny: ScenarioEntry = {
  facts,
  text: {
    "char.finch.name": "Mr Finch",
    "char.finch.address.edmund": "his lordship",
    "char.finch.address.violet": "Miss Marsh",
    "char.finch.address.julian": "Mr Julian",
    "char.finch.claim.alone": ["A0 {room} {time}", "A1 {room} {time}", "A2 {room} {time}"],
    "char.finch.claim.with": "W {room} {time} {company}",
    "room.study.inline": "the study",
    "slot.2.inline": "ten o'clock",
  },
};

describe("t()", () => {
  const table = { a: "Hello {name}, {x}", v: ["zero", "one", "two"] };
  it("fills placeholders and leaves unknown ones", () => {
    expect(t(table, "a", { name: "Ann" })).toBe("Hello Ann, {x}");
  });
  it("picks variants deterministically", () => {
    expect(t(table, "v", undefined, 0)).toBe("zero");
    expect(t(table, "v", undefined, 4)).toBe("one");
    expect(t(table, "v")).toBe("zero");
    expect(t(table, "v", undefined, 4)).toBe(t(table, "v", undefined, 4));
  });
  it("falls back readably and never throws", () => {
    expect(t({}, "room.study.name")).toBe("Study");
    expect(t({}, "char.finch.name")).toBe("Finch");
    expect(t({}, "room.hall.spot.long-case-clock.name")).toBe("Long case clock");
    expect(t({}, "body.wound.blunt")).toBe("[body.wound.blunt]");
    expect(t({ x: [] }, "x")).toBe("[x]");
    expect(t({ x: 5 as unknown as string }, "x", undefined, NaN)).toBe("[x]");
  });
});

describe("name helpers", () => {
  it("fall back with an empty table", () => {
    expect(charName(empty, "finch")).toBe("Finch");
    expect(roomName(empty, "drawing")).toBe("Drawing");
    expect(roomInline(empty, "drawing")).toBe("the drawing");
    expect(spotName(empty, "study", "safe")).toBe("Safe");
    expect(weaponName(empty, "letter-opener")).toBe("Letter opener");
    expect(slotLabel(empty, 1)).toBe("9:30 pm");
    expect(slotInline(empty, 1)).toBe("9:30 pm");
    expect(motiveLabel(empty, "debt")).toBe("Debt");
  });
  it("use the table when keys exist", () => {
    expect(charName(tiny, "finch")).toBe("Mr Finch");
    expect(roomInline(tiny, "study")).toBe("the study");
    expect(slotInline(tiny, 2)).toBe("ten o'clock");
  });
});

describe("companyPhrase", () => {
  it("handles 1, 2 and 3 names, with addresses and fallbacks", () => {
    expect(companyPhrase(tiny, "finch", ["edmund"])).toBe("with his lordship");
    expect(companyPhrase(tiny, "finch", ["edmund", "violet"])).toBe("with his lordship and Miss Marsh");
    expect(companyPhrase(tiny, "finch", ["edmund", "violet", "julian"])).toBe("with his lordship, Miss Marsh and Mr Julian");
    expect(companyPhrase(empty, "finch", ["edmund", "violet"])).toBe("with Edmund and Violet");
    expect(companyPhrase(empty, "finch", [])).toBe("alone");
  });
});

describe("claimSentence", () => {
  it("uses fallbacks with an empty text object", () => {
    expect(claimSentence(empty, 1, "finch", 1, { room: "study", with: [] })).toBe("I was in the study at 9:30 pm, alone.");
    expect(claimSentence(empty, 1, "finch", 1, { room: "study", with: ["edmund", "julian"] })).toBe("I was in the study at 9:30 pm, with Edmund and Julian.");
  });
  it("uses templates, picks variants by hash, and is deterministic", () => {
    const c = { room: "study", with: [] as string[] };
    const s = claimSentence(tiny, 77, "finch", 2, c);
    expect(s).toBe(`A${variantHash(77, "finch", 2) % 3} the study ten o'clock`);
    expect(claimSentence(tiny, 77, "finch", 2, c)).toBe(s);
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) seen.add(claimSentence(tiny, seed, "finch", 2, c));
    expect(seen.size).toBe(3);
    expect(claimSentence(tiny, 1, "finch", 2, { room: "study", with: ["edmund"] })).toBe("W the study ten o'clock with his lordship");
  });
});

describe("itemText", () => {
  it("is non-empty for every item of generated cases with an empty text object", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 1; seed <= 20; seed++) {
        const cs = generateCase(facts, seed, difficulty);
        for (const item of cs.items) {
          const text = itemText(empty, cs, item);
          expect(text.length, `${difficulty} ${seed} ${item.kind}`).toBeGreaterThan(0);
          expect(text, `${difficulty} ${seed} ${item.kind}`).not.toMatch(/\{\w+\}/);
          expect(itemTitle(empty, item).length).toBeGreaterThan(0);
        }
      }
    }
  });
  it("renders a presence record from the room key when present", () => {
    const cs = generateCase(facts, 1, "easy");
    const item = { id: "p", kind: "presence", who: "finch", at: "study", slot: 2, room: "hall", spot: "x" } as const;
    expect(itemText(empty, cs, item)).toBe("A record shows Finch was in the study at 10:00 pm.");
    expect(itemText({ facts, text: { "room.study.proof": "{name} signed in at {time}." } }, cs, item)).toBe("Finch signed in at 10:00 pm.");
  });
});
