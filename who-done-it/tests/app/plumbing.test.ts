import { DIFFICULTIES, encodeCaseCode, generateCase, type Action } from "../../src/engine/index";
import { createStore, type ActionInput, type Store } from "../../src/app/store";
import { localStorageStore, memoryStore } from "../../src/app/persistence";
import { LocalTransport, type SessionTransport } from "../../src/app/transport";
import { scenarios } from "../../src/scenarios/index";

describe("persistence", () => {
  it("round trips and wraps values with a version", () => {
    const s = memoryStore();
    s.save("a", { x: [1, 2] });
    expect(s.load("a")).toEqual({ x: [1, 2] });
    expect(JSON.parse(s.raw.get("wdi:v1:a")!)).toEqual({ v: 1, data: { x: [1, 2] } });
    s.remove("a");
    expect(s.load("a")).toBeUndefined();
  });
  it("quarantines corrupted JSON", () => {
    const s = memoryStore();
    s.raw.set("wdi:v1:a", "{not json");
    expect(s.load("a")).toBeUndefined();
    expect(s.raw.has("wdi:v1:a")).toBe(false);
    expect(s.raw.get("wdi:v1:quarantine:a")).toBe("{not json");
  });
  it("quarantines a wrong version and a failing validator", () => {
    const s = memoryStore();
    s.raw.set("wdi:v1:a", JSON.stringify({ v: 2, data: 1 }));
    expect(s.load("a")).toBeUndefined();
    expect(s.raw.has("wdi:v1:quarantine:a")).toBe(true);
    s.save("b", "str");
    expect(s.load("b", (d) => typeof d === "number")).toBeUndefined();
    expect(s.raw.has("wdi:v1:quarantine:b")).toBe(true);
    expect(s.raw.has("wdi:v1:b")).toBe(false);
  });
  it("does not crash when storage throws", () => {
    const boom = () => {
      throw new Error("denied");
    };
    const storage = { getItem: boom, setItem: boom, removeItem: boom } as unknown as Storage;
    const s = localStorageStore(storage);
    expect(() => s.save("a", 1)).not.toThrow();
    expect(s.load("a")).toBe(1); // carried on in memory
    expect(() => s.remove("a")).not.toThrow();
    expect(s.load("a")).toBeUndefined();
  });
  it("works over real jsdom localStorage", () => {
    const s = localStorageStore();
    s.save("k", { a: 1 });
    expect(s.load("k")).toEqual({ a: 1 });
    s.remove("k");
  });
});

/** Build a mixed list of every action type for a case. */
function allActions(store: Store): ActionInput[] {
  const cs = store.getSnapshot().solo!.session.case;
  const out: ActionInput[] = [{ type: "examineBody" }];
  const rooms = scenarios[0]!.facts.rooms;
  for (const r of rooms) for (const sp of r.spots) out.push({ type: "search", room: r.id, spot: sp });
  for (const ch of cs.claims) out.push({ type: "ask", suspect: ch.speaker, slot: ch.slot });
  const chain = cs.claims.find((c) => c.versions.length > 1)!;
  out.push({ type: "press", suspect: chain.speaker, slot: chain.slot, evidence: chain.versions[0]!.refutedBy[0]! });
  out.push({ type: "press", suspect: chain.speaker, slot: chain.slot, evidence: { kind: "item", id: cs.items[0]!.id } });
  out.push({ type: "pin", ref: { kind: "item", id: cs.items[0]!.id }, on: true });
  out.push({ type: "tag", suspect: cs.suspects[0]!, tag: "suspect" });
  const wrong = cs.suspects.find((s) => s !== cs.solution.killer)!;
  const ref = { kind: "item", id: cs.items[0]!.id } as const;
  out.push({ type: "accuse", who: wrong, weapon: cs.solution.weapon, room: cs.solution.room, motive: cs.solution.motive, support: { who: ref, what: ref, why: ref } });
  out.push({ type: "giveUp" });
  return out;
}

