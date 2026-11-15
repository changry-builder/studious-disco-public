// Print one case in full. Usage: npm run show -- --seed 7 --difficulty medium   or   --code XXXX-XXXXX

import { buildKB, decodeCaseCode, encodeCaseCode, generateCase, solve, survivingKillers, type Difficulty } from "../src/engine/index";
import { blackthorn } from "../src/scenarios/blackthorn/facts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

let seed = Number(arg("seed", "1"));
let difficulty = arg("difficulty", "easy") as Difficulty;
const code = arg("code", "");
if (code) {
  const d = decodeCaseCode(code, [blackthorn.index]);
  if (!d.ok) {
    console.error(`Bad code: ${d.error}`);
    process.exit(1);
  }
  seed = d.parts.seed;
  difficulty = d.parts.difficulty;
}

const cs = generateCase(blackthorn, seed, difficulty);
const s = cs.solution;
console.log(`Code ${encodeCaseCode(blackthorn.index, difficulty, seed)}  seed ${seed}  ${difficulty}  attempt ${cs.attempt}  repairs ${cs.repairs}  fallback ${cs.fallback}  par ${cs.par.questions}`);
console.log(`Victim: ${cs.victim}. Solution: ${s.killer}, ${s.weapon}, ${s.motive}, in ${s.room} at slot ${s.slot}.`);
console.log(`Weapon taken at slot ${cs.truth.weaponTakenSlot}; disposition ${cs.truth.disposition}; second liar: ${JSON.stringify(cs.truth.secondLiar)}`);

console.log("\nTruth:");
const pad = (x: string) => x.padEnd(13);
console.log(pad("") + blackthorn.slots.map((sl) => pad(sl.label)).join(""));
for (const c of [cs.victim, ...cs.suspects]) {
  console.log(pad(c) + cs.truth.loc[c]!.map((r) => pad(r ?? "dead")).join(""));
}

console.log("\nLie chains:");
for (const ch of cs.claims) {
  if (ch.versions.length === 1) continue;
  console.log(`  ${ch.speaker} @${ch.slot}:`);
  ch.versions.forEach((v, i) =>
    console.log(`    v${i} ${v.lie ? "LIE " : "true"} ${v.claim.room} with [${v.claim.with.join(", ")}]  refutedBy ${v.refutedBy.map((r) => (r.kind === "item" ? r.id : `${r.speaker}@${r.slot}v${r.version}`)).join(", ") || "-"}`),
  );
}

console.log("\nItems:");
for (const it of cs.items) console.log("  " + JSON.stringify(it));

const { kb } = buildKB(blackthorn, cs);
console.log("\nWithdrawn:", JSON.stringify(kb.withdrawn));
console.log("Fits:", JSON.stringify(solve(kb).fits));
console.log("Fits ignoring admissions:", JSON.stringify(solve(kb, { ignoreAdmissions: true }).fits));
for (const f of ["opportunity", "means", "motive"] as const) {
  console.log(`Survive ${f} alone (no admissions):`, survivingKillers(kb, [f], true).join(", "));
}
