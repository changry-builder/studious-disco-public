import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { App } from "../../src/app/App";
import { createMemoryStore, type Store } from "../../src/app/store";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
let store: Store;

function mount(s: Store = createMemoryStore()): Store {
  store = s;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<App store={store} />));
  return store;
}
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function button(name: string | RegExp): HTMLButtonElement {
  const all = [...host.querySelectorAll("button")];
  const hit = all.find((b) => {
    const label = b.getAttribute("aria-label") ?? b.textContent ?? "";
    return typeof name === "string" ? label.trim() === name || (b.textContent ?? "").trim() === name : name.test(label) || name.test(b.textContent ?? "");
  });
  if (!hit) throw new Error(`No button "${name}". Buttons: ${all.map((b) => b.getAttribute("aria-label") ?? b.textContent).join(" | ")}`);
  return hit as HTMLButtonElement;
}
function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("screens", () => {
  it("Home renders and New case leads to the difficulty picker", () => {
    mount();
    expect(host.textContent).toContain("Enter a code");
    expect(host.textContent).toContain("Coming soon");
    expect(host.textContent).not.toContain("Continue your case");
    click(button("New case"));
    expect(button(/Easy/)).toBeTruthy();
    expect(button(/Medium/)).toBeTruthy();
    expect(button(/Hard/)).toBeTruthy();
  });

  it("starting an easy case shows the Briefing with all suspects", () => {
    mount();
    click(button("New case"));
    act(() => store.newCase("easy", 1));
    act(() => store.navigate("briefing"));
    const solo = store.getSnapshot().solo!;
    expect(solo.view.suspects.length).toBe(4);
    expect(host.querySelectorAll('[aria-label="Suspects"] li').length).toBe(4);
    expect(button("Begin")).toBeTruthy();
    click(button("Begin"));
    expect(store.getSnapshot().nav.screen).toBe("house");
    expect(host.querySelectorAll(".rooms li").length).toBe(10);
  });

  it("asking from the Dossier shows a statement and the question count becomes 1", () => {
    mount();
    act(() => store.newCase("easy", 1));
    const id = store.getSnapshot().solo!.view.suspects[0]!;
    act(() => store.navigate("dossier", { suspect: id }));
    expect(store.getSnapshot().solo!.state.questions).toBe(0);
    click(button(/^Ask .* about 9:00 pm$/));
    expect(store.getSnapshot().solo!.state.questions).toBe(1);
    expect(host.querySelectorAll(".statement").length).toBe(1);
    expect(host.querySelector(".readout")?.textContent).toMatch(/^1 \//);
    expect(button(/^Press /)).toBeTruthy();
  });

  it("searching a spot in a Room shows an item or the empty line", () => {
    mount();
    act(() => store.newCase("easy", 1));
    const room = store.getSnapshot().solo!.view.bodyRoom;
    act(() => store.navigate("room", { room }));
    const before = host.querySelectorAll("section[aria-label='Places to search'] button").length;
    expect(before).toBeGreaterThan(0);
    click(host.querySelector("section[aria-label='Places to search'] button")!);
    expect(store.getSnapshot().solo!.state.searched.length).toBe(1);
    const found = host.querySelectorAll(".found .itemcard, .found p");
    expect(found.length).toBeGreaterThan(0);
    click(button("Examine the body"));
    expect(store.getSnapshot().solo!.state.bodyExamined).toBe(true);
    expect(host.textContent).toContain("Time of death");
  });

  it("the Notebook Rules tab lists ten rules", () => {
    mount();
    act(() => store.newCase("easy", 1));
    act(() => store.navigate("notebook"));
    click(button("Rules"));
    expect(host.querySelectorAll("ol.rules > li").length).toBe(10);
    click(button("Timeline"));
    expect(host.querySelectorAll(".tgrid tbody tr").length).toBe(4);
  });

  it("Enter a code explains each kind of error", () => {
    mount();
    act(() => store.navigate("code"));
    const input = host.querySelector("input")!;
    const type = (v: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      act(() => {
        setter.call(input, v);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    type("ABC");
    click(button("Open this case"));
    expect(host.querySelector("[role=alert]")?.textContent).toContain("wrong length");
  });

  it("Give up leads to a Result with the true timeline", () => {
    mount();
    act(() => store.newCase("easy", 1));
    act(() => store.navigate("accuse"));
    click(button("Give up and see the answer"));
    click(button("Show me"));
    expect(store.getSnapshot().nav.screen).toBe("result");
    expect(host.textContent).toContain("Case closed, unsolved");
    expect(host.querySelectorAll("[aria-label='The true timeline'] tbody tr").length).toBe(5);
    expect(host.querySelector(".tcell--murder")).toBeTruthy();
  });
});

describe("hidden facts stay hidden", () => {
  it("no component or screen reads case internals, except Result reading the reveal", () => {
    const dirs = ["src/app/screens", "src/app/components"];
    const banned = [".truth", ".solution", ".lie", "refutedBy"];
    for (const d of dirs) {
      for (const f of readdirSync(d)) {
        if (f === "Result.tsx") continue;
        const src = readFileSync(join(d, f), "utf8");
        for (const b of banned) expect(src.includes(b), `${d}/${f} contains ${b}`).toBe(false);
      }
    }
  });
});
