import { useState } from "react";
import { refKey, type StatementView } from "../../engine/index";
import { useCase, type CaseCtx } from "../ctx";
import { isPinned, ItemCard, PinButton, statementRef, StatementText } from "../components/Cards";
import { Page } from "../components/Page";
import { RulesList } from "../components/rules";
import { Sheet } from "../components/Sheet";
import { charName, claimSentence, roomName, slotLabel } from "../text";

type TabId = "timeline" | "clues" | "testimony" | "pinned" | "rules";
const TABS: { id: TabId; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "clues", label: "Clues" },
  { id: "testimony", label: "Testimony" },
  { id: "pinned", label: "Pinned" },
  { id: "rules", label: "Rules" },
];

export function Notebook() {
  const c = useCase();
  const [tab, setTab] = useState<TabId>("timeline");
  return (
    <Page title="Notebook" caseScreen>
      <div className="tabs" role="tablist" aria-label="Notebook sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="tabpanel" className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="stack stack--lg" role="tabpanel" id="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "timeline" && <Timeline c={c} />}
        {tab === "clues" && <Clues c={c} />}
        {tab === "testimony" && <Testimony c={c} />}
        {tab === "pinned" && <Pinned c={c} />}
        {tab === "rules" && <RulesList />}
      </div>
    </Page>
  );
}

function statementPin(c: CaseCtx, st: StatementView) {
  return (
    <PinButton
      pinned={isPinned(c, st)}
      what={`${charName(c.entry, st.speaker)}, ${slotLabel(c.entry, st.slot)}`}
      onPin={(on) => c.store.dispatch({ type: "pin", ref: statementRef(st), on })}
    />
  );
}

// ---------------------------------------------------------------- timeline

