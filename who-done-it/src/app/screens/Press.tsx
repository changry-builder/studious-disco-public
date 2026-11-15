import { useEffect, useState } from "react";
import type { LastResult } from "../../engine/index";
import { param, useCase } from "../ctx";
import { EvidenceChooser } from "../components/EvidenceChooser";
import { evidenceOptions, type EvidenceOption } from "../components/evidence";
import { StatementText } from "../components/Cards";
import { Page } from "../components/Page";
import { Portrait } from "../components/Portrait";
import { SCORE } from "../../engine/index";
import { charName, pressReaction, slotLabel } from "../text";

export function Press() {
  const c = useCase();
  const { store, snap, solo, cs, entry } = c;
  const id = param(snap, "suspect");
  const slot = Number(param(snap, "slot"));
  const st = solo.view.statements.find((s) => s.speaker === id && s.slot === slot);
  const [pick, setPick] = useState<EvidenceOption | null>(null);
  const [result, setResult] = useState<LastResult>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!st || !id) store.navigate("people");
  }, [st, id, store]);
  if (!st || !id) return null;

  const name = charName(entry, id);
  const back = () => store.navigate("dossier", { suspect: id });
  const options = evidenceOptions(c, id);
  const selected = pick && options.some((o) => o.key === pick.key) ? pick : null;

  const confirm = () => {
    if (!selected) return;
    const changed = store.dispatch({ type: "press", suspect: id, slot, evidence: selected.ref });
    const last = store.getSnapshot().solo?.state.lastResult ?? null;
    setFailed(!changed);
    setResult(changed ? last : null);
    setPick(null);
  };

  const showing = result && (result.kind === "cracked" || result.kind === "stoodFirm") && result.suspect === id && result.slot === slot ? result : null;

  return (
    <Page title="Press" back={back} caseScreen>
      <section className="card stack" aria-label="The statement">
        <div className="row">
          <Portrait name={name} />
          <div>
            <div className="person__name">{name}</div>
            <div className="slotrow__time">{slotLabel(entry, slot)}</div>
          </div>
        </div>
        <StatementText c={c} st={st} />
      </section>

      {failed && <p className="note" role="alert">That could not be tried.</p>}

      {showing && (
        <section className="note stack" role="status" aria-label="Result of pressing">
          <p className="prose">{pressReaction(entry, id, showing.kind === "cracked" ? "crack" : "firm", cs.seed, slot)}</p>
          {showing.kind === "cracked" ? (
            <p className="small">They have changed their account. The old statement is struck through above.</p>
          ) : (
            <p className="small">{name} stands firm. A failed press costs {SCORE.perFailedPress} points.</p>
          )}
        </section>
      )}

      {showing?.kind === "cracked" ? (
        <button type="button" className="btn btn--primary btn--block" onClick={back}>
          Back to {name}
        </button>
      ) : (
        <>
          <h2 className="h2">{showing ? "Try something else" : "Choose your evidence"}</h2>
          <p className="muted small">Pick one thing you hold and put it to {name}. A failed press costs {SCORE.perFailedPress} points.</p>
          <EvidenceChooser c={c} options={options} selected={selected?.key ?? null} onSelect={(o) => setPick(o)} />
          <div className="actionbar">
            {selected ? (
              <>
                <p className="small">
                  Put <b>{selected.title}</b> to {name}?
                </p>
                <button type="button" className="btn btn--primary btn--block" onClick={confirm}>
                  Press {name} with this
                </button>
              </>
            ) : (
              <p className="small muted">Choose a piece of evidence above.</p>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
