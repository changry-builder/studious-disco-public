import { useState } from "react";
import { MOTIVE_TYPES, SCORE, type MotiveType } from "../../engine/index";
import { useCase } from "../ctx";
import { EvidenceChooser } from "../components/EvidenceChooser";
import { evidenceOptions, type EvidenceOption } from "../components/evidence";
import { Page } from "../components/Page";
import { Sheet } from "../components/Sheet";
import { charName, motiveLabel, roomInline, roomName, weaponName } from "../text";

type Slot = "who" | "what" | "why";
const SLOT_LABEL: Record<Slot, string> = { who: "Who did it", what: "The weapon", why: "The motive" };
type Outcome = { kind: "wrong"; wrongCount: number } | { kind: "weakProof" } | null;

function Picker<T extends string>({ label, value, options, onPick }: { label: string; value: T | null; options: { id: T; name: string }[]; onPick: (v: T) => void }) {
  return (
    <fieldset className="pick" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="eyebrow" style={{ padding: 0, marginBottom: "var(--sp-2)" }}>{label}</legend>
      <div className="pick__grid" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="chip" onClick={() => onPick(o.id)}>
            {o.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Accuse() {
  const c = useCase();
  const { store, solo, cs, entry, facts } = c;
  const [who, setWho] = useState<string | null>(null);
  const [weapon, setWeapon] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [motive, setMotive] = useState<MotiveType | null>(null);
  const [support, setSupport] = useState<Record<Slot, EvidenceOption | null>>({ who: null, what: null, why: null });
  const [choosing, setChoosing] = useState<Slot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const options = evidenceOptions(c);
  const keep = (o: EvidenceOption | null) => (o && options.some((x) => x.key === o.key) ? o : null);
  const sup = { who: keep(support.who), what: keep(support.what), why: keep(support.why) };
  const ready = !!who && !!weapon && !!room && !!motive && !!sup.who && !!sup.what && !!sup.why;
  const over = solo.state.solved || solo.state.gaveUp;

  const accuse = () => {
    if (!ready || !who || !weapon || !room || !motive || !sup.who || !sup.what || !sup.why) return;
    store.dispatch({ type: "accuse", who, weapon, room, motive, support: { who: sup.who.ref, what: sup.what.ref, why: sup.why.ref } });
    const last = store.getSnapshot().solo?.state.lastResult ?? null;
    setConfirming(false);
    if (last?.kind === "solved") {
      store.finishSolo();
      store.navigate("result");
    } else if (last?.kind === "wrong" || last?.kind === "weakProof") {
      setOutcome(last);
    }
  };
  const giveUp = () => {
    store.dispatch({ type: "giveUp" });
    store.finishSolo();
    store.navigate("result");
  };
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOutcome(null);
    setConfirming(false);
  };

  return (
    <Page title="Accuse" caseScreen>
      <p className="muted small">Name the killer, the weapon, the room and the motive, then back three of them with evidence you hold. You may accuse as often as you like, but a wrong accusation costs points.</p>

      {outcome?.kind === "weakProof" && (
        <p className="note prose" role="alert">
          Your theory is right, but that would not convince a jury. Try other evidence.
        </p>
      )}
      {outcome?.kind === "wrong" && (
        <p className="note prose" role="alert">
          Not quite.
          {cs.difficulty === "easy" && ` ${outcome.wrongCount} of your four answers ${outcome.wrongCount === 1 ? "is" : "are"} wrong.`}
        </p>
      )}

      <Picker label="Who" value={who} options={solo.view.suspects.map((id) => ({ id, name: charName(entry, id) }))} onPick={edit(setWho)} />
      <Picker label="With what" value={weapon} options={facts.weapons.map((w) => ({ id: w.id, name: weaponName(entry, w.id) }))} onPick={edit(setWeapon)} />
      <Picker label="Where" value={room} options={facts.rooms.map((r) => ({ id: r.id, name: roomName(entry, r.id) }))} onPick={edit(setRoom)} />
      <Picker label="Why" value={motive} options={MOTIVE_TYPES.map((m) => ({ id: m, name: motiveLabel(entry, m) }))} onPick={edit(setMotive)} />

      <section className="stack" aria-label="Your evidence">
        <h2 className="eyebrow">Your evidence</h2>
        {(["who", "what", "why"] as Slot[]).map((s) => (
          <button key={s} type="button" className="card card--tap evslot" onClick={() => setChoosing(s)} aria-label={`${SLOT_LABEL[s]}: ${sup[s] ? sup[s]!.title : "choose evidence"}`}>
            <span>
              <span className="evslot__label" style={{ display: "block" }}>{SLOT_LABEL[s]}</span>
              <span className="evslot__value" style={{ display: "block" }}>{sup[s] ? sup[s]!.title : "Choose evidence"}</span>
            </span>
            <span className="muted" aria-hidden="true">›</span>
          </button>
        ))}
      </section>

      <div className="stack">
        {!confirming ? (
          <button type="button" className="btn btn--primary btn--block" disabled={!ready || over} onClick={() => setConfirming(true)}>
            Make the accusation
          </button>
        ) : (
          <div className="card card--accent stack" role="group" aria-label="Confirm the accusation">
            <p>
              Accuse <b>{charName(entry, who ?? "")}</b> of killing {charName(entry, cs.victim)} with <b>{weaponName(entry, weapon ?? "")}</b> in <b>{roomInline(entry, room ?? "")}</b>, out of <b>{motive ? motiveLabel(entry, motive).toLowerCase() : ""}</b>?
            </p>
            <p className="small muted">If any of the four is wrong, it costs {SCORE.perWrongAccusation} points.</p>
            <div className="row">
              <button type="button" className="btn grow" onClick={() => setConfirming(false)}>
                Not yet
              </button>
              <button type="button" className="btn btn--primary grow" onClick={accuse}>
                Yes, accuse
              </button>
            </div>
          </div>
        )}
        {!ready && <p className="small muted">Choose all four answers and one piece of evidence for each of who, what and why.</p>}
      </div>

      <div className="stack" style={{ alignItems: "center" }}>
        {!givingUp ? (
          <button type="button" className="btn btn--quiet btn--small" onClick={() => setGivingUp(true)}>
            Give up and see the answer
          </button>
        ) : (
          <div className="card stack" role="group" aria-label="Confirm giving up" style={{ width: "100%" }}>
            <p>Give up? You will see the answer, but the case will not count as solved.</p>
            <div className="row">
              <button type="button" className="btn grow" onClick={() => setGivingUp(false)}>
                Keep investigating
              </button>
              <button type="button" className="btn btn--primary grow" onClick={giveUp}>
                Show me
              </button>
            </div>
          </div>
        )}
      </div>

      {choosing && (
        <Sheet title={`Evidence: ${SLOT_LABEL[choosing].toLowerCase()}`} onClose={() => setChoosing(null)}>
          <EvidenceChooser
            c={c}
            options={options}
            selected={sup[choosing]?.key ?? null}
            onSelect={(o) => {
              setSupport({ ...support, [choosing]: o });
              setOutcome(null);
              setConfirming(false);
              setChoosing(null);
            }}
          />
        </Sheet>
      )}
    </Page>
  );
}
