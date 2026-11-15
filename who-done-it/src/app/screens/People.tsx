import { useCase } from "../ctx";
import { Page } from "../components/Page";
import { Portrait } from "../components/Portrait";
import { charName, charRole } from "../text";

export const TAG_LABEL = { none: "No mark", suspect: "Suspect", cleared: "Cleared" } as const;

export function People() {
  const { store, solo, entry } = useCase();
  return (
    <Page title="People" caseScreen>
      <p className="muted small">Tap a name to open their dossier and question them.</p>
      <ul className="stack">
        {solo.view.suspects.map((id) => {
          const tag = solo.state.tags[id] ?? "none";
          const asked = solo.view.statements.filter((s) => s.speaker === id).length;
          return (
            <li key={id}>
              <button type="button" className="card card--tap person" onClick={() => store.navigate("dossier", { suspect: id })}>
                <Portrait name={charName(entry, id)} />
                <span className="grow">
                  <span className="person__name" style={{ display: "block" }}>{charName(entry, id)}</span>
                  <span className="person__role" style={{ display: "block" }}>{charRole(entry, id)}</span>
                  <span className="person__role" style={{ display: "block" }}>{asked} of 6 half-hours asked</span>
                </span>
                <span className={tag === "suspect" ? "pill pill--accent" : "pill"}>{TAG_LABEL[tag]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
