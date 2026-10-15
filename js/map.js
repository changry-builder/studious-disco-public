// Round map for the reveal screen: the round's countries highlighted, with capitals,
// largest cities, clue cities and each player's answers plotted. Tap a stop to zoom in.
// Uses d3-geo for the projection; WORLD and PLACES come from scripts/build-geo.js.

const RevealMap = (function () {
  // Drawn at the size it appears on screen, so labels stay readable on a phone.
  let W = 960;
  let H = 500;
  const PAD = 24;
  function sizeTo(el) {
    W = Math.max(280, Math.round(el.clientWidth || 960));
    H = Math.round(W < 600 ? Math.min(W * 0.8, 360) : W * 0.52);
  }
  const MIN_SPAN_DEG = 14; // never zoom in closer than this, so tiny countries keep context

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const shortName = (country) => country.name.replace(/\s*\(.*\)$/, "");

  const featureFor = (code) => WORLD.features.filter((f) => f.id === code);

  // A country's biggest landmass, so France fits to France and not to French Guiana too.
  function mainland(f) {
    if (f.geometry.type !== "MultiPolygon") return f;
    const polys = f.geometry.coordinates.map((c) => ({ type: "Polygon", coordinates: c }));
    const biggest = polys.reduce((a, b) => (d3.geoArea(b) > d3.geoArea(a) ? b : a));
    return { type: "Feature", geometry: biggest };
  }
  const placeOf = (code, city) => (PLACES[code] || {})[city] || null;

  // Everything worth plotting for one question.
  function stopsFor(q, i, round, mode, focused) {
    const code = q.country.code;
    const cities = new Map();
    const add = (name, flags) => {
      const at = placeOf(code, name);
      if (!at) return;
      const city = cities.get(name) || { name, at, answeredBy: [] };
      Object.assign(city, flags);
      cities.set(name, city);
    };

    if (mode === "cities") {
      q.country.capital.forEach((e) => add(Engine.displayName(e), { capital: true }));
      q.country.largest.forEach((e) => add(Engine.displayName(e), { largest: true }));
      if (focused) q.country.cities.forEach((e) => add(Engine.displayName(e), {}));
      [0, 1].forEach((p) => {
        const r = round.turns[p][i].result;
        if (r.match && r.kind !== "miss") {
          add(r.match, {});
          const city = cities.get(r.match);
          if (city) city.answeredBy.push(p);
        }
      });
    } else if (mode === "top3") {
      q.cities.forEach((name, k) => add(name, { rank: k + 1 }));
      if (focused) q.country.capital.forEach((e) => add(Engine.displayName(e), { capital: true }));
    } else {
      add(q.clue, { clue: true });
      if (focused) q.country.capital.forEach((e) => add(Engine.displayName(e), { capital: true }));
    }

    const wrong = [0, 1]
      .map((p) => ({ p, r: round.turns[p][i].result }))
      .filter(({ r }) => r.kind === "wrong" && r.code)
      .map(({ p, r }) => ({ p, code: r.code }));

    // Headline cities first, so they get the best label spots.
    const rank = (c) => (c.clue || c.rank || c.capital || c.largest || c.answeredBy.length ? 0 : 1);
    return { code, cities: [...cities.values()].sort((a, b) => rank(a) - rank(b)), wrong };
  }

  function projectionFor(target) {
    const proj = d3.geoNaturalEarth1().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], target);
    const maxScale = W / ((MIN_SPAN_DEG * Math.PI) / 180) / 0.87;
    if (proj.scale() > maxScale) {
      const center = d3.geoCentroid(target);
      proj.scale(maxScale).translate([W / 2, H / 2]);
      const at = proj(center);
      proj.translate([W - at[0], H - at[1]]);
    }
    return proj;
  }

  function star(x, y, r) {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const rad = k % 2 ? r * 0.45 : r;
      const a = (Math.PI / 5) * k - Math.PI / 2;
      pts.push(`${(x + rad * Math.cos(a)).toFixed(1)},${(y + rad * Math.sin(a)).toFixed(1)}`);
    }
    return `<polygon class="mk-star" points="${pts.join(" ")}" />`;
  }

  // Place labels to the right, left, above or below a point, avoiding earlier labels.
  function labeller() {
    const boxes = [];
    const hits = (b) => boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    return (x, y, text, cls) => {
      const w = text.length * 7.2 + 4;
      const h = 14;
      const options = [
        { x: x + 10, y: y - h / 2, anchor: "start" },
        { x: x - 10 - w, y: y - h / 2, anchor: "end" },
        { x: x - w / 2, y: y - 12 - h, anchor: "middle" },
        { x: x - w / 2, y: y + 12, anchor: "middle" },
      ];
      const free = options.find((o) => o.x > 0 && o.x + w < W && !hits({ ...o, w, h }));
      if (!free && cls === "minor") return ""; // leave minor cities unlabelled rather than overlap
      const spot = free || options[0];
      boxes.push({ ...spot, w, h });
      const tx = spot.anchor === "start" ? spot.x : spot.anchor === "end" ? spot.x + w : spot.x + w / 2;
      return `<text class="mk-label ${cls || ""}" x="${tx.toFixed(1)}" y="${(spot.y + h - 3).toFixed(1)}" text-anchor="${spot.anchor}">${esc(text)}</text>`;
    };
  }

  function svgFor({ mode, round }, focus) {
    const questions = round.questions;
    const shown = focus == null ? questions.map((q, i) => i) : [focus];
    const stops = shown.map((i) => stopsFor(questions[i], i, round, mode, focus != null));

    // Fit the view to the round's countries, the plotted cities and any wrong guesses,
    // so "you said France, it's in Indonesia" is visible at a glance.
    const hitFeatures = stops.flatMap((s) => [s.code, ...s.wrong.map((w) => w.code)]).flatMap(featureFor).map(mainland);
    const points = stops.flatMap((s) => s.cities.map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: c.at } })));
    const proj = projectionFor({ type: "FeatureCollection", features: [...hitFeatures, ...points] });
    const path = d3.geoPath(proj);

    const hitCodes = new Set(stops.map((s) => s.code));
    const wrongBy = new Map();
    stops.forEach((s) => s.wrong.forEach(({ p, code }) => wrongBy.set(code, [...(wrongBy.get(code) || []), p])));

    const land = WORLD.features
      .map((f) => {
        const d = path(f);
        if (!d) return "";
        const cls = hitCodes.has(f.id) ? "map-hit" : wrongBy.has(f.id) ? `map-wrong p${wrongBy.get(f.id)[0]}` : "map-land";
        return `<path class="${cls}" d="${d}" />`;
      })
      .join("");

    const label = labeller();
    const marks = [];
    const labels = [];

    stops.forEach((s, k) => {
      const country = questions[shown[k]].country;
      // Country names in the overview, except where the city is the question.
      if (focus == null && mode !== "countries") {
        const f = featureFor(s.code)[0];
        const capital = s.cities.find((c) => c.capital);
        const at = capital ? proj(capital.at) : f && path.centroid(f);
        if (at && isFinite(at[0])) labels.push(label(at[0], at[1], shortName(country), "country"));
      }
      s.cities.forEach((c) => {
        const at = proj(c.at);
        if (!at || !isFinite(at[0])) return;
        const [x, y] = at;
        c.answeredBy.forEach((p, n) => marks.push(`<circle class="mk-ring p${p}" cx="${x}" cy="${y}" r="${9 + n * 4}" />`));
        if (c.rank) {
          marks.push(`<circle class="mk-clue" cx="${x}" cy="${y}" r="7.5" />`);
          marks.push(`<text class="mk-rank" x="${x}" y="${y + 3.5}" text-anchor="middle">${c.rank}</text>`);
        } else if (c.clue) marks.push(`<circle class="mk-clue" cx="${x}" cy="${y}" r="6.5" />`);
        else if (c.capital) {
          if (c.largest) marks.push(`<circle class="mk-both" cx="${x}" cy="${y}" r="8.5" />`);
          marks.push(star(x, y, 7));
        } else if (c.largest) marks.push(`<circle class="mk-largest" cx="${x}" cy="${y}" r="4.5" />`);
        else marks.push(`<circle class="mk-minor" cx="${x}" cy="${y}" r="${c.answeredBy.length ? 3.5 : 2.5}" />`);

        const important = c.clue || c.rank || c.capital || c.largest || c.answeredBy.length;
        if (focus != null || c.clue) labels.push(label(x, y, c.name, c.clue ? "clue" : important ? "" : "minor"));
      });
    });

    return `<svg class="map-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of this round's ${
      mode === "countries" ? "cities" : "countries"
    }">
      <path class="map-sea" d="${path({ type: "Sphere" })}" />
      <path class="map-grat" d="${path(d3.geoGraticule10())}" />
      ${land}
      ${marks.join("")}
      ${labels.join("")}
    </svg>`;
  }

  function legendFor(mode, names) {
    const ring = (p) => `<span class="lg"><svg viewBox="0 0 20 20"><circle class="mk-ring p${p}" cx="10" cy="10" r="7" /></svg>${esc(names[p])}'s answer</span>`;
    const wrong = (p) => `<span class="lg"><span class="lg-swatch map-wrong p${p}"></span>${esc(names[p])}'s wrong guess</span>`;
    const starIcon = `<svg viewBox="0 0 20 20">${star(10, 10, 8)}</svg>`;
    if (mode === "cities") {
      return `
        <span class="lg">${starIcon}Capital</span>
        <span class="lg"><svg viewBox="0 0 20 20"><circle class="mk-largest" cx="10" cy="10" r="5" /></svg>Largest city</span>
        <span class="lg"><svg viewBox="0 0 20 20"><circle class="mk-both" cx="10" cy="10" r="8.5" />${star(10, 10, 6)}</svg>Both</span>
        ${ring(0)}${ring(1)}`;
    }
    if (mode === "top3") {
      return `
        <span class="lg"><svg viewBox="0 0 20 20"><circle class="mk-clue" cx="10" cy="10" r="8" /><text class="mk-rank" x="10" y="13.5" text-anchor="middle">1</text></svg>Top 3 cities, 1 = biggest</span>
        <span class="lg">${starIcon}Capital</span>
        <span class="lg"><span class="lg-swatch map-hit"></span>The country</span>
        ${wrong(0)}${wrong(1)}`;
    }
    return `
      <span class="lg"><svg viewBox="0 0 20 20"><circle class="mk-clue" cx="10" cy="10" r="6" /></svg>The city</span>
      <span class="lg"><span class="lg-swatch map-hit"></span>Its country</span>
      ${wrong(0)}${wrong(1)}`;
  }

  // Draw the map into `el`. Returns { focus(i) } so the answer rows can zoom it.
  function mount(el, { mode, round, names }) {
    const stopLabel = (q) => (mode === "countries" ? q.clue : q.country.code);
    let current = null;

    el.innerHTML = `
      <div class="map-tabs" role="tablist" aria-label="Zoom the map">
        <button type="button" class="map-tab" data-focus="" role="tab">All</button>
        ${round.questions
          .map((q, i) => `<button type="button" class="map-tab" data-focus="${i}" role="tab">${esc(stopLabel(q))}</button>`)
          .join("")}
      </div>
      <div class="map-frame"></div>
      <div class="map-legend">${legendFor(mode, names)}</div>`;

    const frame = el.querySelector(".map-frame");
    function focus(i) {
      current = i;
      sizeTo(frame);
      frame.innerHTML = svgFor({ mode, round }, i);
      el.querySelectorAll(".map-tab").forEach((b) => {
        const on = (b.dataset.focus === "" ? null : Number(b.dataset.focus)) === i;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on);
      });
    }
    el.querySelector(".map-tabs").addEventListener("click", (e) => {
      const b = e.target.closest(".map-tab");
      if (!b) return;
      const i = b.dataset.focus === "" ? null : Number(b.dataset.focus);
      focus(i === current ? null : i);
    });
    focus(null);

    // Redraw at the new size when the window changes (e.g. a phone is rotated).
    let lastWidth = frame.clientWidth;
    const onResize = () => {
      if (!frame.isConnected) return window.removeEventListener("resize", onResize);
      if (Math.abs(frame.clientWidth - lastWidth) < 8) return;
      lastWidth = frame.clientWidth;
      focus(current);
    };
    window.addEventListener("resize", onResize);
    return { focus };
  }

  return { mount };
})();
