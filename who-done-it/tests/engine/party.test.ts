import {
  allVoted, buildDeck, buildKB, chainKey, decodeResultCode, DIFFICULTIES, encodeCaseCode, encodeResultCode, generateCase,
  initialParty, MAX_ROUNDS, partyPoints, partyReduce, partyReveal, solve, voteTally, type PartyAction, type PartyState,
} from "../../src/engine/index";
import { blackthorn } from "../../src/scenarios/blackthorn/facts";
import { colonelCase } from "./fixtures";

describe.each(DIFFICULTIES)("party deck (%s)", (difficulty) => {
  it("has 6 to 8 cards, reveals everything exactly once, and ends uniquely solvable", () => {
    for (let seed = 0; seed < 200; seed++) {
      const cs = generateCase(blackthorn, seed, difficulty);
      const deck = buildDeck(blackthorn, cs);
      expect(deck.length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      expect(deck.length, `seed ${seed}`).toBeLessThanOrEqual(MAX_ROUNDS);
      expect(deck[0]!.kind).toBe("scene");
      expect(deck[deck.length - 1]!.kind).toBe("crack");

      const items = deck.flatMap((c) => c.items);
      expect([...items].sort()).toEqual(cs.items.map((i) => i.id).sort());
      const claims = deck.flatMap((c) => c.claims.map((x) => `${x.speaker}:${x.slot}:${x.version}`));
      const all = cs.claims.flatMap((ch) => ch.versions.map((_, v) => `${ch.speaker}:${ch.slot}:${v}`));
      expect([...claims].sort()).toEqual([...all].sort());

      // Walk the deck as a player would: a crack card's evidence must already be on the table.
      const version: Record<string, number> = {};
      const held = new Set<string>();
      for (const card of deck) {
        if (card.kind === "crack") {
          const by = card.brokenBy!;
          if (by.kind === "item") expect(held.has(by.id)).toBe(true);
          else expect(version[chainKey(by.speaker, by.slot)]).toBe(by.version);
          const c = card.claims[0]!;
          const chain = cs.claims.find((ch) => ch.speaker === c.speaker && ch.slot === c.slot)!;
          expect(chain.versions[c.version - 1]!.refutedBy).toContainEqual(by);
        }
        for (const id of card.items) held.add(id);
        for (const c of card.claims) version[chainKey(c.speaker, c.slot)] = c.version;
      }
      const { kb, versions } = buildKB(blackthorn, cs);
      expect(version).toEqual(versions);
      expect(solve(kb).unique).toBe(true);
    }
  });
});

describe("party scoring", () => {
  it("rewards the first round a player settled on the killer", () => {
    expect(partyPoints(["k", "k", "k", "k"], "k")).toBe(100);
    expect(partyPoints(["a", "k", "k", "k"], "k")).toBe(75);
    expect(partyPoints(["k", "a", "k", "k"], "k")).toBe(50); // changed away, so the early guess does not count
    expect(partyPoints(["a", "b", "c", "k"], "k")).toBe(25);
    expect(partyPoints(["k", "k", "k", "a"], "k")).toBe(0);
    expect(partyPoints(["a", "a", "k", "k", "k", "k"], "k")).toBe(67);
  });
});

describe("party reducer", () => {
  const run = (actions: PartyAction[], from: PartyState = initialParty()) => actions.reduce(partyReduce, from);
  const lobby = run([{ type: "addPlayer", name: "Ann" }, { type: "addPlayer", name: " Bo " }, { type: "addPlayer", name: "Ann" }]);

  it("adds players once, trimmed", () => {
    expect(lobby.players).toEqual(["Ann", "Bo"]);
    expect(run([{ type: "addPlayer", name: "  " }], lobby)).toBe(lobby);
  });
  it("needs two players to start", () => {
    const one = run([{ type: "addPlayer", name: "Ann" }]);
    expect(run([{ type: "startCase", code: "X", rounds: 3 }], one)).toBe(one);
  });
  it("plays a case through and keeps totals across cases", () => {
    let s = run([{ type: "startCase", code: "X", rounds: 3 }], lobby);
    expect(run([{ type: "nextRound" }], s)).toBe(s); // nobody has voted
    expect(run([{ type: "addPlayer", name: "Cy" }], s)).toBe(s); // not mid-case
    s = run([{ type: "vote", player: 0, suspect: "forsythe" }, { type: "vote", player: 1, suspect: "finch" }], s);
    expect(allVoted(s)).toBe(true);
    expect(voteTally(s, 0)).toEqual({ forsythe: 1, finch: 1 });
    expect(partyReveal(colonelCase, s)).toBeNull(); // not the last round
    expect(run([{ type: "endCase", killer: "forsythe" }], s)).toBe(s);
    s = run([
      { type: "nextRound" }, { type: "vote", player: 0, suspect: "forsythe" }, { type: "vote", player: 1, suspect: "forsythe" },
      { type: "nextRound" }, { type: "vote", player: 0, suspect: "forsythe" },
    ], s);
    expect(partyReveal(colonelCase, s)).toBeNull(); // one vote missing
    s = run([{ type: "vote", player: 1, suspect: "forsythe" }], s);
    expect(partyReveal(colonelCase, s)).toBe("forsythe");
    s = run([{ type: "endCase", killer: "forsythe" }], s);
    expect(s.current).toBeNull();
    expect(s.totals).toEqual([100, 67]);
    expect(s.history).toEqual([{ code: "X", points: [100, 67] }]);
    s = run([{ type: "startCase", code: "Y", rounds: 1 }, { type: "vote", player: 0, suspect: "a" }, { type: "vote", player: 1, suspect: "k" }, { type: "endCase", killer: "k" }], s);
    expect(s.totals).toEqual([100, 167]);
  });
});

describe("result codes", () => {
  const caseCode = encodeCaseCode(0, "medium", 4242);
  const result = { solved: true, base: 810, minutes: 14, questions: 11, wrongAccusations: 1, failedPresses: 2 };
  it("round-trip", () => {
    const code = encodeResultCode(caseCode, result);
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{5}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(decodeResultCode(code.toLowerCase(), [0])).toEqual({
      ok: true, caseCode, parts: { genVersion: 1, scenario: 0, difficulty: "medium", seed: 4242 }, result,
    });
  });
  it("caps large values", () => {
    const d = decodeResultCode(encodeResultCode(caseCode, { solved: false, base: 0, minutes: 500, questions: 99, wrongAccusations: 40, failedPresses: 40 }), [0]);
    expect(d.ok && d.result).toEqual({ solved: false, base: 0, minutes: 127, questions: 63, wrongAccusations: 15, failedPresses: 15 });
  });
  it("rejects a result moved onto another case, and a wrong length", () => {
    const code = encodeResultCode(caseCode, result);
    const other = encodeCaseCode(0, "medium", 4243);
    expect(decodeResultCode(other + code.slice(caseCode.length), [0])).toEqual({ ok: false, error: "check" });
    expect(decodeResultCode(caseCode, [0])).toEqual({ ok: false, error: "length" });
  });
});
