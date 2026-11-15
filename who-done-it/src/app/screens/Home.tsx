import { useGame } from "../ctx";
import { Page } from "../components/Page";
import { scenarioTitle } from "../text";
import { scenarios } from "../../scenarios/index";

export function Home() {
  const { store, snap } = useGame();
  const solo = snap.solo;
  const over = !!solo && (solo.state.solved || solo.state.gaveUp);
  const onContinue = () => {
    if (!solo) return;
    if (over) {
      store.finishSolo();
      store.navigate("result");
    } else {
      store.navigate("house");
    }
  };
  return (
    <Page title={scenarioTitle(scenarios[0]!)}>
      <div className="home__title">
        <div className="eyebrow">1926</div>
        <div className="home__mark">Who Done It?</div>
        <hr className="home__rule" />
        <p className="muted serif">A murder mystery for one phone</p>
      </div>
      <div className="stack home">
        {solo && (
          <button type="button" className="btn btn--primary btn--block" onClick={onContinue}>
            {over ? "See how it ended" : "Continue your case"}
          </button>
        )}
        <button type="button" className={solo ? "btn btn--block" : "btn btn--primary btn--block"} onClick={() => store.navigate("new")}>
          New case
        </button>
        <button type="button" className="btn btn--block" onClick={() => store.navigate("code")}>
          Enter a code
        </button>
        <button type="button" className="btn btn--block" aria-disabled="true" onClick={(e) => e.preventDefault()}>
          <span>
            Party mode
            <span className="btn__sub">Coming soon</span>
          </span>
        </button>
        <button type="button" className="btn btn--block" onClick={() => store.navigate("rules")}>
          How to play
        </button>
      </div>
    </Page>
  );
}
