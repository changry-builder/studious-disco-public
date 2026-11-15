import type { ReactNode } from "react";
import { useGame } from "../ctx";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

interface Props {
  title: string;
  back?: () => void;
  /** Case screens show the questions/time readout and the bottom navigation. */
  caseScreen?: boolean;
  children: ReactNode;
}

export function Page({ title, back, caseScreen, children }: Props) {
  const { store, snap } = useGame();
  const solo = snap.solo;
  return (
    <>
      <TopBar title={title} onBack={back} readout={caseScreen && solo ? { questions: solo.state.questions, par: solo.view.parQuestions, store } : undefined} />
      <main className={caseScreen ? "main" : "main main--bare"} id="main">
        {children}
      </main>
      {caseScreen && <BottomNav screen={snap.nav.screen} go={(s) => store.navigate(s)} />}
    </>
  );
}
