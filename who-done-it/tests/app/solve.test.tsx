// Plays easy cases to a solved Result: evidence is gathered through the store, then the
// press and the accusation are made by clicking, as a player would.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "../../src/app/App";
import { createMemoryStore, type Store } from "../../src/app/store";
import { claimSentence, itemText, charName, weaponName, roomName, motiveLabel } from "../../src/app/text";
import { scenarioById } from "../../src/scenarios/index";
import { validSupport, type Case, type EvidenceRef } from "../../src/engine/index";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const click = (el: Element) => act(() => void el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const byText = (selector: string, text: string): Element => {
  const all = [...host.querySelectorAll(selector)];
  const hit = all.find((e) => (e.textContent ?? "").includes(text));
  if (!hit) throw new Error(`No ${selector} containing "${text}". Have: ${all.map((e) => e.textContent).join(" | ")}`);
  return hit;
};

function solve(seed: number) {
  const store: Store = createMemoryStore();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<App store={store} />));
  act(() => store.newCase("easy", seed));
  const cs: Case = store.getSnapshot().solo!.session.case;
  const entry = scenarioById(cs.scenarioId)!;
  const sol = cs.solution; // a test may look at the answer; the app may not
  const support = validSupport(cs);
  const refuter = support.who.find((r): r is Extract<EvidenceRef, { kind: "claim" }> => r.kind === "claim")!;
  const refText = (r: EvidenceRef): string => {
    if (r.kind === "item") return itemText(entry, cs, cs.items.find((i) => i.id === r.id)!);
    const chain = cs.claims.find((c) => c.speaker === r.speaker && c.slot === r.slot)!;
    return claimSentence(entry, cs.seed, r.speaker, r.slot, chain.versions[r.version]!.claim);
  };

  // Gather: examine the body, search everywhere, ask the killer and the witness about the murder slot.
  act(() => {
    store.dispatch({ type: "examineBody" });
    for (const room of entry.facts.rooms) for (const spot of room.spots) store.dispatch({ type: "search", room: room.id, spot });
    store.dispatch({ type: "ask", suspect: sol.killer, slot: sol.slot });
    store.dispatch({ type: "ask", suspect: refuter.speaker, slot: refuter.slot });
  });

  // Press the killer with the witness's statement, by clicking.
  act(() => store.navigate("press", { suspect: sol.killer, slot: sol.slot }));
  click(byText("button.evopt", refText(refuter)));
  click(byText("button", `Press ${charName(entry, sol.killer)} with this`));
  expect(host.textContent).toContain("changed their account");
  expect(store.getSnapshot().solo!.state.failedPresses).toBe(0);
  expect(store.getSnapshot().solo!.view.statements.find((s) => s.speaker === sol.killer && s.slot === sol.slot)!.versions.length).toBe(2);

  // Accuse, by clicking.
  act(() => store.navigate("accuse"));
  const radio = (label: string) => [...host.querySelectorAll('button[role="radio"]')].find((b) => (b.textContent ?? "").trim() === label)!;
  click(radio(charName(entry, sol.killer)));
  click(radio(weaponName(entry, sol.weapon)));
  click(radio(roomName(entry, sol.room)));
  click(radio(motiveLabel(entry, sol.motive)));
  const picks: EvidenceRef[] = [refuter, support.what[0]!, support.why[0]!];
  picks.forEach((ref, i) => {
    click(host.querySelectorAll("button.evslot")[i]!);
    click(byText("button.evopt", refText(ref)));
  });
  click(byText("button", "Make the accusation"));
  click(byText("button", "Yes, accuse"));

  const snap = store.getSnapshot();
  expect(snap.nav.screen).toBe("result");
  expect(snap.lastFinished?.entry.solved).toBe(true);
  expect(snap.lastFinished?.breakdown.base).toBe(1000);
  expect(host.textContent).toContain("Chief Inspector");
  expect(snap.solo).toBeNull();
  expect(snap.history.length).toBe(1);
}

it.each([1, 2, 3, 4, 5, 6, 7, 8])("an easy case (seed %i) can be solved through the screens", (seed) => solve(seed));
