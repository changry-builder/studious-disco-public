import { useGame } from "../ctx";
import { Page } from "../components/Page";
import { RulesList } from "../components/rules";

export function Rules() {
  const { store } = useGame();
  return (
    <Page title="How to play" back={() => store.navigate(store.getSnapshot().solo ? "notebook" : "home")}>
      <p className="muted">These rules are always true. Every deduction in the game comes from them.</p>
      <RulesList />
    </Page>
  );
}
