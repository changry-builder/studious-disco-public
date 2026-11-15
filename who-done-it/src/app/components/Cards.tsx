import type { Item, StatementView } from "../../engine/index";
import { refKey } from "../../engine/index";
import type { CaseCtx } from "../ctx";
import { charName, claimSentence, itemText, itemTitle, slotLabel } from "../text";

export function ItemCard({ c, item, pinned, onPin }: { c: CaseCtx; item: Item; pinned?: boolean; onPin?: (on: boolean) => void }) {
  const title = itemTitle(c.entry, item);
  return (
    <article className="card itemcard">
      <h3 className="itemcard__title">{title}</h3>
      <p className="itemcard__text">{itemText(c.entry, c.cs, item)}</p>
      {onPin && (
        <div className="itemcard__actions">
          <PinButton pinned={!!pinned} onPin={onPin} what={title} />
        </div>
      )}
    </article>
  );
}

export function PinButton({ pinned, onPin, what }: { pinned: boolean; onPin: (on: boolean) => void; what: string }) {
  return (
    <button type="button" className="btn btn--small" aria-pressed={pinned} aria-label={`${pinned ? "Unpin" : "Pin"} ${what}`} onClick={() => onPin(!pinned)}>
      {pinned ? "Pinned" : "Pin"}
    </button>
  );
}

export function statementRef(st: StatementView, version = st.versions.length - 1) {
  return { kind: "claim" as const, speaker: st.speaker, slot: st.slot, version };
}
export function isPinned(c: CaseCtx, st: StatementView, version?: number): boolean {
  return c.solo.state.pins.includes(refKey(statementRef(st, version)));
}

/** A statement with its withdrawn versions struck through above it. No judgement about which is true. */
export function StatementText({ c, st, showWho }: { c: CaseCtx; st: StatementView; showWho?: boolean }) {
  const last = st.versions.length - 1;
  return (
    <div className="stack" style={{ gap: "var(--sp-2)" }}>
      {showWho && (
        <div className="eyebrow">
          {charName(c.entry, st.speaker)} · {slotLabel(c.entry, st.slot)}
        </div>
      )}
      {st.versions.map((v, i) => {
        const text = claimSentence(c.entry, c.cs.seed, st.speaker, st.slot, v);
        return i < last ? (
          <p key={i} className="statement struck">
            <span className="sr-only">Withdrawn: </span>
            <s>{text}</s>
          </p>
        ) : (
          <p key={i} className="statement">
            {text}
          </p>
        );
      })}
    </div>
  );
}
