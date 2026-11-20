/* WTE.UI.Duel and WTE.UI.Winner (lane B). */
(function (root) {
  const WTE = (root.WTE = root.WTE || {});
  WTE.UI = WTE.UI || {};
  const { h, clear, reducedMotion } = WTE.Dom;

  const D = { key: null, busy: false, active: false, actions: null, refs: {} };

  const stacked = () => !!(root.matchMedia && root.matchMedia("(max-width: 479px)").matches);

  function card(c, side, label) {
    const art = h("span", { class: "vs-art" });
    art.appendChild(WTE.Art.svgNode(WTE.Art.tileSvg(c, { size: 320 })));
    const el = h("button", {
      type: "button", class: "vs-card vs-" + side, style: "--c:" + c.color, "data-side": side,
      "aria-label": c.name + ". " + c.blurb,
    },
      h("span", { class: "vs-tag", "aria-hidden": "true", text: label }),
      art,
      h("span", { class: "vs-cap" },
        h("span", { class: "vs-name", text: c.name }),
        h("span", { class: "vs-blurb", text: c.blurb }))
    );
    return el;
  }

  function choose(side, viaCoin) {
    if (D.busy) return;
    D.busy = true;
    const { cards } = D.refs;
    const win = cards[side], lose = cards[side === "L" ? "R" : "L"];
    const rm = reducedMotion();
    win.classList.add("win");
    lose.classList.add("lose");
    cards.L.style.transform = ""; cards.R.style.transform = "";
    setTimeout(() => { D.actions.choose(side); setTimeout(() => { D.busy = false; }, 50); }, rm ? 120 : (viaCoin ? 380 : 460));
  }

  function wireSwipe(el, side) {
    let sx = 0, sy = 0, id = null, moved = false;
    const towards = (dx, dy) => {
      if (stacked()) return side === "L" ? dy : -dy; // top card swipes down, bottom card swipes up
      return side === "L" ? dx : -dx;                // left card swipes right, right card swipes left
    };
    el.addEventListener("pointerdown", (e) => { if (D.busy || e.button) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false; });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const t = Math.max(0, towards(dx, dy));
      if (t > 8) {
        moved = true;
        try { el.setPointerCapture(id); } catch (err) { /* ignore */ }
        const v = Math.min(t, 140);
        el.style.transition = "none";
        el.style.transform = stacked() ? "translateY(" + (side === "L" ? v : -v) + "px)" : "translateX(" + (side === "L" ? v : -v) + "px)";
      }
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      const t = towards(e.clientX - sx, e.clientY - sy);
      el.style.transition = "";
      if (moved && t > 70) { el.dataset.swiped = "1"; choose(side); }
      else { el.style.transform = ""; if (moved) { el.dataset.swiped = "1"; setTimeout(() => delete el.dataset.swiped, 50); } }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("click", (e) => {
      if (el.dataset.swiped) { e.preventDefault(); delete el.dataset.swiped; return; }
      choose(side);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!D.active || D.busy || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    let side = null;
    if (e.key === "ArrowLeft") side = "L";
    else if (e.key === "ArrowRight") side = "R";
    else if (stacked() && e.key === "ArrowUp") side = "L";
    else if (stacked() && e.key === "ArrowDown") side = "R";
    if (side) { e.preventDefault(); choose(side); }
  });

  function renderDuel(container, vm, actions) {
    D.actions = actions;
    D.active = true;
    const b = vm.bracket;
    const key = [b.round, b.matchIndex, vm.left.id, vm.right.id, vm.seedKey].join("|");
    if (D.key === key && container.contains(D.refs.cards && D.refs.cards.L)) { updateHead(vm); return; }
    D.key = key; D.busy = false;
    clear(container);

    const title = h("h1", { id: "h-duel", tabindex: "-1" });
    const bar = h("span", { class: "progress-fill" });
    const progress = h("div", { class: "progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(b.duelsTotal), "aria-valuenow": String(b.duelsPlayed), "aria-label": "Showdown progress" }, bar);
    const capped = h("p", { class: "notice", hidden: !vm.cappedText, text: vm.cappedText || "" });
    const left = card(vm.left, "L", "This"), right = card(vm.right, "R", "That");
    wireSwipe(left, "L"); wireSwipe(right, "R");
    const coinMsg = h("p", { class: "coin-msg", "aria-hidden": "true" });
    const live = h("p", { class: "sr-only", "aria-live": "polite", text: vm.left.name + " versus " + vm.right.name });
    const undo = h("button", { type: "button", class: "btn btn-ghost", on: { click: () => actions.undo() } });
    const coin = h("button", { type: "button", class: "btn btn-ghost", on: { click: () => {
      if (D.busy) return;
      const side = actions.coinSide();
      const c = side === "L" ? vm.left : vm.right;
      coinMsg.textContent = "🪙 The coin says: " + c.name + "!";
      coinMsg.classList.remove("show"); void coinMsg.offsetWidth; coinMsg.classList.add("show");
      D.refs.cards[side].classList.add("flash");
      choose(side, true);
    } } }, h("span", { "aria-hidden": "true", text: "🪙 " }), "Flip a coin");

    container.appendChild(h("div", { class: "duel" },
      h("header", { class: "duel-head" }, title, progress, capped),
      h("div", { class: "vs-cards", role: "group", "aria-label": "Choose one" }, left, h("span", { class: "vs-badge", "aria-hidden": "true", text: "VS" }), right),
      coinMsg,
      h("div", { class: "duel-tools" }, undo, coin),
      h("p", { class: "tip", text: "Tap a card, swipe it toward the middle, or use the arrow keys." }),
      live
    ));
    D.refs = { cards: { L: left, R: right }, title, bar, progress, undo };
    updateHead(vm);
    // keep keyboard users flowing: focus the first card unless focus is already inside a screen change
    if (vm.keepFocus) left.focus({ preventScroll: true });
  }

  function updateHead(vm) {
    const b = vm.bracket, r = D.refs;
    r.title.textContent = b.roundName + " · match " + (b.matchIndex + 1) + " of " + b.matchesInRound;
    r.bar.style.width = Math.round((b.duelsPlayed / Math.max(1, b.duelsTotal)) * 100) + "%";
    r.progress.setAttribute("aria-valuenow", String(b.duelsPlayed));
    r.undo.textContent = b.duelsPlayed === 0 ? "← Back to picks" : "↶ Undo last";
  }

  /* ---------- Winner ---------- */
  function confetti(box, colors) {
    const n = 46;
    for (let i = 0; i < n; i++) {
      const p = h("i", { class: "confetti" });
      p.style.setProperty("--x", (Math.random() * 100).toFixed(1) + "%");
      p.style.setProperty("--d", (Math.random() * 0.7).toFixed(2) + "s");
      p.style.setProperty("--t", (1.8 + Math.random() * 1.6).toFixed(2) + "s");
      p.style.setProperty("--r", Math.round(Math.random() * 720 - 360) + "deg");
      p.style.setProperty("--dx", Math.round(Math.random() * 160 - 80) + "px");
      p.style.background = colors[i % colors.length];
      box.appendChild(p);
    }
  }

  const W = { key: null };
  function renderWinner(container, vm, actions) {
    D.active = false;
    const c = vm.cuisine;
    const key = c.id + "|" + vm.notice + "|" + vm.runnerUps.map((x) => x.id).join(",") + "|" + vm.canRematch;
    if (W.key === key && container.firstChild) return;
    W.key = key;
    clear(container);

    const art = h("div", { class: "win-art", style: "--c:" + c.color });
    art.appendChild(WTE.Art.svgNode(WTE.Art.tileSvg(c, { size: 320 })));
    const box = h("div", { class: "confetti-box", "aria-hidden": "true" });
    if (!reducedMotion()) confetti(box, [c.color, c.accent, "#fff", "#FFD166", "#EF476F", "#06D6A0"]);

    const chips = vm.runnerUps.length
      ? h("div", { class: "runners" }, h("span", { class: "recent-label", text: "Close behind" }),
          vm.runnerUps.map((r) => h("button", { type: "button", class: "chip", style: "--c:" + r.color, on: { click: () => actions.useRunnerUp(r.id) }, title: "Find " + r.name + " instead" },
            h("span", { "aria-hidden": "true", text: r.emoji + " " }), r.name)))
      : null;

    container.appendChild(h("div", { class: "winner" },
      box,
      h("p", { class: "kicker", text: vm.notice === "surprise" ? "Fate has spoken" : vm.notice === "single" ? "Easy choice" : "And the winner is" }),
      art,
      h("h1", { id: "h-winner", tabindex: "-1", text: "Tonight: " + c.name + "." }),
      h("p", { class: "lede", text: c.blurb }),
      chips,
      h("div", { class: "win-actions" },
        h("button", { type: "button", class: "btn btn-primary btn-xl", on: { click: () => actions.findNearby() } }, "Find " + c.name + " nearby"),
        h("div", { class: "win-sub" },
          vm.canRematch ? h("button", { type: "button", class: "btn btn-ghost", on: { click: () => actions.rematch() } }, "↻ Rematch") : null,
          h("button", { type: "button", class: "btn btn-ghost", on: { click: () => actions.back() } }, "↶ " + (vm.canRematch ? "Undo last pick" : "Back to picks")),
          h("button", { type: "button", class: "btn btn-ghost", on: { click: () => actions.startOver() } }, "Start over"))
      )
    ));
  }

  WTE.UI.Duel = { render: renderDuel, leave() { D.active = false; D.key = null; }, renderWinner };
  WTE.UI.Winner = { render: renderWinner, leave() { W.key = null; } };
})(typeof window !== "undefined" ? window : globalThis);
