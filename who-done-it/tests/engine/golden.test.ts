// If this fails, generated cases changed. That is only allowed together with a GEN_VERSION bump in src/engine/difficulty.ts; then update the snapshot with `npx vitest run -u`.
// Golden snapshots of the full generated case (truth, claims, items, solution) for seeds 1, 2 and 3 at every difficulty.
import { DIFFICULTIES, generateCase } from "../../src/engine/index";
import { blackthorn } from "../../src/scenarios/blackthorn/facts";

describe.each(DIFFICULTIES)("golden cases (%s)", (d) => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed} matches the snapshot`, () => {
      expect(JSON.stringify(generateCase(blackthorn, seed, d))).toMatchSnapshot();
    });
  }
});
