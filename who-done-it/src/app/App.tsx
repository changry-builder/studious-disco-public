import { useEffect, useState, type ReactElement } from "react";
import { GameContext } from "./ctx";
import { useStore, type Store } from "./store";
import { Accuse } from "./screens/Accuse";
import { Briefing } from "./screens/Briefing";
import { Dossier } from "./screens/Dossier";
import { EnterCode } from "./screens/EnterCode";
import { Home } from "./screens/Home";
import { House } from "./screens/House";
import { NewCase } from "./screens/NewCase";
import { Notebook } from "./screens/Notebook";
import { People } from "./screens/People";
import { Press } from "./screens/Press";
import { Result } from "./screens/Result";
import { Room } from "./screens/Room";
import { Rules } from "./screens/Rules";
import "./styles/base.css";
import "./styles/screens.css";

export const CASE_SCREENS = ["house", "room", "people", "dossier", "press", "notebook", "accuse"];
const NEEDS_CASE = [...CASE_SCREENS, "briefing"];

const SCREENS: Record<string, () => ReactElement | null> = {
  home: Home, new: NewCase, code: EnterCode, rules: Rules, briefing: Briefing, house: House, room: Room, people: People,
  dossier: Dossier, press: Press, notebook: Notebook, accuse: Accuse, result: Result,
};

function useVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return visible;
}

export function App({ store }: { store: Store }) {
  const snap = useStore(store);
  const visible = useVisible();
  let screen = snap.nav.screen;
  if (!SCREENS[screen] || (NEEDS_CASE.includes(screen) && !snap.solo)) screen = "home";
  const playing = CASE_SCREENS.includes(screen) && !!snap.solo;

  // Play time counts only while a case screen is showing and the app is in the foreground.
  useEffect(() => {
    if (playing && visible) store.startTimer();
    else store.stopTimer();
    return () => store.stopTimer();
  }, [playing, visible, store]);

  // A saved screen that no longer makes sense falls back to Home.
  useEffect(() => {
    if (screen !== snap.nav.screen) store.navigate(screen);
  }, [screen, snap.nav.screen, store]);

  // Move to the top of the page when the screen changes.
  useEffect(() => {
    document.getElementById("main")?.scrollTo?.(0, 0);
  }, [screen, snap.nav.params]);

  const Screen = SCREENS[screen]!;
  return (
    <GameContext.Provider value={{ store, snap }}>
      <div className="app">
        <Screen />
      </div>
    </GameContext.Provider>
  );
}
