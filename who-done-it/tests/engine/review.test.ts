// Tests added after the milestone 1 review.
import { buildKB, decodeCaseCode, DIFFICULTIES, generateCase, makeRng, replay, solve, validateScenario, type Action, type Case, type Claim, type Scenario } from "../../src/engine/index";
import { blackthorn } from "../../src/scenarios/blackthorn/facts";

it("rng gives a fixed, recorded sequence", () => {
  const r = makeRng(12345);
  expect([r.next(), r.next(), r.next(), r.int(10), r.int(1000)]).toMatchInlineSnapshot(`
    [
      4207900869,
      1317490944,
      2079646450,
      8,
      509,
    ]
  `);
  expect(makeRng(7).shuffle([1, 2, 3, 4, 5, 6])).toMatchInlineSnapshot(`
    [
      5,
      2,
      3,
      4,
      6,
      1,
    ]
  `);
});

describe("validateScenario rejects broken scenarios", () => {
  const broken = (change: (s: Scenario) => void): string[] => {
    const s = JSON.parse(JSON.stringify(blackthorn)) as Scenario;
    change(s);
    return validateScenario(s);
  };
  it.each([
    ["duplicate room id", (s: Scenario) => void (s.rooms[1]!.id = "hall")],
    ["unknown weapon home", (s: Scenario) => void (s.weapons[0]!.home = "attic")],
    ["weapon spot not in room", (s: Scenario) => void (s.weapons[0]!.homeSpot = "nowhere")],
    ["secret bond without a doc", (s: Scenario) => void delete s.bonds.find((b) => !b.public)!.doc],
    ["wound class with one weapon", (s: Scenario) => void (s.weapons = s.weapons.filter((w) => w.id !== "picture-wire"))],
    ["too few rooms", (s: Scenario) => void (s.rooms = s.rooms.slice(0, 8))],
    ["two links of one type", (s: Scenario) => void (s.motives.find((m) => m.id === "julian-edmund-debt")!.type = "inheritance")],
    ["victim with too few suspects", (s: Scenario) => void (s.motives = s.motives.filter((m) => m.victim !== "penrose" || m.suspect === "finch"))],
    ["proofSpot not a spot", (s: Scenario) => void (s.rooms[0]!.proofSpot = "nowhere")],
    ["motive doc spot missing", (s: Scenario) => void (s.motives[0]!.doc.spot = "nowhere")],
  ])("%s", (_name, change) => {
    expect(broken(change).length).toBeGreaterThan(0);
  });
});

it("decoding a reserved difficulty fails", () => {
  // genVersion 1, scenario 0, difficulty 3 (reserved), seed 0, with a valid check symbol.
  const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let value = ((1 * 16 + 0) * 4 + 3) * 536870912;
  const v: number[] = [];
  for (let i = 0; i < 8; i++) {
    v.unshift(value % 32);
    value = Math.floor(value / 32);
  }
  const check = v.reduce((sum, x, i) => sum + (i + 1) * x, 0) % 32;
  expect(decodeCaseCode([...v, check].map((x) => ALPHABET[x]).join(""), [0])).toEqual({ ok: false, error: "difficulty" });
});

// Rule L5: a liar withdraws a claim when shown ANY true evidence that contradicts it.
describe.each(DIFFICULTIES)("every contradicting true evidence cracks a lie (%s)", (difficulty) => {
  const people = (cs: Case, slot: number) => [...cs.suspects, ...(slot <= cs.solution.slot ? [cs.victim] : [])];
  const contradicts = (cs: Case, slot: number, speaker: string, claim: Claim, who: string, at: string): boolean => {
    // Evidence says `who` was in `at`. The claim says who was in claim.room (speaker + with) and nobody else was.
    void people(cs, slot);
    const inClaim = who === speaker || claim.with.includes(who);
    return inClaim ? claim.room !== at : claim.room === at;
  };
  it("presence records and true claims that contradict a catchable lie are all listed", () => {
    let pressed = 0;
    for (let seed = 0; seed < 300; seed++) {
      const cs = generateCase(blackthorn, seed, difficulty);
      for (const ch of cs.claims) {
        ch.versions.forEach((v, index) => {
          if (!v.lie) return;
          const last = index === ch.versions.length - 1;
          for (const it of cs.items) {
            if (it.kind !== "presence" || it.slot !== ch.slot) continue;
            if (!contradicts(cs, ch.slot, ch.speaker, v.claim, it.who, it.at)) continue;
            // The killer's final lie must not be contradicted by anything (non-fallback cases).
            expect(last, `seed ${seed}: ${it.id} contradicts the final lie of ${ch.speaker}`).toBe(false);
            expect(v.refutedBy, `seed ${seed}: ${it.id} vs ${ch.speaker}@${ch.slot}v${index}`).toContainEqual({ kind: "item", id: it.id });
            if (index === 0) {
              // And pressing with it works in play.
              const actions: Action[] = [
                { at: 1, type: "search", room: it.room, spot: it.spot },
                { at: 2, type: "ask", suspect: ch.speaker, slot: ch.slot },
                { at: 3, type: "press", suspect: ch.speaker, slot: ch.slot, evidence: { kind: "item", id: it.id } },
              ];
              expect(replay(cs, actions).lastResult).toEqual({ kind: "cracked", suspect: ch.speaker, slot: ch.slot });
              pressed++;
            }
          }
          if (last) expect(v.refutedBy).toEqual([]);
          else expect(v.refutedBy.length).toBeGreaterThan(0);
        });
      }
      const kb = buildKB(blackthorn, cs).kb;
      expect(solve(kb).unique && solve(kb, { ignoreAdmissions: true }).unique, `seed ${seed}`).toBe(true);
    }
    if (difficulty !== "easy") expect(pressed).toBeGreaterThan(0); // the check saw real data
  });
});
