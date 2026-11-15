// Engine acceptance run. Usage: npm run verify -- --seeds 1000 [--start 0] [--difficulty easy]
// For every seed and difficulty: generate twice (determinism), solve the full closure (uniqueness),
// and report attempts, repairs and fallbacks.

import { buildKB, DIFFICULTIES, generateCase, solve, validateScenario, type Difficulty } from "../src/engine/index";
import { blackthorn } from "../src/scenarios/blackthorn/facts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const seeds = Number(arg("seeds", "200"));
const start = Number(arg("start", "0"));
const only = arg("difficulty", "");
const levels: Difficulty[] = only ? [only as Difficulty] : [...DIFFICULTIES];

const problems = validateScenario(blackthorn);
if (problems.length > 0) {
  console.error("Scenario is invalid:\n" + problems.join("\n"));
  process.exit(1);
}

let failed = false;
for (const difficulty of levels) {
  let unique = 0, deterministic = 0, fallbacks = 0, attempts = 0, repairs = 0, par = 0;
  const killers: Record<string, number> = {};
  const t0 = Date.now();
  for (let seed = start; seed < start + seeds; seed++) {
    const a = generateCase(blackthorn, seed, difficulty);
    const b = generateCase(blackthorn, seed, difficulty);
    if (JSON.stringify(a) === JSON.stringify(b)) deterministic++;
    const res = solve(buildKB(blackthorn, a).kb);
    const f = res.fits[0];
    if (res.unique && f && f.killer === a.solution.killer && f.weapon === a.solution.weapon && f.motive === a.solution.motive) unique++;
    else console.error(`NOT UNIQUE: ${difficulty} seed ${seed}: ${JSON.stringify(res.fits)}`);
    if (a.fallback) fallbacks++;
    attempts += a.attempt + 1;
    repairs += a.repairs;
    par += a.par.questions;
    killers[a.solution.killer] = (killers[a.solution.killer] ?? 0) + 1;
  }
  const pct = (n: number) => `${((100 * n) / seeds).toFixed(1)}%`;
  console.log(
    `${difficulty.padEnd(6)} seeds=${seeds} unique=${pct(unique)} deterministic=${pct(deterministic)} ` +
      `fallback=${pct(fallbacks)} avgAttempts=${(attempts / seeds).toFixed(2)} avgRepairs=${(repairs / seeds).toFixed(2)} ` +
      `avgPar=${(par / seeds).toFixed(1)} time=${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  console.log(`       killers: ${JSON.stringify(killers)}`);
  if (unique !== seeds || deterministic !== seeds) failed = true;
}
process.exit(failed ? 1 : 0);
