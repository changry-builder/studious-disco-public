/* WTE.UI.Pick — the cuisine tile grid and sticky action bar (lane B). */
(function (root) {
  const WTE = (root.WTE = root.WTE || {});
  WTE.UI = WTE.UI || {};
  const { h, clear } = WTE.Dom;

  const ref = { built: false, tiles: {} };

  function build(container, vm, actions) {
    clear(container);
    ref.tiles = {};

    const hero = h("div", { class: "hero" },
      h("h1", { id: "h-pick", tabindex: "-1", text: "What are you craving?" }),
      h("p", { class: "lede", text: "Tap what sounds good, ✕ what doesn’t. Then we’ll settle it with head-to-head showdowns." })
    );
    ref.recent = h("div", { class: "recent", hidden: true });
    ref.notice = h("p", { class: "notice", role: "status", hidden: true });

    const grid = h("ul", { class: "tile-grid", role: "list" });
    vm.cuisines.forEach((c) => {
      const art = h("span", { class: "tile-art" });
      art.appendChild(WTE.Art.svgNode(WTE.Art.tileSvg(c, { size: 160 })));
      const check = h("span", { class: "tile-check", "aria-hidden": "true", text: "✓" });
      const btn = h("button", {
        type: "button", class: "tile", style: "--c:" + c.color, "data-id": c.id,
        on: { click: () => actions.toggle(c.id) },
      },
        art, check,
        h("span", { class: "tile-cap" },
          h("span", { class: "tile-name", text: c.name }),
          h("span", { class: "tile-blurb", text: c.blurb }))
      );
      const x = h("button", {
        type: "button", class: "tile-x", "data-id": c.id,
        on: { click: (e) => { e.stopPropagation(); actions.reject(c.id); } },
      });
      ref.tiles[c.id] = { btn, x, c };
      grid.appendChild(h("li", { class: "tile-wrap" }, btn, x));
    });

    // action bar
    ref.count = h("span", { class: "bar-count", "aria-live": "polite" });
    ref.hint = h("span", { class: "bar-hint" });
    ref.keepAll = h("button", { type: "button", class: "link-btn", text: "Keep all", on: { click: () => actions.keepAll() } });
    ref.reset = h("button", { type: "button", class: "link-btn", text: "Reset", on: { click: () => actions.reset() } });
    ref.surprise = h("button", { type: "button", class: "btn btn-ghost", on: { click: () => actions.surprise() } },
      h("span", { "aria-hidden": "true", text: "🎲 " }), "Surprise me");
    ref.start = h("button", { type: "button", class: "btn btn-primary btn-xl", on: { click: () => actions.start() } });
    const bar = h("div", { class: "bar", role: "region", "aria-label": "Your picks" },
      h("div", { class: "bar-row" }, h("div", { class: "bar-info" }, ref.count, ref.hint), h("div", { class: "bar-links" }, ref.keepAll, ref.reset)),
      h("div", { class: "bar-row bar-actions" }, ref.surprise, ref.start)
    );

    container.appendChild(hero);
    container.appendChild(ref.recent);
    container.appendChild(ref.notice);
    container.appendChild(grid);
    container.appendChild(bar);
    ref.built = true;
  }

  function render(container, vm, actions) {
    if (!ref.built || !container.contains(ref.count)) build(container, vm, actions);
    let kept = 0, out = 0;
    vm.cuisines.forEach((c) => {
      const t = ref.tiles[c.id];
      const m = vm.marks[c.id];
      if (m === "keep") kept++;
      if (m === "reject") out++;
      t.btn.classList.toggle("is-keep", m === "keep");
      t.btn.classList.toggle("is-out", m === "reject");
      t.btn.setAttribute("aria-pressed", m === "keep" ? "true" : "false");
      t.btn.setAttribute("aria-label", c.name + ". " + c.blurb + " " + (m === "keep" ? "Kept." : m === "reject" ? "Ruled out. Tap to restore." : "Tap to keep."));
      t.x.classList.toggle("is-restore", m === "reject");
      t.x.textContent = m === "reject" ? "↺" : "✕";
      t.x.setAttribute("aria-label", (m === "reject" ? "Restore " : "Rule out ") + c.name);
      t.x.title = m === "reject" ? "Restore" : "Rule out";
    });

    ref.count.textContent = kept + " kept · " + out + " out";
    const p = vm.preview;
    ref.start.disabled = p.label === "none";
    ref.start.textContent =
      p.label === "none" ? "Everything’s out" :
      p.label === "single" ? "Eat " + vm.soloName + "!" : "Showdown (" + p.count + ")";
    if (p.willCap) {
      ref.hint.textContent = "That’s a lot — " + p.count + " of your " + vm.pickedCount + " picked at random for the showdown.";
    } else if (!kept && p.label !== "none") {
      ref.hint.textContent = "Nothing kept — all " + vm.pickedCount + " left will compete.";
    } else ref.hint.textContent = "";
    ref.hint.hidden = !ref.hint.textContent;

    ref.notice.hidden = vm.notice !== "none-left";
    ref.notice.textContent = vm.notice === "none-left" ? "Everything’s ruled out — restore something, or let us surprise you." : "";

    // recent winners
    clear(ref.recent);
    ref.recent.hidden = !vm.recent.length;
    if (vm.recent.length) {
      ref.recent.appendChild(h("span", { class: "recent-label", text: "Recent winners" }));
      vm.recent.forEach((c) =>
        ref.recent.appendChild(h("button", { type: "button", class: "chip", style: "--c:" + c.color, on: { click: () => actions.toggle(c.id) }, "aria-label": "Keep " + c.name },
          h("span", { "aria-hidden": "true", text: c.emoji + " " }), c.name)));
    }
  }

  WTE.UI.Pick = { render, reset() { ref.built = false; } };
})(typeof window !== "undefined" ? window : globalThis);
