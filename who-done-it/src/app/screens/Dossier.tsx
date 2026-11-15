import { useEffect } from "react";
import type { Tag } from "../../engine/index";
import { param, useCase } from "../ctx";
import { isPinned, PinButton, statementRef, StatementText } from "../components/Cards";
import { Page } from "../components/Page";
import { Portrait } from "../components/Portrait";
import { bondPublicLine, charBio, charName, charRole, slotLabel } from "../text";
import { TAG_LABEL } from "./People";

export function Dossier() {
  const c = useCase();
  const { store, snap, solo, cs, entry, facts } = c;
  const id = param(snap, "suspect");
  const valid = !!id && solo.view.suspects.includes(id);
  const from = param(snap, "from");
  useEffect(() => {
    if (!valid) store.navigate("people");
  }, [valid, store]);
  if (!valid || !id) return null;

  const name = charName(entry, id);
  const bio = charBio(entry, id);
  const inCase = new Set([...cs.suspects, cs.victim]);
  const bonds = facts.bonds.filter((b) => b.public && inCase.has(b.from) && inCase.has(b.to) && (b.from === id || b.to === id));
  const tag = solo.state.tags[id] ?? "none";
  const over = solo.state.solved || solo.state.gaveUp;

  return (
    <Page title="Dossier" back={() => store.navigate(from === "notebook" ? "notebook" : "people")} caseScreen>
      <section className="person">
        <Portrait name={name} large />
        <div>
          <div className="h2">{name}</div>
          <div className="muted small">{charRole(entry, id)}</div>
        </div>
      </section>
      {bio && <p className="prose">{bio}</p>}

      {bonds.length > 0 && (
        <section className="stack" aria-label="Known bonds">
          <h2 className="eyebrow">Known bonds</h2>
          <ul className="stack">
            {bonds.map((b) => (
              <li key={`${b.from}-${b.to}`} className="note small serif">
                {bondPublicLine(entry, b.from, b.to)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack" aria-label="Your mark">
        <h2 className="eyebrow">Your mark</h2>
        <div className="segment" role="group" aria-label={`Mark for ${name}`}>
          {(["none", "suspect", "cleared"] as Tag[]).map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => store.dispatch({ type: "tag", suspect: id, tag: t })}>
              {TAG_LABEL[t]}
            </button>
          ))}
        </div>
      </section>

      <section className="stack" aria-label="The evening">
        <h2 className="eyebrow">The evening</h2>
        {facts.slots.map((s) => {
          const st = solo.view.statements.find((x) => x.speaker === id && x.slot === s.id);
          const label = slotLabel(entry, s.id);
          return (
            <div key={s.id} className="card slotrow">
              <div className="slotrow__time">{label}</div>
              {!st ? (
                <div className="row">
                  <button type="button" className="btn btn--small" disabled={over} aria-label={`Ask ${name} about ${label}`} onClick={() => store.dispatch({ type: "ask", suspect: id, slot: s.id })}>
                    Ask
                  </button>
                  <span className="small muted">Costs one question.</span>
                </div>
              ) : (
                <>
                  <StatementText c={c} st={st} />
                  <div className="slotrow__actions">
                    <button type="button" className="btn btn--small" disabled={over} aria-label={`Press ${name} about ${label}`} onClick={() => store.navigate("press", { suspect: id, slot: s.id })}>
                      Press
                    </button>
                    <PinButton
                      pinned={isPinned(c, st)}
                      what={`${name}, ${label}`}
                      onPin={(on) => store.dispatch({ type: "pin", ref: statementRef(st), on })}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </section>
    </Page>
  );
}
