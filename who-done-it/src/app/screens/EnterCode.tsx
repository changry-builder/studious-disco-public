import { useState } from "react";
import type { CodeError } from "../../engine/index";
import { useGame } from "../ctx";
import { Page } from "../components/Page";

const MESSAGES: Record<CodeError, string> = {
  length: "That code is the wrong length. A case code has nine letters and digits, like 4K2M-9QX7T.",
  symbol: "That code has a character that cannot be in a code. Check it for typing mistakes.",
  check: "That code does not add up. One of its characters is probably mistyped.",
  version: "That code was made by a different version of the game, so it would give a different case here.",
  scenario: "That code is for a scenario this copy of the game does not have.",
  difficulty: "That code does not name a difficulty this game knows.",
};

export function EnterCode() {
  const { store, snap } = useGame();
  const [text, setText] = useState("");
  const [error, setError] = useState<CodeError | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = store.openCode(text);
    if (r.ok) {
      store.navigate("briefing");
    } else {
      setError(r.error);
    }
  };
  return (
    <Page title="Enter a code" back={() => store.navigate("home")}>
      <p className="muted">Someone sent you a case code? Type it here and you will get the same case they did.</p>
      {snap.solo && <p className="note small">Opening a code replaces the case you are playing.</p>}
      <form className="stack stack--lg" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="code">Case code</label>
          <input
            id="code"
            className="input input--code"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="XXXX-XXXXX"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
          />
        </div>
        {error && (
          <p id="code-error" className="note" role="alert">
            {MESSAGES[error]}
          </p>
        )}
        <button type="submit" className="btn btn--primary btn--block">
          Open this case
        </button>
      </form>
    </Page>
  );
}
