import { useEffect } from "react";
import type { Difficulty } from "../../engine/index";
import { useGame } from "../ctx";
import { Page } from "../components/Page";
import { ShareButton } from "../components/ShareButton";
import { scenarioById, scenarios } from "../../scenarios/index";
import { charName, motiveLabel, roomInline, roomName, slotInline, slotLabel, weaponName } from "../text";

const MULTIPLIER: Record<Difficulty, number> = { easy: 1, medium: 1.5, hard: 2 };

export function Result() {
  const { store, snap } = useGame();
  const fin = snap.lastFinished;
  useEffect(() => {
    if (!fin) store.navigate("home");
  }, [fin, store]);
  if (!fin) return null;

  const { entry: hist, breakdown: b, reveal: rv } = fin;
  const cs = fin.case;
  const scen = scenarioById(cs.scenarioId) ?? scenarios[0]!;
  const solved = hist.solved;
  const mult = MULTIPLIER[cs.difficulty];
  const sol = rv?.solution;
  const loc = rv?.truth.loc ?? {};
  const people = [cs.victim, ...cs.suspects].filter((id) => loc[id]);

  return (
    <Page title="The result">
      <section className="stack" style={{ textAlign: "center" }}>
        <h2 className="h1">{solved ? "Case solved" : "Case closed, unsolved"}</h2>
        <div className="rank">{b.rank}</div>
        <p className="muted small">
          {solved ? "Your accusation held." : "You gave up before naming the killer."} Difficulty: {cs.difficulty}.
        </p>
      </section>

      <section className="card stack" aria-label="Score">
        <h2 className="eyebrow">Score</h2>
        <div className="ledger">
          <div className="ledger__row"><span>Start</span><span>1000</span></div>
          <div className="ledger__row"><span>Questions beyond par</span><span>-{b.questions}</span></div>
          <div className="ledger__row"><span>Failed presses</span><span>-{b.failedPresses}</span></div>
          <div className="ledger__row"><span>Wrong accusations</span><span>-{b.wrongAccusations}</span></div>
          <div className="ledger__row"><span>Time</span><span>-{b.time}</span></div>
          <div className="ledger__row"><span>{solved ? "Score" : "Score (not solved)"}</span><span>{b.base}</span></div>
          <div className="ledger__row"><span>Difficulty multiplier</span><span>×{mult}</span></div>
          <div className="ledger__row ledger__row--total"><span>Total</span><span>{b.total}</span></div>
        </div>
      </section>

      {sol && (
        <section className="card stack" aria-label="The solution">
          <h2 className="eyebrow">What happened</h2>
          <p className="prose">
            <b>{charName(scen, sol.killer)}</b> killed {charName(scen, cs.victim)} with <b>{weaponName(scen, sol.weapon)}</b> in <b>{roomInline(scen, sol.room)}</b> at <b>{slotInline(scen, sol.slot)}</b>, out of <b>{motiveLabel(scen, sol.motive).toLowerCase()}</b>.
          </p>
        </section>
      )}

      {sol && (
        <section className="stack" aria-label="The true timeline">
          <h2 className="eyebrow">Where everyone really was</h2>
          <div className="gridwrap" tabIndex={0} role="region" aria-label="True timeline, scrolls sideways">
            <table className="tgrid">
              <thead>
                <tr>
                  <th className="tgrid__name" scope="col"><span className="sr-only">Person</span></th>
                  {scen.facts.slots.map((s) => (
                    <th key={s.id} scope="col">{slotLabel(scen, s.id)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((id) => (
                  <tr key={id} className={id === sol.killer ? "is-killer" : undefined}>
                    <th className="tgrid__name" scope="row">
                      {charName(scen, id)}
                      {id === sol.killer && <span className="tcell__with" style={{ display: "block", fontWeight: 400 }}>the killer</span>}
                      {id === cs.victim && <span className="tcell__with" style={{ display: "block", fontWeight: 400 }}>the victim</span>}
                    </th>
                    {scen.facts.slots.map((s) => {
                      const room = loc[id]?.[s.id] ?? null;
                      const murder = id === sol.killer && s.id === sol.slot;
                      return (
                        <td key={s.id}>
                          <span className={murder ? "tcell tcell--static tcell--murder" : "tcell tcell--static"}>
                            <span className="tcell__room">{room ? roomName(scen, room) : "Dead"}</span>
                            {murder && <span className="tcell__with">the murder</span>}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card stack" aria-label="Case code">
        <div className="eyebrow">Case code</div>
        <div className="row">
          <code className="serif grow" style={{ fontSize: "var(--fs-lg)", letterSpacing: "0.1em" }}>{hist.code}</code>
          <ShareButton text={`Who Done It? Case ${hist.code}: ${solved ? "solved" : "not solved"}, ${b.rank}, ${b.total} points.`} label="Share result" />
        </div>
      </section>

      <div className="stack">
        <button type="button" className="btn btn--primary btn--block" onClick={() => store.navigate("new")}>
          New case
        </button>
        <button type="button" className="btn btn--block" onClick={() => store.navigate("home")}>
          Home
        </button>
      </div>
    </Page>
  );
}

