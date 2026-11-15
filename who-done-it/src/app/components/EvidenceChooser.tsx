import { useState } from "react";
import type { CaseCtx } from "../ctx";
import { slotLabel } from "../text";
import type { EvidenceOption } from "./evidence";

interface Props {
  c: CaseCtx;
  options: EvidenceOption[];
  selected: string | null;
  onSelect: (o: EvidenceOption) => void;
}

/** Search box, a time filter for testimony, and the options grouped as Clues and Testimony. */
export function EvidenceChooser({ c, options, selected, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const needle = q.trim().toLowerCase();
  const match = (o: EvidenceOption) => !needle || `${o.title} ${o.text}`.toLowerCase().includes(needle);
  const clues = options.filter((o) => o.group === "clue" && match(o));
  const talk = options.filter((o) => o.group === "testimony" && match(o) && (slot === null || o.slot === slot));
  const hasTalk = options.some((o) => o.group === "testimony");

  const row = (o: EvidenceOption) => (
    <li key={o.key}>
      <button type="button" className="evopt" aria-pressed={selected === o.key} onClick={() => onSelect(o)}>
        <span className="evopt__title">{o.title}</span>
        <span className="evopt__text">{o.text}</span>
      </button>
    </li>
  );

  if (options.length === 0) {
    return <p className="muted">You hold no evidence yet. Search the rooms, examine the body, or question the suspects.</p>;
  }
  return (
    <div className="stack stack--lg">
      <div className="field">
        <label htmlFor="ev-search">Search your evidence</label>
        <input id="ev-search" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="A name, a room, a word" />
      </div>
      <section className="stack" aria-label="Clues">
        <h3 className="eyebrow">Clues ({clues.length})</h3>
        {clues.length === 0 ? <p className="muted small">None to show.</p> : <ul className="evlist">{clues.map(row)}</ul>}
      </section>
      <section className="stack" aria-label="Testimony">
        <h3 className="eyebrow">Testimony ({talk.length})</h3>
        {hasTalk && (
          <div className="chips chips--scroll" role="group" aria-label="Filter testimony by time">
            <button type="button" className="chip" aria-pressed={slot === null} onClick={() => setSlot(null)}>
              All times
            </button>
            {c.facts.slots.map((s) => (
              <button key={s.id} type="button" className="chip" aria-pressed={slot === s.id} onClick={() => setSlot(slot === s.id ? null : s.id)}>
                {slotLabel(c.entry, s.id)}
              </button>
            ))}
          </div>
        )}
        {talk.length === 0 ? <p className="muted small">None to show.</p> : <ul className="evlist">{talk.map(row)}</ul>}
      </section>
    </div>
  );
}
