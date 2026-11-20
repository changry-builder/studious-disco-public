/* WTE.App — controller: state, dispatch, render, hash, storage, wiring (lane B). */
(function (root) {
  const WTE = (root.WTE = root.WTE || {});

  function start(rootEl) {
    const { Config, Cuisines, Engine, Geo, Rng, Storage, Net, Art, MapView, PWA, UI } = WTE;
    const $ = (id) => document.getElementById(id);
    const store = Storage.create();
    const net = Net.create({ fetch: root.fetch.bind(root), store });
    const units = Geo.unitsFor(navigator.language || "en-US");
    const fmt = (m) => Geo.formatDistance(m, units);
    const platform = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent || "") ? "apple" : "other";
    const STEPS = Config.RADIUS_STEPS_M;
    const FILTER_KEYS = ["openNow", "vegetarian", "vegan", "halal", "kosher", "glutenFree", "wheelchair"];
    const defaultFilters = () => FILTER_KEYS.reduce((o, k) => ((o[k] = false), o), {});

    const screens = { pick: $("screen-pick"), duel: $("screen-duel"), winner: $("screen-winner"), results: $("screen-results") };
    let E = Engine.initialState();
    const prefs = Object.assign({ radiusM: Config.DEFAULT_RADIUS_M, filters: defaultFilters(), sort: "distance", rememberLocation: false }, store.get("prefs", {}) || {});
    prefs.filters = Object.assign(defaultFilters(), prefs.filters || {});
    if (!STEPS.includes(prefs.radiusM)) prefs.radiusM = Config.DEFAULT_RADIUS_M;

    const R = {
      center: null, centerLabel: "", radiusM: prefs.radiusM, filters: prefs.filters, sort: prefs.sort === "name" ? "name" : "distance",
      status: "idle", data: [], source: null, sampleReason: null, error: null, stale: false,
      selectedId: null, message: "", places: [], scrollToSelected: false, userLoc: null,
    };
    let token = 0, ctrl = null, mapReady = false, radiusTimer = null, lastPhase = null;

    const savePrefs = () => store.set("prefs", { radiusM: R.radiusM, filters: R.filters, sort: R.sort, rememberLocation: !!prefs.rememberLocation });
    const cuisine = (id) => Cuisines.byId(id);

    /* ---------- helpers ---------- */
    function seed() {
      const a = new Uint32Array(1);
      if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a);
      else a[0] = (Math.random() * 4294967296) >>> 0;
      return a[0];
    }
    function announce(msg) { const l = $("live"); l.textContent = ""; setTimeout(() => { l.textContent = msg; }, 30); }
    function toast(msg, action) {
      const box = $("toasts");
      const t = document.createElement("div");
      t.className = "toast";
      const s = document.createElement("span"); s.textContent = msg; t.appendChild(s);
      if (action) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "toast-btn"; b.textContent = action.label;
        b.addEventListener("click", () => { action.run(); t.remove(); });
        t.appendChild(b);
      }
      box.appendChild(t);
      if (!action) setTimeout(() => { t.classList.add("bye"); setTimeout(() => t.remove(), 300); }, 3600);
    }
    function visible() {
      const f = Geo.filterRestaurants(R.data, R.filters, new Date());
      return Geo.sortRestaurants(f, R.sort);
    }

    /* ---------- dispatch ---------- */
    function dispatch(ev) {
      if (ev.type === "START" || ev.type === "SURPRISE" || ev.type === "REMATCH") ev = Object.assign({}, ev, { seed: seed() });
      const prev = E;
      const next = Engine.reduce(prev, ev);
      if (next === prev) return false;
      E = next;
      onTransition(prev, next, ev);
      render();
      syncHash(prev, next);
      return true;
    }

    function onTransition(prev, next, ev) {
      if (next.phase === "winner" && prev.phase !== "winner" && prev.phase !== "results" && ev.type !== "UNDO" && ev.type !== "BACK") {
        const hist = store.get("history", []) || [];
        hist.unshift({ cuisine: next.winner, at: new Date().toISOString() });
        store.set("history", hist.slice(0, 20));
        const c = cuisine(next.winner);
        announce("Tonight: " + (c ? c.name : "") + ".");
      }
      if (next.phase === "results" && prev.phase !== "results") enterResults();
      else if (next.phase === "results" && next.cuisine !== prev.cuisine) { R.selectedId = null; loadResults(); }
      if (prev.phase === "results" && next.phase !== "results") cancelLoad();
    }

    function syncHash(prev, next) {
      const initial = next.phase === "pick" && !Object.keys(next.marks).length;
      const hash = initial ? "" : "#" + Engine.encodeHash(next);
      const push = prev.phase !== next.phase || (next.phase === "duel" && prev.choices.length !== next.choices.length);
      try {
        const url = location.pathname + location.search + hash;
        if (push && (hash !== location.hash)) history.pushState(null, "", url);
        else history.replaceState(null, "", url);
      } catch (e) { /* sandboxed */ }
    }

    function adopt(hashStr) {
      let dec = null;
      try { dec = hashStr ? Engine.decodeHash(hashStr.replace(/^#/, "")) : null; } catch (e) { dec = null; }
      const prev = E;
      if (!dec) { E = Engine.initialState(); }
      else {
        E = dec.state;
        const at = dec.extra && dec.extra.at;
        if (at && Geo.isLatLng(at)) { R.center = Geo.clampLatLng(at); R.centerLabel = "Shared location"; }
        if (dec.extra && dec.extra.r && STEPS.includes(dec.extra.r)) R.radiusM = dec.extra.r;
      }
      if (prev.phase === "results" && E.phase !== "results") cancelLoad();
      if (E.phase === "results" && prev.phase !== "results") enterResults();
      render();
    }

    /* ---------- results logic ---------- */
    function cancelLoad() { token++; if (ctrl) { ctrl.abort(); ctrl = null; } if (R.status === "loading" || R.status === "locating") R.status = "idle"; }

    function enterResults() {
      R.message = ""; R.places = []; R.selectedId = null;
      if (!R.center && prefs.rememberLocation) {
        const lc = store.get("lastCenter", null);
        if (lc && Geo.isLatLng(lc)) { R.center = { lat: lc.lat, lng: lc.lng }; R.centerLabel = lc.label || "Saved location"; }
      }
      requestAnimationFrame(() => { ensureMap(); if (R.center && mapReady) MapView.setCenter(R.center, { fit: true }); });
      if (R.center) loadResults(); else R.status = "idle";
    }

    function ensureMap() {
      if (mapReady || !MapView || !MapView.isAvailable()) return;
      const el = UI.Results.mapEl();
      if (!el) return;
      try {
        MapView.init(el, {
          center: R.center || undefined, radiusM: R.radiusM,
          onPinMove: (c, reason) => setCenter(c, reason === "click" ? "Dropped pin" : reason === "locate" ? "Your location" : "Dropped pin", { fromMap: true, reverse: reason === "click" }),
          onSelect: (id) => select(id, { fromMap: true }),
          markerHtml: () => Art.markerHtml(cuisine(E.cuisine || E.winner)),
          labels: { pin: "Search center", you: "You are here" },
        });
        mapReady = true;
        if (R.center) MapView.setCenter(R.center, { fit: true });
        if (R.userLoc) MapView.setUserLocation(R.userLoc.p, R.userLoc.acc);
        pushMap();
      } catch (e) { mapReady = false; if (root.console) console.warn("Map unavailable", e); }
    }
    function pushMap() {
      if (!mapReady) return;
      const list = visible();
      MapView.setRestaurants(R.status === "ready" ? list : []);
      MapView.highlight(R.selectedId || null, { pan: false, openPopup: false });
    }

    function setCenter(c, label, opts) {
      opts = opts || {};
      R.center = Geo.clampLatLng(c);
      R.centerLabel = label || "Dropped pin";
      R.message = ""; R.places = []; R.selectedId = null;
      if (mapReady && !opts.fromMap) MapView.setCenter(R.center, { fit: true });
      if (prefs.rememberLocation) store.set("lastCenter", { lat: R.center.lat, lng: R.center.lng, label: R.centerLabel });
      if (opts.reverse) {
        const mine = R.center;
        net.reverse(mine, { lang: navigator.language }).then((name) => {
          if (name && R.center === mine && R.centerLabel === "Dropped pin") { R.centerLabel = name; if (prefs.rememberLocation) store.set("lastCenter", { lat: mine.lat, lng: mine.lng, label: name }); render(); }
        }).catch(() => {});
      }
      loadResults();
    }

    async function loadResults(force) {
      if (ctrl) ctrl.abort();
      const my = ++token;
      const cid = E.cuisine || E.winner;
      if (!cid || !R.center) { R.status = "idle"; render(); return; }
      ctrl = new AbortController();
      R.status = "loading"; R.data = []; R.selectedId = null; R.source = null; R.error = null; R.stale = false; R.sampleReason = null;
      render(); pushMap();
      if (mapReady) MapView.setInteractive(false);
      try {
        let res;
        if (force === "sample") {
          res = { restaurants: Geo.sampleRestaurants(cid, R.center).filter((r) => r.distanceM <= R.radiusM), source: "sample", error: null, stale: false };
          R.sampleReason = "demo";
        } else res = await net.findRestaurants(cid, R.center, R.radiusM, { signal: ctrl.signal });
        if (my !== token) return;
        R.data = res.restaurants; R.source = res.source; R.stale = !!res.stale; R.error = res.error || null;
        if (res.source === "sample" && !R.sampleReason) R.sampleReason = "error";
        R.status = "ready";
      } catch (e) {
        if (my !== token) return;
        if (e && e.name === "AbortError") { R.status = "error"; R.error = "cancelled"; }
        else { R.status = "error"; R.error = "unknown"; }
      }
      if (mapReady) MapView.setInteractive(true);
      render(); pushMap();
      if (mapReady && R.status === "ready" && R.data.length) MapView.fitToResults();
    }

    function select(id, opts) {
      R.selectedId = id; R.scrollToSelected = true;
      if (mapReady) MapView.highlight(id, { pan: true, openPopup: !(opts && opts.fromMap) });
      render(); R.scrollToSelected = false;
    }

    function locate() {
      if (!navigator.geolocation) return;
      R.status = "locating"; R.message = ""; R.places = []; render();
      navigator.geolocation.getCurrentPosition((pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        R.userLoc = { p, acc: pos.coords.accuracy };
        ensureMap();
        if (mapReady) MapView.setUserLocation(p, pos.coords.accuracy);
        setCenter(p, "Your location");
      }, (err) => {
        R.status = R.center ? "ready" : "idle";
        if (err && err.code === 1) {
          R.message = "Location is off for this site — enter an address or tap the map.";
          render();
          const i = $("screen-results").querySelector("#addr"); if (i) i.focus();
        } else {
          R.message = "Couldn’t get your location (" + (err && err.code === 3 ? "timed out" : "unavailable") + "). Try again, or enter an address.";
          render();
        }
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }

    async function search(text) {
      const q = String(text || "").trim();
      if (!q) return;
      const ll = Geo.parseLatLngText(q);
      if (ll) { setCenter(ll, q); return; }
      R.message = "Searching…"; R.places = []; render();
      try {
        const places = await net.geocode(q, { lang: navigator.language });
        if (!places.length) { R.message = "No match for “" + q + "”. Try a city, postcode or full address."; render(); return; }
        const alts = places.length > 1 ? places.slice(0, 5) : [];
        usePlace(places[0], alts);
      } catch (e) {
        const m = e && e.message;
        R.message = m === "rate-limited" ? "Too many searches — wait a moment and try again." : m === "offline" ? "You appear to be offline. Tap the map or try the demo city." : "Address search isn’t available right now. Tap the map instead.";
        render();
      }
    }
    function usePlace(p, alts) {
      if (!p) return;
      const label = p.label.length > 60 ? p.label.slice(0, 57) + "…" : p.label;
      setCenter({ lat: p.lat, lng: p.lng }, label);
      R.places = alts || []; R.message = R.places.length ? "Did you mean…" : "";
      render();
    }

    const nextRadiusLabel = () => { const n = Geo.nextRadius(R.radiusM); return n ? fmt(n) : null; };
    function setRadius(m, immediate) {
      R.radiusM = m; savePrefs();
      if (mapReady) MapView.setRadius(m);
      clearTimeout(radiusTimer);
      if (R.center) radiusTimer = setTimeout(() => loadResults(), immediate ? 0 : 400);
      else render();
    }

    /* ---------- view models ---------- */
    function pickVM() {
      const contenders = Engine.contendersFor(E.marks);
      const preview = Engine.startPreview(E);
      const hist = store.get("history", []) || [];
      const seen = [];
      hist.forEach((h) => { const c = cuisine(h && h.cuisine); if (c && !seen.includes(c)) seen.push(c); });
      return { cuisines: Cuisines.LIST, marks: E.marks, preview, pickedCount: contenders.length, notice: E.notice, recent: seen.slice(0, 5),
        soloName: preview.label === "single" ? cuisine(contenders[0]).name : "" };
    }
    function duelVM(keepFocus) {
      const b = Engine.bracket(E);
      const full = Engine.contendersFor(E.marks).length;
      const capped = full > E.contenders.length && E.contenders.length === Config.MAX_CONTENDERS;
      return { bracket: b, left: cuisine(b.current.left), right: cuisine(b.current.right), seedKey: E.seed, keepFocus,
        cappedText: capped ? "That’s a lot — " + E.contenders.length + " of your " + full + " picked at random for the showdown." : "" };
    }
    function winnerVM() {
      return { cuisine: cuisine(E.winner), runnerUps: Engine.runnerUps(E, 3).map(cuisine).filter(Boolean), notice: E.notice, canRematch: E.contenders.length >= 2 };
    }
    function resultsVM() {
      const c = cuisine(E.cuisine || E.winner);
      const list = visible();
      const chipIds = [];
      [E.winner].concat(Engine.runnerUps(E, 3)).forEach((id) => { if (id && !chipIds.includes(id)) chipIds.push(id); });
      if (!chipIds.includes(c.id)) chipIds.unshift(c.id);
      const ru = Engine.runnerUps(E, 3).filter((id) => id !== c.id)[0];
      const now = new Date();
      return {
        cuisine: c, chipCuisines: chipIds.map(cuisine).filter(Boolean), allCuisines: Cuisines.LIST,
        status: R.status, center: R.center, centerLabel: R.centerLabel, radiusM: R.radiusM, radiusSteps: STEPS, radiusLabel: fmt(R.radiusM),
        filters: R.filters, sort: R.sort, list, rawCount: R.data.length, hiddenCount: R.data.length - list.length,
        source: R.source, sampleReason: R.sampleReason, stale: R.stale, error: R.error, selectedId: R.selectedId, scrollToSelected: R.scrollToSelected,
        geoAvailable: !!(root.isSecureContext && navigator.geolocation), mapAvailable: !!(MapView && MapView.isAvailable()),
        message: R.message, places: R.places, nextRadiusLabel: nextRadiusLabel(), runnerUp: ru ? cuisine(ru) : null,
        fmt, openStatus: (r) => Geo.openStatus(r, now), directionsUrl: (r) => Geo.directionsUrl(r, platform),
        minute: Math.floor(now.getTime() / 60000),
      };
    }

    /* ---------- actions ---------- */
    const pickActions = {
      toggle: (id) => dispatch({ type: "TOGGLE", id }),
      reject: (id) => dispatch({ type: E.marks[id] === "reject" ? "CLEAR" : "REJECT", id }),
      keepAll: () => dispatch({ type: "KEEP_ALL" }),
      reset: () => dispatch({ type: "CLEAR_ALL" }),
      start: () => dispatch({ type: "START" }),
      surprise: () => dispatch({ type: "SURPRISE" }),
    };
    const duelActions = {
      choose: (side) => dispatch({ type: "CHOOSE", side }),
      undo: () => dispatch({ type: "BACK" }),
      coinSide: () => (seed() & 1 ? "L" : "R"),
    };
    const winnerActions = {
      findNearby: () => dispatch({ type: "SHOW_RESULTS" }),
      rematch: () => dispatch({ type: "REMATCH" }),
      startOver: () => dispatch({ type: "RESET" }),
      back: () => dispatch({ type: "BACK" }),
      useRunnerUp: (id) => { if (dispatch({ type: "SHOW_RESULTS" })) dispatch({ type: "USE_CUISINE", id }); },
    };
    const resultActions = {
      useCuisine: (id) => dispatch({ type: "USE_CUISINE", id }),
      search, locate,
      demo: () => setCenter({ lat: Config.DEMO_CENTER.lat, lng: Config.DEMO_CENTER.lng }, Config.DEMO_CENTER.label),
      setRadius: (m) => setRadius(m),
      toggleFilter: (k) => { R.filters = Object.assign({}, R.filters, { [k]: !R.filters[k] }); savePrefs(); render(); pushMap(); },
      clearFilters: () => { R.filters = defaultFilters(); savePrefs(); render(); pushMap(); },
      setSort: (k) => { R.sort = k; savePrefs(); render(); pushMap(); },
      pickOne: () => {
        const l = visible(); if (!l.length) return;
        const r = Rng.pick(l, seed());
        select(r.id); toast("How about " + r.name + "?"); announce("How about " + r.name + "?");
      },
      share: openShare,
      select: (id) => select(id),
      widen: () => { const n = Geo.nextRadius(R.radiusM); if (n) setRadius(n, true); },
      showSample: () => { if (!R.center) { resultActions.demo(); } loadResults("sample"); },
      pickAgain: () => { if (!dispatch({ type: "REMATCH" })) dispatch({ type: "RESET" }); },
      retry: () => loadResults(),
      cancel: () => { token++; if (ctrl) ctrl.abort(); ctrl = null; R.status = "error"; R.error = "cancelled"; if (mapReady) MapView.setInteractive(true); render(); },
      choosePlace: (i) => usePlace(R.places[i], R.places),
    };

    /* ---------- render ---------- */
    const TITLES = { pick: "What to Eat", duel: "Showdown · What to Eat", winner: "Winner · What to Eat", results: "Nearby · What to Eat" };
    const STEPS_LABEL = { pick: "1 · Pick", duel: "2 · Showdown", winner: "3 · Winner", results: "4 · Nearby" };
    function render() {
      const phase = E.phase;
      const changed = phase !== lastPhase;
      const focusInDuel = screens.duel.contains(document.activeElement) || document.activeElement === document.body;
      Object.keys(screens).forEach((k) => { screens[k].hidden = k !== phase; });
      document.body.dataset.phase = phase;
      $("step").textContent = STEPS_LABEL[phase];
      document.title = TITLES[phase];
      $("btn-home").hidden = false;
      if (changed) { UI.Duel.leave(); UI.Winner.leave(); }
      if (phase === "pick") UI.Pick.render(screens.pick, pickVM(), pickActions);
      else if (phase === "duel") UI.Duel.render(screens.duel, duelVM(!changed && focusInDuel), duelActions);
      else if (phase === "winner") UI.Winner.render(screens.winner, winnerVM(), winnerActions);
      else if (phase === "results") {
        UI.Results.render(screens.results, resultsVM(), resultActions);
        ensureMap();
        if (changed) setTimeout(() => { if (mapReady) { MapView.invalidateSize(); if (R.center) MapView.setCenter(R.center, { fit: true }); } }, 120);
      }
      if (changed) {
        lastPhase = phase;
        if (lastPhase && started) requestAnimationFrame(() => {
          const h1 = screens[phase].querySelector("h1");
          if (h1) { h1.focus({ preventScroll: true }); }
          window.scrollTo(0, 0);
        });
      }
    }
    let started = false;

    /* ---------- dialogs ---------- */
    function openDialog(d) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
    function shareUrl(withLoc) {
      const extra = withLoc && R.center ? { at: { lat: +R.center.lat.toFixed(5), lng: +R.center.lng.toFixed(5) }, r: R.radiusM } : undefined;
      return location.href.split("#")[0] + "#" + Engine.encodeHash(E, extra);
    }
    function openShare() {
      const loc = $("share-loc"); loc.checked = false; loc.disabled = !R.center;
      $("share-url").value = shareUrl(false);
      openDialog($("share"));
    }
    $("share-loc").addEventListener("change", (e) => { $("share-url").value = shareUrl(e.target.checked); });
    $("share-go").addEventListener("click", async () => {
      const url = $("share-url").value;
      const c = cuisine(E.cuisine || E.winner);
      try {
        if (navigator.share) { await navigator.share({ title: "What to eat: " + (c ? c.name : ""), url }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(url); toast("Link copied"); }
      catch (e) { $("share-url").select(); toast("Press copy to share the link"); }
    });
    $("btn-about").addEventListener("click", () => { $("opt-remember").checked = !!prefs.rememberLocation; openDialog($("about")); });
    $("opt-remember").addEventListener("change", (e) => {
      prefs.rememberLocation = e.target.checked; savePrefs();
      if (!prefs.rememberLocation) store.remove("lastCenter");
      else if (R.center) store.set("lastCenter", { lat: R.center.lat, lng: R.center.lng, label: R.centerLabel });
    });
    $("btn-clear-history").addEventListener("click", () => { store.remove("history"); toast("Recent winners cleared"); render(); });
    $("about-version").textContent = "Version " + Config.VERSION;
    $("btn-home").addEventListener("click", () => { if (E.phase !== "pick" || Object.keys(E.marks).length) dispatch({ type: "RESET" }); else window.scrollTo(0, 0); });
    ["about", "share"].forEach((id) => $(id).addEventListener("click", (e) => { if (e.target === $(id)) $(id).close(); }));

    /* ---------- boot ---------- */
    root.addEventListener("popstate", () => adopt(location.hash));
    if (location.hash.length > 1) adopt(location.hash); else render();
    started = true;

    if (PWA) {
      try {
        PWA.register();
        PWA.onUpdateReady((apply) => toast("A new version is ready.", { label: "Reload", run: apply }));
        const inst = $("btn-install");
        const showInst = () => { inst.hidden = !PWA.canInstall(); };
        PWA.onInstallAvailable(showInst);
        inst.addEventListener("click", async () => { const r = await PWA.promptInstall(); if (r === "accepted") toast("Installed — enjoy!"); showInst(); });
      } catch (e) { /* optional */ }
    }
    WTE.App.debug = { get state() { return E; }, get results() { return R; }, dispatch };
  }

  WTE.App = { start };
  function boot() { WTE.App.start(document.getElementById("app")); }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
