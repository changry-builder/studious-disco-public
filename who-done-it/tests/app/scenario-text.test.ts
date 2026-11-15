// Task 4.2: every text key the style guide asks for exists, uses only its allowed placeholders, and respects its limit.
import { scenarios } from "../../src/scenarios/index";

type Spec = { key: string; allowed: string[]; chars?: number; words?: number; variants: number };

const words = (s: string) => s.trim().split(/\s+/).length;

for (const { facts, text } of scenarios) {
  const specs: Spec[] = [];
  const add = (key: string, variants: number, allowed: string[] = [], chars?: number, wordsMax?: number) =>
    specs.push({ key, allowed, chars, words: wordsMax, variants });
  const ids = facts.characters.map((c) => c.id);

  add("scenario.title", 1, [], 40);
  add("scenario.blurb", 1, [], undefined, 25);
  for (const v of facts.victims) add(`briefing.${v}`, 1, [], undefined, 80);
  for (const c of facts.characters) {
    add(`char.${c.id}.name`, 1, [], 30);
    add(`char.${c.id}.role`, 1, [], 30);
    add(`char.${c.id}.line`, 1, [], 80);
    add(`char.${c.id}.bio`, 1, [], undefined, 60);
    for (const o of ids) if (o !== c.id) add(`char.${c.id}.address.${o}`, 1, [], 30);
    add(`char.${c.id}.claim.alone`, 3, ["room", "time"], 140);
    add(`char.${c.id}.claim.with`, 3, ["room", "time", "company"], 140);
    add(`char.${c.id}.firm`, 2, [], 100);
    add(`char.${c.id}.crack`, 2, [], 120);
    if (c.secret) add(`char.${c.id}.confess`, 1, [], 160);
  }
  for (const b of facts.bonds)
    if (!specs.some((x) => x.key === `char.${b.from}.retractVouch`)) add(`char.${b.from}.retractVouch`, 1, ["name"], 140);
  const optional = new Set(ids.map((id) => `char.${id}.retractVouch`)); // spare lines for non-shields are harmless
  for (const r of facts.rooms) {
    add(`room.${r.id}.name`, 1, [], 24);
    add(`room.${r.id}.desc`, 1, [], undefined, 40);
    add(`room.${r.id}.inline`, 1, [], 30);
    add(`room.${r.id}.proof`, 1, ["name", "time"], 160);
    for (const s of r.spots) {
      add(`room.${r.id}.spot.${s}.name`, 1, [], 24);
      add(`room.${r.id}.spot.${s}.empty`, 1, [], 100);
      add(`room.${r.id}.spot.${s}.inline`, 1, [], 30);
    }
  }
  for (const w of facts.weapons) {
    add(`weapon.${w.id}.name`, 1, [], 24);
    add(`weapon.${w.id}.inline`, 1, [], 30);
    add(`weapon.${w.id}.inPlace`, 1, ["spot"], 120);
    add(`weapon.${w.id}.missing`, 1, ["spot"], 120);
    add(`weapon.${w.id}.foundClean`, 1, ["room", "spot"], 140);
    add(`weapon.${w.id}.foundUsed`, 1, ["room", "spot"], 140);
  }
  for (const m of facts.motives) {
    add(`motive.${m.id}.title`, 1, [], 40);
    add(`motive.${m.id}.text`, 1, [], undefined, 50);
  }
  for (const b of facts.bonds) {
    if (b.public) add(`bond.${b.from}-${b.to}.public`, 1, [], 100);
    else {
      // A two-direction document is stored once, under whichever direction the generator lists first.
      const key = text[`bond.${b.to}-${b.from}.title`] !== undefined ? `${b.to}-${b.from}` : `${b.from}-${b.to}`;
      if (!specs.some((x) => x.key === `bond.${key}.title`)) {
        add(`bond.${key}.title`, 1, [], 40);
        add(`bond.${key}.text`, 1, [], undefined, 50);
      }
    }
  }
  for (const c of facts.characters) if (c.secret) add(`secret.${c.id}.trace`, 1, [], 120);
  for (const k of ["blunt", "blade", "ligature"]) add(`body.wound.${k}`, 1, [], 120);
  add("body.tod.exact", 1, ["time"], 140);
  add("body.tod.window", 1, ["from", "to"], 140);
  for (const t of ["inheritance", "jealousy", "revenge", "debt", "blackmail", "exposure"]) add(`motiveType.${t}`, 1, [], 20);
  for (let n = 0; n <= 5; n++) add(`slot.${n}.inline`, 1, [], 24);

  describe(`text for ${facts.id}`, () => {
    it("has every required key with the right number of variants", () => {
      const problems: string[] = [];
      for (const s of specs) {
        const v = text[s.key];
        if (v === undefined) problems.push(`missing ${s.key}`);
        else if (s.variants === 1 ? typeof v !== "string" : !Array.isArray(v) || v.length !== s.variants)
          problems.push(`${s.key}: wrong variant count`);
      }
      expect(problems).toEqual([]);
    });

    it("uses only allowed placeholders, respects limits, and has no empty text", () => {
      const problems: string[] = [];
      for (const s of specs) {
        const v = text[s.key];
        if (v === undefined) continue;
        for (const line of Array.isArray(v) ? v : [v]) {
          if (!line.trim()) problems.push(`${s.key}: empty`);
          for (const m of line.matchAll(/\{([^}]*)\}/g))
            if (!s.allowed.includes(m[1]!)) problems.push(`${s.key}: unknown placeholder {${m[1]}}`);
          if (s.chars && line.length > s.chars) problems.push(`${s.key}: ${line.length} chars > ${s.chars}`);
          if (s.words && words(line) > s.words) problems.push(`${s.key}: ${words(line)} words > ${s.words}`);
        }
      }
      expect(problems).toEqual([]);
    });

    it("templates use each placeholder they are given", () => {
      const problems: string[] = [];
      for (const s of specs.filter((x) => /claim\.(alone|with)$/.test(x.key))) {
        const need = s.allowed;
        for (const line of text[s.key] as string[])
          for (const p of need) if (!line.includes(`{${p}}`)) problems.push(`${s.key}: missing {${p}} in "${line}"`);
      }
      expect(problems).toEqual([]);
    });

    it("has no keys the guide does not define", () => {
      const known = new Set(specs.map((s) => s.key));
      expect(Object.keys(text).filter((k) => !known.has(k) && !optional.has(k))).toEqual([]);
    });
  });
}