describe("store: solo", () => {
  it("dispatch appends, reduces once and notifies", () => {
    const store = createStore({ saveStore: memoryStore() });
    store.newCase("easy", 11);
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.getSnapshot();
    expect(store.dispatch({ type: "examineBody" })).toBe(true);
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(calls).toBe(1);
    expect(after.solo!.state.bodyExamined).toBe(true);
    expect(after.solo!.session.actions).toHaveLength(1);
    expect(after.solo!.view.items.length).toBeGreaterThan(0);
    // a disallowed repeat changes nothing and does not notify
    expect(store.dispatch({ type: "examineBody" })).toBe(false);
    expect(store.getSnapshot()).toBe(after);
    expect(calls).toBe(1);
  });

  it("restores identical state after a reload following every action type", () => {
    const saves = memoryStore();
    const store = createStore({ saveStore: saves });
    store.newCase("medium", 42);
    const seen = new Set<string>();
    for (const a of allActions(store)) {
      store.dispatch(a);
      seen.add(a.type);
      const live = store.getSnapshot().solo!;
      const reloaded = createStore({ saveStore: saves }).getSnapshot().solo!;
      expect(reloaded.state).toEqual(live.state);
      expect(reloaded.session.actions).toEqual(live.session.actions);
      expect(reloaded.session.code).toBe(live.session.code);
    }
    expect([...seen].sort()).toEqual(["accuse", "ask", "examineBody", "giveUp", "pin", "press", "search", "tag"]);
    expect(store.getSnapshot().solo!.state.gaveUp).toBe(true);
  });

  it("openCode with a bad code returns the engine error and changes nothing", () => {
    const saves = memoryStore();
    const store = createStore({ saveStore: saves });
    store.newCase("easy", 3);
    const snap = store.getSnapshot();
    const res = store.openCode("ABC");
    expect(res).toEqual({ ok: false, error: "length" });
    expect(store.getSnapshot()).toBe(snap);
    expect(store.openCode("UUUU-UUUUU").ok).toBe(false);
    expect(store.getSnapshot()).toBe(snap);
  });

  it("openCode with a good code starts that case", () => {
    const store = createStore({ saveStore: memoryStore() });
    const code = encodeCaseCode(0, "hard", 99);
    expect(store.openCode(code.toLowerCase())).toEqual({ ok: true, code });
    const solo = store.getSnapshot().solo!;
    expect(solo.session.case).toEqual(generateCase(scenarios[0]!.facts, 99, "hard"));
  });

  it("play timer advances only while running", () => {
    let t = 1000;
    const saves = memoryStore();
    const store = createStore({ saveStore: saves, now: () => t });
    store.newCase("easy", 5);
    t = 2000;
    expect(store.getElapsedMs()).toBe(0);
    store.startTimer();
    expect(store.getSnapshot().timerRunning).toBe(true);
    t = 2500;
    store.dispatch({ type: "examineBody" });
    expect((store.getSnapshot().solo!.session.actions[0] as Action).at).toBe(500);
    t = 3000;
    store.stopTimer();
    expect(store.getElapsedMs()).toBe(1000);
    t = 9000;
    expect(store.getElapsedMs()).toBe(1000);
    expect(createStore({ saveStore: saves, now: () => t }).getSnapshot().solo!.session.elapsedMs).toBe(1000);
    store.startTimer();
    t = 9300;
    expect(store.getElapsedMs()).toBe(1300);
    store.dispatch({ type: "giveUp" }); // finishing stops the clock
    t = 20000;
    expect(store.getElapsedMs()).toBe(1300);
    expect(store.getSnapshot().timerRunning).toBe(false);
  });

  it("finishSolo writes history and clears the session", () => {
    const saves = memoryStore();
    const store = createStore({ saveStore: saves, wallClock: () => 777 });
    store.newCase("easy", 8);
    expect(store.finishSolo()).toBeNull(); // not over yet
    store.dispatch({ type: "giveUp" });
    const res = store.finishSolo()!;
    expect(res.entry).toMatchObject({ difficulty: "easy", solved: false, base: 0, total: 0, rank: "Bystander", finishedAt: 777 });
    expect(res.reveal).not.toBeNull();
    const snap = store.getSnapshot();
    expect(snap.solo).toBeNull();
    expect(snap.history).toHaveLength(1);
    const again = createStore({ saveStore: saves });
    expect(again.getSnapshot().solo).toBeNull();
    expect(again.getSnapshot().history).toEqual(snap.history);
  });

  it("keeps only the last 50 history entries", () => {
    const store = createStore({ saveStore: memoryStore() });
    for (let i = 0; i < 52; i++) {
      store.newCase("easy", i);
      store.dispatch({ type: "giveUp" });
      store.finishSolo();
    }
    expect(store.getSnapshot().history).toHaveLength(50);
  });

  it("publishes local actions to the transport", () => {
    const published: unknown[] = [];
    const transport: SessionTransport = { publish: (_id, a) => void published.push(a), subscribe: () => () => {} };
    const store = createStore({ saveStore: memoryStore(), transport });
    store.newCase("easy", 1);
    store.dispatch({ type: "examineBody" });
    expect(published).toHaveLength(1);
    expect(new LocalTransport().subscribe("x", () => {})).toBeTypeOf("function");
  });

  it("persists nav and settings", () => {
    const saves = memoryStore();
    const store = createStore({ saveStore: saves });
    store.navigate("case", { tab: "clues", n: 2 });
    store.updateSettings({ sound: false, playerName: "Pat" });
    const again = createStore({ saveStore: saves }).getSnapshot();
    expect(again.nav).toEqual({ screen: "case", params: { tab: "clues", n: 2 } });
    expect(again.settings).toEqual({ sound: false, playerName: "Pat" });
  });

  it("quarantines a corrupt solo save and starts empty", () => {
    const saves = memoryStore();
    saves.raw.set("wdi:v1:session:solo", JSON.stringify({ v: 1, data: { id: "x" } }));
    const store = createStore({ saveStore: saves });
    expect(store.getSnapshot().solo).toBeNull();
    expect(saves.raw.has("wdi:v1:quarantine:session:solo")).toBe(true);
  });
});

