import { useCase } from "../ctx";
import { Page } from "../components/Page";
import { Portrait } from "../components/Portrait";
import { ShareButton } from "../components/ShareButton";
import { briefingText, charLine, charName, charRole, roomInline, scenarioTitle } from "../text";

export function Briefing() {
  const c = useCase();
  const { store, entry, cs, solo } = c;
  return (
    <Page title="The briefing" back={() => store.navigate("home")}>
      <section className="stack">
        <div className="eyebrow">{scenarioTitle(entry)}</div>
        <h2 className="h1">{charName(entry, cs.victim)}</h2>
        <p className="muted">
          {charRole(entry, cs.victim)}. Found dead in <b>{roomInline(entry, cs.body.room)}</b>.
        </p>
        <p className="prose">{briefingText(entry, cs.victim)}</p>
      </section>
      <section className="stack" aria-label="Suspects">
        <h2 className="eyebrow">In the house</h2>
        <ul className="stack">
          {solo.view.suspects.map((id) => (
            <li key={id} className="card person">
              <Portrait name={charName(entry, id)} />
              <div className="grow">
                <div className="person__name">{charName(entry, id)}</div>
                <div className="person__role">{charRole(entry, id)}</div>
                <div className="person__line">{charLine(entry, id)}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card stack" aria-label="Case code">
        <div className="eyebrow">Case code</div>
        <div className="row">
          <code className="serif grow" style={{ fontSize: "var(--fs-lg)", letterSpacing: "0.1em" }}>{solo.session.code}</code>
          <ShareButton text={`Who Done It? Try case ${solo.session.code}`} />
        </div>
        <p className="small muted">Anyone who types this code gets the same case.</p>
      </section>
      <button type="button" className="btn btn--primary btn--block" onClick={() => store.navigate("house")}>
        Begin
      </button>
    </Page>
  );
}
