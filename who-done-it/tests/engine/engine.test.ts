import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildKB, decodeCaseCode, DIFFICULTIES, encodeCaseCode, generateCase, MAX_SEED, solve, validateScenario } from "../../src/engine/index";
import { blackthorn } from "../../src/scenarios/blackthorn/facts";

it("engine files import nothing outside the engine", () => {
  const dir = join(__dirname, "../../src/engine");
  for (const f of readdirSync(dir)) {
    const text = readFileSync(join(dir, f), "utf8");
    for (const m of text.matchAll(/from\s+"([^"]+)"/g)) {
      expect(m[1], `${f} imports ${m[1]}`).toMatch(/^\.\/[a-z]+$/);
    }
  }
});

it("the Blackthorn scenario is valid", () => {
  expect(validateScenario(blackthorn)).toEqual([]);
});

describe.each(DIFFICULTIES)("generated cases (%s)", (difficulty) => {
  it("are deterministic and uniquely solvable for 150 seeds", () => {
    for (let seed = 5000; seed < 5150; seed++) {
      const a = generateCase(blackthorn, seed, difficulty);
      expect(JSON.stringify(generateCase(blackthorn, seed, difficulty))).toBe(JSON.stringify(a));
      const res = solve(buildKB(blackthorn, a).kb);
      expect(res.fits, `seed ${seed}`).toEqual([{ killer: a.solution.killer, weapon: a.solution.weapon, motive: a.solution.motive }]);
    }
  });
});

describe("case codes", () => {
  it("round-trip", () => {
    for (const seed of [0, 1, 12345, MAX_SEED]) {
      for (const d of DIFFICULTIES) {
        const code = encodeCaseCode(0, d, seed);
        expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{5}$/);
        expect(decodeCaseCode(code, [0])).toEqual({ ok: true, parts: { genVersion: 1, scenario: 0, difficulty: d, seed } });
        expect(decodeCaseCode(code.toLowerCase().replace("-", " "), [0]).ok).toBe(true);
      }
    }
  });
  it("reports each kind of error", () => {
    const code = encodeCaseCode(0, "hard", 99);
    expect(decodeCaseCode("ABC", [0])).toEqual({ ok: false, error: "length" });
    expect(decodeCaseCode("U" + code.slice(1), [0])).toEqual({ ok: false, error: "symbol" });
    const last = code[code.length - 1] === "0" ? "1" : "0";
    expect(decodeCaseCode(code.slice(0, -1) + last, [0])).toEqual({ ok: false, error: "check" });
    expect(decodeCaseCode(code, [3])).toEqual({ ok: false, error: "scenario" });
    expect(decodeCaseCode(encodeCaseCode(0, "hard", 99, 2), [0])).toEqual({ ok: false, error: "version" });
  });
});