describe("store: party", () => {
  it("runs start, votes, nextRound, end, and survives a reload mid-case", () => {
    for (const difficulty of DIFFICULTIES) {
      const saves = memoryStore();
      const store = createStore({ saveStore: saves });
      expect(store.startPartyCase(difficulty, 4)).toBe(false); // needs players
      store.partyDispatch({ type: "addPlayer", name: "Ann" });
      store.partyDispatch({ type: "addPlayer", name: "Bob" });
      expect(store.partyDispatch({ type: "startCase", code: "x", rounds: 3 })).toBe(false);
      expect(store.startPartyCase(difficulty, 4)).toBe(true);
      const party = store.getSnapshot().party;
      const rounds = party.deck.length;
      expect(party.state.current!.rounds).toBe(rounds);
      expect(party.deck.length).toBeGreaterThanOrEqual(6);
      const killer = party.case!.solution.killer;
      const wrong = party.case!.suspects.find((s) => s !== killer)!;

      store.partyDispatch({ type: "vote", player: 0, suspect: wrong });
      expect(store.partyDispatch({ type: "nextRound" })).toBe(false); // Bob has not voted
      expect(store.endPartyCase()).toBeNull();
      for (let r = 0; r < rounds; r++) {
        store.partyDispatch({ type: "vote", player: 0, suspect: r === 0 ? wrong : killer });
        store.partyDispatch({ type: "vote", player: 1, suspect: killer });
        if (r === 1) {
          const mid = createStore({ saveStore: saves }).getSnapshot().party;
          expect(mid.state).toEqual(store.getSnapshot().party.state);
          expect(mid.deck).toEqual(store.getSnapshot().party.deck);
          expect(mid.code).toBe(store.getSnapshot().party.code);
          expect(mid.case).toEqual(store.getSnapshot().party.case);
        }
        if (r < rounds - 1) expect(store.partyDispatch({ type: "nextRound" })).toBe(true);
      }
      const res = store.endPartyCase()!;
      expect(res.killer).toBe(killer);
      expect(res.points).toEqual([Math.round((100 * (rounds - 1)) / rounds), 100]);
      const end = store.getSnapshot().party;
      expect(end.state.current).toBeNull();
      expect(end.state.totals).toEqual(res.points);
      expect(end.case).toBeNull();
      const reloaded = createStore({ saveStore: saves }).getSnapshot().party;
      expect(reloaded.state.totals).toEqual(res.points);
      expect(reloaded.state.current).toBeNull();
    }
  });
});
