import { useEffect, useState } from "react";
import type { Store } from "../store";

interface Props {
  title: string;
  onBack?: () => void;
  readout?: { questions: number; par: number; store: Store };
}

export function TopBar({ title, onBack, readout }: Props) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!readout) return;
    const id = setInterval(() => tick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, [readout]);
  const minutes = readout ? Math.floor(readout.store.getElapsedMs() / 60000) : 0;
  return (
    <header className="topbar">
      {onBack ? (
        <button type="button" className="topbar__back" onClick={onBack} aria-label="Back">
          <span aria-hidden="true">‹</span>
        </button>
      ) : (
        <span className="topbar__spacer" />
      )}
      <h1 className="topbar__title">{title}</h1>
      {readout && (
        <div className="readout" aria-label={`${readout.questions} questions asked, par ${readout.par}, ${minutes} minutes played`}>
          <div>
            <b>{readout.questions}</b> / {readout.par} questions
          </div>
          <div>{minutes} min</div>
        </div>
      )}
    </header>
  );
}