function Timeline({ c }: { c: CaseCtx }) {
  const { solo, entry, facts, store } = c;
  const [open, setOpen] = useState<StatementView | null>(null);
  // Re-read so the sheet reflects pins and cracks while open.
  const current = open ? solo.view.statements.find((s) => s.speaker === open.speaker && s.slot === open.slot) ?? null : null;
  return (
    <>
      <p className="muted small">Each cell fills in when you ask. Tap a cell to read it in full.</p>
      <div className="gridwrap" tabIndex={0} role="region" aria-label="Timeline grid, scrolls sideways">
        <table className="tgrid">
          <thead>
            <tr>
              <th className="tgrid__name" scope="col">
                <span className="sr-only">Suspect</span>
              </th>
              {facts.slots.map((s) => (
                <th key={s.id} scope="col">
                  {slotLabel(entry, s.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {solo.view.suspects.map((id) => (
              <tr key={id}>
                <th className="tgrid__name" scope="row">
                  {charName(entry, id)}
                </th>
                {facts.slots.map((s) => {
                  const st = solo.view.statements.find((x) => x.speaker === id && x.slot === s.id);
                  if (!st) {
                    return (
                      <td key={s.id}>
                        <span className="tcell tcell--empty" aria-label={`${charName(entry, id)}, ${slotLabel(entry, s.id)}: not asked`} />
                      </td>
                    );
                  }
                  const cl = st.versions[st.versions.length - 1]!;
                  const others = cl.with.length;
                  return (
                    <td key={s.id}>
                      <button
                        type="button"
                        className="tcell"
                        onClick={() => setOpen(st)}
                        aria-label={`${charName(entry, id)}, ${slotLabel(entry, s.id)}: ${roomName(entry, cl.room)}, ${others === 0 ? "alone" : `names ${others} other${others === 1 ? "" : "s"}`}`}
                      >
                        <span className="tcell__room">{roomName(entry, cl.room)}</span>
                        <span className="tcell__with">{others === 0 ? "alone" : `names ${others}`}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && current && (
        <Sheet title={`${charName(entry, current.speaker)}, ${slotLabel(entry, current.slot)}`} onClose={() => setOpen(null)}>
          <StatementText c={c} st={current} />
          <div className="slotrow__actions">
            {statementPin(c, current)}
            <button type="button" className="btn btn--small" onClick={() => store.navigate("dossier", { suspect: current.speaker, from: "notebook" })}>
              Go to dossier
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

// ---------------------------------------------------------------- clues

function Clues({ c }: { c: CaseCtx }) {
  const { solo, entry, facts, store } = c;
  const [room, setRoom] = useState<string>("all");
  const items = [...solo.view.items].reverse();
  const where = (i: (typeof items)[number]) => ("room" in i ? i.room : "body");
  const rooms = ["body", ...facts.rooms.map((r) => r.id)].filter((r) => items.some((i) => where(i) === r));
  const shown = room === "all" ? items : items.filter((i) => where(i) === room);
  if (items.length === 0) return <p className="muted">No clues yet. Search the rooms and examine the body.</p>;
  return (
    <>
      <div className="chips chips--scroll" role="group" aria-label="Filter clues by where they were found">
        <button type="button" className="chip" aria-pressed={room === "all"} onClick={() => setRoom("all")}>
          All
        </button>
        {rooms.map((r) => (
          <button key={r} type="button" className="chip" aria-pressed={room === r} onClick={() => setRoom(r)}>
            {r === "body" ? "The body" : roomName(entry, r)}
          </button>
        ))}
      </div>
      <ul className="stack">
        {shown.map((i) => (
          <li key={i.id}>
            <ItemCard c={c} item={i} pinned={solo.state.pins.includes(refKey({ kind: "item", id: i.id }))} onPin={(on) => store.dispatch({ type: "pin", ref: { kind: "item", id: i.id }, on })} />
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------- testimony

function Testimony({ c }: { c: CaseCtx }) {
  const { solo, entry, facts } = c;
  const [by, setBy] = useState<"person" | "time">("person");
  const all = solo.view.statements;
  if (all.length === 0) return <p className="muted">Nobody has been questioned yet. Open a dossier and ask.</p>;
  const groups =
    by === "person"
      ? solo.view.suspects.map((id) => ({ key: id, title: charName(entry, id), list: all.filter((s) => s.speaker === id).sort((a, b) => a.slot - b.slot) }))
      : facts.slots.map((s) => ({ key: String(s.id), title: slotLabel(entry, s.id), list: all.filter((x) => x.slot === s.id) }));
  return (
    <>
      <div className="segment" style={{ gridTemplateColumns: "1fr 1fr" }} role="group" aria-label="Group testimony">
        <button type="button" className="chip" aria-pressed={by === "person"} onClick={() => setBy("person")}>
          By person
        </button>
        <button type="button" className="chip" aria-pressed={by === "time"} onClick={() => setBy("time")}>
          By time
        </button>
      </div>
      {groups
        .filter((g) => g.list.length > 0)
        .map((g) => (
          <section key={g.key} className="stack" aria-label={g.title}>
            <h2 className="h2">{g.title}</h2>
            {g.list.map((st) => (
              <div key={`${st.speaker}:${st.slot}`} className="card stack">
                <StatementText c={c} st={st} />
                <div className="row">
                  <span className="eyebrow grow">{by === "person" ? slotLabel(entry, st.slot) : charName(entry, st.speaker)}</span>
                  {statementPin(c, st)}
                </div>
              </div>
            ))}
          </section>
        ))}
    </>
  );
}

// ---------------------------------------------------------------- pinned

function Pinned({ c }: { c: CaseCtx }) {
  const { solo, entry, store } = c;
  const pins = solo.state.pins;
  if (pins.length === 0) return <p className="muted">Nothing pinned. Use Pin on a clue or a statement to keep it here.</p>;
  return (
    <ul className="stack">
      {pins.map((key) => {
        if (key.startsWith("i:")) {
          const item = solo.view.items.find((i) => i.id === key.slice(2));
          if (!item) return null;
          return (
            <li key={key}>
              <ItemCard c={c} item={item} pinned onPin={() => store.dispatch({ type: "pin", ref: { kind: "item", id: item.id }, on: false })} />
            </li>
          );
        }
        const [, speaker, slotText, versionText] = key.split(":");
        const slot = Number(slotText);
        const version = Number(versionText);
        const st = solo.view.statements.find((s) => s.speaker === speaker && s.slot === slot);
        if (!st || !speaker) return null;
        const single: StatementView = { ...st, versions: [st.versions[version]!].filter(Boolean) };
        if (single.versions.length === 0) return null;
        const withdrawn = version < st.versions.length - 1;
        return (
          <li key={key} className="card stack">
            <div className="eyebrow">
              {charName(entry, speaker)} · {slotLabel(entry, slot)}
              {withdrawn ? " · withdrawn" : ""}
            </div>
            {withdrawn ? (
              <p className="statement struck">
                <s>{statementTextOf(c, single)}</s>
              </p>
            ) : (
              <StatementText c={c} st={single} />
            )}
            <div className="itemcard__actions">
              <PinButton pinned what={`${charName(entry, speaker)}, ${slotLabel(entry, slot)}`} onPin={() => store.dispatch({ type: "pin", ref: statementRef(st, version), on: false })} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function statementTextOf(c: CaseCtx, st: StatementView): string {
  return claimSentence(c.entry, c.cs.seed, st.speaker, st.slot, st.versions[0]!);
}
