/* WTE.UI.Results — location bar, filters, list and map shell (lane B). */
(function (root) {
  const WTE = (root.WTE = root.WTE || {});
  WTE.UI = WTE.UI || {};
  const { h, clear } = WTE.Dom;

  const FILTERS = [
    ["openNow", "Open now"], ["vegetarian", "Vegetarian"], ["vegan", "Vegan"], ["halal", "Halal"],
    ["kosher", "Kosher"], ["glutenFree", "Gluten-free"], ["wheelchair", "Wheelchair"],
  ];
  const ref = { built: false, sig: "" };
  const emojiFor = (id) => { const c = WTE.Cuisines.byId(id); return c ? c.emoji : "🍽️"; };

  function build(container, vm, a) {
    clear(container);
    ref.built = true; ref.sig = "";

    ref.title = h("h1", { id: "h-results", tabindex: "-1", class: "res-title" });
    ref.chips = h("div", { class: "chips", role: "group", "aria-label": "Cuisine" });
    ref.other = h("select", { class: "select", "aria-label": "Other cuisine", on: { change: (e) => { const v = e.target.value; e.target.value = ""; if (v) a.useCuisine(v); } } },
      h("option", { value: "", text: "Other…" }),
      vm.allCuisines.map((c) => h("option", { value: c.id, text: c.emoji + " " + c.name })));

    ref.input = h("input", { type: "text", class: "input", id: "addr", name: "address", autocomplete: "off", enterkeyhint: "search", placeholder: "Address, city or lat, lng" });
    const form = h("form", { class: "addr-form", role: "search", on: { submit: (e) => { e.preventDefault(); a.search(ref.input.value); } } },
      h("label", { class: "sr-only", for: "addr", text: "Search an address or place" }),
      ref.input,
      h("button", { type: "submit", class: "btn btn-primary", text: "Search" }));
    ref.locate = h("button", { type: "button", class: "btn btn-ghost", on: { click: () => a.locate() } }, h("span", { "aria-hidden": "true", text: "📍 " }), "Use my location");
    ref.msg = h("p", { class: "loc-msg", role: "status", hidden: true });
    ref.places = h("ul", { class: "places", hidden: true });
    ref.locHint = h("p", { class: "hint", text: "or tap the map to drop a pin" });

    ref.radius = h("input", { type: "range", id: "radius", min: "0", max: String(vm.radiusSteps.length - 1), step: "1", class: "range", on: { input: (e) => { ref.radiusOut.textContent = vm.fmt(vm.radiusSteps[+e.target.value]); a.setRadius(vm.radiusSteps[+e.target.value]); } } });
    ref.radiusOut = h("output", { for: "radius", class: "range-out" });

    ref.filterBtns = {};
    const filters = h("div", { class: "chips", role: "group", "aria-label": "Filters" });
    FILTERS.forEach(([k, label]) => {
      const b = h("button", { type: "button", class: "chip chip-f", "aria-pressed": "false", on: { click: () => a.toggleFilter(k) }, text: label });
      ref.filterBtns[k] = b; filters.appendChild(b);
    });

    ref.sortBtns = {};
    const sort = h("div", { class: "seg", role: "group", "aria-label": "Sort by" });
    [["distance", "Distance"], ["name", "Name"]].forEach(([k, label]) => {
      const b = h("button", { type: "button", class: "seg-btn", "aria-pressed": "false", on: { click: () => a.setSort(k) }, text: label });
      ref.sortBtns[k] = b; sort.appendChild(b);
    });
    ref.pickOne = h("button", { type: "button", class: "btn btn-accent", on: { click: () => a.pickOne() } }, h("span", { "aria-hidden": "true", text: "🎯 " }), "Pick one for me");
    ref.share = h("button", { type: "button", class: "btn btn-ghost", on: { click: () => a.share() } }, h("span", { "aria-hidden": "true", text: "↗ " }), "Share");

    ref.status = h("div", { class: "res-status", "aria-live": "polite" });
    ref.list = h("ol", { class: "rlist" });

    const side = h("div", { class: "res-side" },
      h("div", { class: "res-head" }, ref.title, h("div", { class: "chips-row" }, ref.chips, ref.other)),
      h("div", { class: "panel" },
        form,
        h("div", { class: "loc-row" }, ref.locate, ref.locHint),
        ref.msg, ref.places,
        h("div", { class: "radius-row" }, h("label", { for: "radius", text: "Radius" }), ref.radius, ref.radiusOut)),
      h("div", { class: "panel panel-tight" }, filters,
        h("div", { class: "tools-row" }, sort, ref.pickOne, ref.share)),
      ref.status, ref.list);

    // map shell (persistent; MapView attaches to ref.map)
    ref.map = h("div", { class: "map", id: "map" });
    ref.mapMsg = h("p", { class: "map-fallback", hidden: true, text: "The map couldn’t load, but the list still works." });
    ref.overlay = h("div", { class: "map-overlay", hidden: true },
      h("div", { class: "overlay-card" },
        h("h2", { text: "Where are you eating?" }),
        h("p", { text: "We only look up restaurants near a spot you choose." }),
        h("div", { class: "overlay-btns" },
          h("button", { type: "button", class: "btn btn-primary", "data-act": "locate", on: { click: () => a.locate() } }, "📍 Use my location"),
          h("button", { type: "button", class: "btn btn-ghost", on: { click: () => ref.input.focus() } }, "⌨ Enter an address"),
          h("button", { type: "button", class: "btn btn-ghost", on: { click: () => a.demo() } }, "🗽 Try the demo city"))));
    ref.mapwrap = h("div", { class: "res-map" }, ref.map, ref.mapMsg, ref.overlay);

    container.appendChild(h("div", { class: "res-layout" }, side, ref.mapwrap));
  }

  function statusBlock(vm, a) {
    const f = [];
    if (vm.status === "idle") {
      f.push(h("div", { class: "state" }, h("p", { class: "state-big", text: "🗺️" }), h("p", { text: "Choose a spot to see " + vm.cuisine.name + " places nearby." })));
    } else if (vm.status === "locating" || vm.status === "loading") {
      f.push(h("div", { class: "state", role: "status" },
        h("p", { class: "state-line" }, h("span", { class: "spinner", "aria-hidden": "true" }), vm.status === "locating" ? "Finding you…" : "Looking for " + vm.cuisine.name + " nearby…"),
        h("button", { type: "button", class: "btn btn-ghost btn-sm", text: "Cancel", on: { click: () => a.cancel() } })));
      for (let i = 0; i < 4; i++) f.push(h("div", { class: "skeleton", "aria-hidden": "true" }, h("i"), h("b"), h("b", { class: "s" })));
    } else if (vm.status === "error") {
      f.push(h("div", { class: "state" }, h("p", { class: "state-big", text: "😕" }),
        h("p", { text: vm.error === "cancelled" ? "Search cancelled." : "Something went wrong finding places." }),
        h("div", { class: "state-btns" },
          h("button", { type: "button", class: "btn btn-primary", text: "Try again", on: { click: () => a.retry() } }),
          h("button", { type: "button", class: "btn btn-ghost", text: "Show sample places", on: { click: () => a.showSample() } }))));
    } else {
      if (vm.source === "sample") {
        f.push(h("p", { class: "banner banner-sample", role: "note" },
          vm.sampleReason === "demo" ? "Showing sample places — demo" : "Showing sample places — couldn’t reach OpenStreetMap"));
      } else if (vm.stale) {
        f.push(h("p", { class: "banner", role: "note", text: "Showing saved results — couldn’t refresh from OpenStreetMap." }));
      }
      if (vm.list.length === 0) {
        if (vm.rawCount > 0) {
          f.push(h("div", { class: "state" }, h("p", { class: "state-big", text: "🔍" }),
            h("p", { text: vm.rawCount + (vm.rawCount === 1 ? " place is" : " places are") + " hidden by filters." }),
            h("div", { class: "state-btns" }, h("button", { type: "button", class: "btn btn-primary", text: "Clear filters", on: { click: () => a.clearFilters() } }))));
        } else {
          const btns = [];
          if (vm.nextRadiusLabel) btns.push(h("button", { type: "button", class: "btn btn-primary", text: "Widen to " + vm.nextRadiusLabel, on: { click: () => a.widen() } }));
          if (vm.runnerUp) btns.push(h("button", { type: "button", class: "btn btn-ghost", text: "Try " + vm.runnerUp.name, on: { click: () => a.useCuisine(vm.runnerUp.id) } }));
          if (vm.source !== "sample") btns.push(h("button", { type: "button", class: "btn btn-ghost", text: "Show sample places", on: { click: () => a.showSample() } }));
          btns.push(h("button", { type: "button", class: "btn btn-ghost", text: "Pick again", on: { click: () => a.pickAgain() } }));
          f.push(h("div", { class: "state" }, h("p", { class: "state-big", text: "🍽️" }),
            h("p", { text: "No " + vm.cuisine.name + " spots within " + vm.radiusLabel + "." }),
            h("div", { class: "state-btns" }, btns)));
        }
      } else if (vm.hiddenCount > 0) {
        f.push(h("p", { class: "hint hidden-note" }, vm.hiddenCount + (vm.hiddenCount === 1 ? " place hidden" : " places hidden") + " by filters · ",
          h("button", { type: "button", class: "link-btn", text: "Clear filters", on: { click: () => a.clearFilters() } })));
      }
    }
    return f;
  }

  const DIETS = [["vegan", "Vegan"], ["vegetarian", "Vegetarian"], ["halal", "Halal"], ["kosher", "Kosher"], ["gluten_free", "Gluten-free"]];

  function dietBadges(r) {
    const out = [];
    const d = r.diet || {};
    const yes = (v) => v === "yes" || v === "only" || v === "limited";
    DIETS.forEach(([k, label]) => {
      if (k === "vegetarian" && yes(d.vegan)) return;
      if (yes(d[k])) {
        const pre = d[k] === "only" ? "Only " : d[k] === "limited" ? "Some " : "";
        out.push(h("span", { class: "badge badge-diet", text: pre ? pre + label.toLowerCase() : label }));
      }
    });
    if (r.wheelchair === "yes" || r.wheelchair === "limited") out.push(h("span", { class: "badge badge-diet", text: "♿ " + (r.wheelchair === "limited" ? "Partly accessible" : "Accessible") }));
    return out;
  }

  function telHref(p) { const t = String(p).replace(/[^\d+]/g, ""); return t ? "tel:" + t : null; }

  function card(r, vm, a) {
    const st = vm.openStatus(r);
    const sel = r.id === vm.selectedId;
    const badgeCls = st.open === true ? "badge-open" : st.open === false ? "badge-closed" : "badge-unknown";
    const links = [];
    links.push(h("a", { class: "act", href: vm.directionsUrl(r), target: "_blank", rel: "noopener noreferrer", text: "Directions" }));
    const site = r.website && WTE.Geo.safeUrl(r.website);
    if (site) links.push(h("a", { class: "act", href: site, target: "_blank", rel: "noopener noreferrer", text: "Website" }));
    const tel = r.phone && telHref(r.phone);
    if (tel) links.push(h("a", { class: "act", href: tel, text: "Call" }));
    if (r.osmUrl) links.push(h("a", { class: "act", href: r.osmUrl, target: "_blank", rel: "noopener noreferrer", text: "View on OSM" }));
    const meta = [r.kind ? r.kind.replace(/_/g, " ") : "", r.cuisineLabel].filter(Boolean).join(" · ");
    const li = h("li", { class: "rcard" + (sel ? " is-selected" : ""), "data-id": r.id, style: "--c:" + vm.cuisine.color },
      h("span", { class: "rc-emoji", "aria-hidden": "true", text: emojiFor(r.primaryCuisine) }),
      h("div", { class: "rc-body" },
        h("div", { class: "rc-top" },
          h("h3", { class: "rc-name" }, h("button", { type: "button", class: "rc-btn", "aria-current": sel ? "true" : null, on: { click: () => a.select(r.id) }, text: r.name })),
          h("span", { class: "rc-dist", text: vm.fmt(r.distanceM) })),
        meta ? h("p", { class: "rc-meta", text: meta }) : null,
        h("div", { class: "rc-badges" },
          h("span", { class: "badge " + badgeCls, text: st.label + (st.open && st.closesAt ? " · until " + st.closesAt : "") }),
          dietBadges(r)),
        r.address ? h("p", { class: "rc-addr", text: r.address }) : null,
        h("div", { class: "rc-acts" }, links)));
    li.addEventListener("click", (e) => { if (!e.target.closest("a,button")) a.select(r.id); });
    return li;
  }

  function render(container, vm, a) {
    if (!ref.built || !container.contains(ref.title)) build(container, vm, a);
    const c = vm.cuisine;
    ref.title.textContent = c.emoji + " " + c.name + " nearby";

    // cuisine chips
    clear(ref.chips);
    vm.chipCuisines.forEach((x) => ref.chips.appendChild(
      h("button", { type: "button", class: "chip chip-c", style: "--c:" + x.color, "aria-pressed": x.id === c.id ? "true" : "false", on: { click: () => a.useCuisine(x.id) } },
        h("span", { "aria-hidden": "true", text: x.emoji + " " }), x.name)));

    // location
    if (document.activeElement !== ref.input && ref.input.dataset.label !== vm.centerLabel) { ref.input.value = vm.centerLabel || ""; ref.input.dataset.label = vm.centerLabel || ""; }
    ref.locate.hidden = !vm.geoAvailable;
    ref.locHint.hidden = !vm.mapAvailable;
    ref.msg.hidden = !vm.message; ref.msg.textContent = vm.message || "";
    clear(ref.places);
    ref.places.hidden = !vm.places.length;
    vm.places.forEach((p, i) => ref.places.appendChild(h("li", {}, h("button", { type: "button", class: "place", text: p.label, on: { click: () => a.choosePlace(i) } }))));

    // radius
    const idx = vm.radiusSteps.indexOf(vm.radiusM);
    if (document.activeElement !== ref.radius) ref.radius.value = String(Math.max(0, idx));
    ref.radiusOut.textContent = vm.radiusLabel;
    ref.radius.setAttribute("aria-valuetext", vm.radiusLabel);

    FILTERS.forEach(([k]) => ref.filterBtns[k].setAttribute("aria-pressed", vm.filters[k] ? "true" : "false"));
    Object.keys(ref.sortBtns).forEach((k) => ref.sortBtns[k].setAttribute("aria-pressed", vm.sort === k ? "true" : "false"));
    ref.pickOne.disabled = !vm.list.length;

    // map overlay / fallback
    ref.overlay.hidden = !(vm.mapAvailable && !vm.center);
    ref.mapMsg.hidden = vm.mapAvailable;
    ref.mapwrap.classList.toggle("no-map", !vm.mapAvailable);
    container.classList.toggle("list-only", !vm.mapAvailable);

    // status + list (rebuild only when something relevant changed)
    const sig = [vm.status, vm.source, vm.stale, vm.error, vm.sampleReason, vm.rawCount, vm.hiddenCount, vm.radiusM, vm.sort, vm.selectedId, vm.cuisine.id,
      vm.list.map((r) => r.id).join(","), vm.minute].join("|");
    if (sig !== ref.sig) {
      ref.sig = sig;
      clear(ref.status); statusBlock(vm, a).forEach((n) => ref.status.appendChild(n));
      clear(ref.list);
      if (vm.status === "ready") vm.list.forEach((r) => ref.list.appendChild(card(r, vm, a)));
      if (vm.scrollToSelected && vm.selectedId) {
        const el = ref.list.querySelector('[data-id="' + (root.CSS && CSS.escape ? CSS.escape(vm.selectedId) : vm.selectedId.replace(/"/g, "")) + '"]');
        if (el) el.scrollIntoView({ block: "nearest", behavior: WTE.Dom.reducedMotion() ? "auto" : "smooth" });
      }
    }
  }

  WTE.UI.Results = { render, mapEl() { return ref.map || null; }, reset() { ref.built = false; } };
})(typeof window !== "undefined" ? window : globalThis);
