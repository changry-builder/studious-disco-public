import type { Difficulty } from "../../engine/index";
import { useGame } from "../ctx";
import { Page } from "../components/Page";

const CHOICES: { id: Difficulty; name: string; lines: string[] }[] = [
  { id: "easy", name: "Easy", lines: ["4 suspects, one lie to catch.", "The time of death is exact and the weapon turns up.", "Feels like one clean contradiction."] },
  { id: "medium", name: "Medium", lines: ["5 suspects, two lies to catch, one after the other.", "The time of death is one of two half-hours and the weapon is hidden.", "A confession unlocks the real lie."] },
  { id: "hard", name: "Hard", lines: ["6 suspects, three lies to catch.", "The time of death is one of three half-hours and the weapon may never be found.", "A covered alibi, and alibis alone are not enough."] },
];

export function NewCase() {
  const { store, snap } = useGame();
  const start = (d: Difficulty) => {
    store.newCase(d);
    store.navigate("briefing");
  };
  return (
    <Page title="New case" back={() => store.navigate("home")}>
      <p className="muted">How hard should it be?</p>
      {snap.solo && <p className="note small">Starting a new case replaces the one you are playing.</p>}
      <div className="stack">
        {CHOICES.map((c) => (
          <button key={c.id} type="button" className="card card--tap choice" onClick={() => start(c.id)}>
            <span className="choice__name">{c.name}</span>
            <span className="choice__list">{c.lines.join(" ")}</span>
          </button>
        ))}
      </div>
    </Page>
  );
}
