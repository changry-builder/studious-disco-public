/* Depth Chart: UI. Renders the field, roster list and contract grid, and wires up editing. */
(function () {
  const M = window.DC_Model;
  const FIELDS = window.DC_Fields;
  const BUILTIN = window.DC_TEAMS;
  const CONFIG = window.DC_CONFIG || {};

  const TEAMS_BY_SPORT = { baseball: ["mets"], basketball: ["ucla-m", "ucla-w"] };
  const ROSTER_LIMIT = { "26": 26, "40": 40, basketball: 15 };
  const SLOT_CAP = { SP: 6 };
  const DEFAULT_CAP = 4;

  // ---------- storage (best effort; the app works without it) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (_) {
        /* private mode or storage full: keep going in memory */
      }
    },
    del(key) {
      try {
        localStorage.removeItem(key);
      } catch (_) {}
    },
  };

  const ui = Object.assign(
    { sport: "baseball", team: { baseball: "mets", basketball: "ucla-m" }, season: {}, view: "26", expanded: {}, tableOnly: {}, lineupHidden: false },
    store.get("dc.ui", {})
  );
  ui.expanded = ui.expanded || {};
  ui.tableOnly = ui.tableOnly || {};
  const states = {};

  // ---------- keeping edits safe across new versions of the site ----------
  // Edits live in this browser's storage and are applied on top of whatever roster data the site ships,
  // so updating the site never replaces them. Before a new version first runs, every team's edits are
  // also copied into an automatic snapshot that can be restored from "Save / restore".
  const SITE_VERSION = "2026-11-24";
  const SNAPSHOTS_KEPT = 5;
  const TEAM_IDS = Object.keys(BUILTIN);

  function collectEdits() {
    const teams = {};
    for (const id of TEAM_IDS) {
      const state = store.get(`dc.state.${id}`, null);
      const seed = store.get(`dc.seed.${id}`, null);
      if (state || seed) teams[id] = { state, seed };
    }
    return teams;
  }
  function snapshot(reason) {
    const teams = collectEdits();
    if (!Object.keys(teams).length) return;
    const list = store.get("dc.snapshots", []);
    list.unshift({ at: new Date().toISOString(), reason, schema: M.SCHEMA, teams });
    store.set("dc.snapshots", list.slice(0, SNAPSHOTS_KEPT));
  }
  function restoreTeams(teams) {
    snapshot("Before restoring");
    for (const [id, saved] of Object.entries(teams || {})) {
      if (!BUILTIN[id] || !saved) continue;
      // Older backups stored the edits directly; newer ones wrap them as { state, seed }.
      const wrapped = "state" in saved || "seed" in saved;
      const state = wrapped ? saved.state : saved;
      if (state) store.set(`dc.state.${id}`, M.normalizeState(state));
      else store.del(`dc.state.${id}`);
      if (wrapped && saved.seed) store.set(`dc.seed.${id}`, saved.seed);
      else store.del(`dc.seed.${id}`);
      delete states[id];
    }
  }
  (function upgrade() {
    const seen = store.get("dc.siteVersion", null);
    if (seen === SITE_VERSION) return;
    snapshot(seen ? `Before update to ${SITE_VERSION} (was ${seen})` : `Before update to ${SITE_VERSION}`);
    // Re-save each team's edits in the current format; nothing is dropped.
    for (const id of TEAM_IDS) {
      const raw = store.get(`dc.state.${id}`, null);
      if (raw) store.set(`dc.state.${id}`, M.normalizeState(raw));
    }
    store.set("dc.siteVersion", SITE_VERSION);
  })();

  function team() {
    const id = ui.team[ui.sport];
    const override = store.get(`dc.seed.${id}`, null);
    return override ? Object.assign({}, BUILTIN[id], override) : BUILTIN[id];
  }
  function stateOf(t) {
    if (!states[t.id]) states[t.id] = M.normalizeState(store.get(`dc.state.${t.id}`, null));
    return states[t.id];
  }
  function setState(t, s) {
    states[t.id] = s;
    store.set(`dc.state.${t.id}`, s);
    render();
  }
  function season(t) {
    const s = ui.season[t.id];
    const shown = M.visibleSeasons(t, stateOf(t));
    if (shown.includes(s)) return s;
    return shown.includes(t.baseSeason) ? t.baseSeason : shown[0];
  }
  function view(t) {
    return t.sport === "baseball" ? ui.view : "all";
  }
  function saveUI() {
    store.set("dc.ui", ui);
  }

  // ---------- helpers ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const shortName = (name) => {
    const parts = String(name).split(" ");
    if (parts.length < 2) return name;
    const suffix = /^(Jr\.?|Sr\.?|II|III|IV)$/.test(parts[parts.length - 1]) ? " " + parts.pop() : "";
    return `${parts[0][0]}. ${parts.slice(1).join(" ")}${suffix}`;
  };
  function chipText(t, p, s) {
    if (t.sport === "basketball") {
      const st = M.statusFor(t, p, s);
      return st ? st.short : "";
    }
    return `thru '${String(M.lastSeason(t, p)).slice(2)}`;
  }
  /** Small tag after a name: the class (colored by year) for basketball, contract end for baseball. */
  function chipHTML(t, p, s) {
    const text = chipText(t, p, s);
    if (!text) return "";
    const cls = t.sport === "basketball" ? ` cls cls-${text.toLowerCase()}` : "";
    return `<span class="chip${cls}">${esc(text)}</span>`;
  }
  /** CSS class for a season status badge in the table. */
  function stClass(x) {
    return x.kind === "class" ? `st st-class cls-${x.short.toLowerCase()}` : `st st-${x.kind}`;
  }
  function playerById(t, id) {
    return M.allPlayers(t, stateOf(t)).find((p) => p.id === id);
  }

  // ---------- render ----------
  function render() {
    const t = team();
    $("main").className = `layout sport-${t.sport}`;
    renderControls(t);
    renderField(t);
    renderRoster(t);
    renderTable(t);
    saveUI();
  }

  function seg(name, options, current) {
    return `<div class="seg" role="group" aria-label="${esc(name)}">${options
      .map(
        ([value, label]) =>
          `<button type="button" data-seg="${esc(name)}" data-value="${esc(value)}" aria-pressed="${value === current}">${esc(label)}</button>`
      )
      .join("")}</div>`;
  }

  function renderControls(t) {
    const s = season(t);
    const teams = TEAMS_BY_SPORT[ui.sport].map((id) => [id, BUILTIN[id].short]);
    const seasons = M.visibleSeasons(t, stateOf(t)).map((y) => [String(y), M.seasonLabel(t, y)]);
    $("#controls").innerHTML = `
      <div class="ctl-row">
        ${seg("sport", [["baseball", "⚾ Baseball"], ["basketball", "🏀 Basketball"]], ui.sport)}
        ${teams.length > 1 ? seg("team", teams, t.id) : `<span class="team-tag">${esc(t.name)}</span>`}
        ${t.sport === "baseball" ? seg("view", [["26", "26-man"], ["40", "40-man"]], ui.view) : ""}
      </div>
      <div class="ctl-row">
        <span class="lbl">Season</span>
        ${seg("season", seasons, String(s))}
      </div>`;
    const players = M.playersFor(t, stateOf(t), s, view(t));
    const hurt = M.injuredFor(t, stateOf(t), s).length;
    const limit = t.sport === "baseball" ? ROSTER_LIMIT[ui.view] : ROSTER_LIMIT.basketball;
    const projected = s !== t.baseSeason;
    $("#summary").innerHTML = `
      <h2>${esc(t.name)} <span>${esc(M.seasonLabel(t, s))}</span></h2>
      <p>${
        projected
          ? `Projection: ${t.sport === "baseball" ? "players under contract or team control" : "returning players (five-year rule)"} plus your additions.`
          : esc(t.asOf)
      } <b class="count ${players.length > limit ? "over" : ""}">${players.length} / ${limit}</b>${
        hurt ? ` <span class="il-count">+${hurt} on the injured list</span>` : ""
      }</p>`;
  }

  function renderField(t) {
    const s = season(t);
    const v = view(t);
    const layout = FIELDS[t.sport];
    const { depth, unplaced } = M.layoutFor(t, stateOf(t), s, v);
    const field = $("#field");
    field.className = `field field-${t.sport}`;
    field.style.setProperty("--aspect", layout.aspect);
    const slots = Object.entries(layout.slots)
      .map(([pos, [x, y]]) => slotHTML(t, s, pos, depth[pos], { x, y }, unplaced))
      .join("");
    field.innerHTML = `<div class="turf">${layout.svg}</div>${lineupHTML(t, s)}<div class="slots">${slots}</div>`;

    const side = $("#side");
    if (layout.side) {
      side.hidden = false;
      side.innerHTML = `<h3>${esc(layout.side.title)}</h3><div class="side-slots">${layout.side.slots
        .map((pos) => slotHTML(t, s, pos, depth[pos], null, unplaced))
        .join("")}</div>`;
    } else {
      side.hidden = true;
      side.innerHTML = "";
    }
    renderIL(t, s);
  }

  function renderIL(t, s) {
    const hurt = M.injuredFor(t, stateOf(t), s);
    $("#il").innerHTML = `<h3>Injured list <span>${esc(M.seasonLabel(t, s))}</span></h3>
      <p class="hint">Drag a player here to put them on the injured list; they come off the ${
        t.sport === "baseball" ? "field" : "court"
      } and don't count against the roster. Drag them back to a position, or click ✓, to activate them.</p>
      <ul class="il-list">${
        hurt.length
          ? hurt
              .map(
                (p) => `<li class="ilp" draggable="true" data-id="${esc(p.id)}">
                  <button type="button" class="pname" data-open="${esc(p.id)}" data-tip="${esc(p.id)}">${
                    p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""
                  }${esc(p.name)}</button>
                  <span class="muted">${esc(p.pos[0])}</span>${chipHTML(t, p, s)}
                  <button type="button" class="btn small" data-activate="${esc(p.id)}" title="Activate ${esc(p.name)}">✓ Activate</button>
                </li>`
              )
              .join("")
          : `<li class="open-slot">No one is injured.</li>`
      }</ul>`;
  }

  function lineupHTML(t, s) {
    const st = stateOf(t);
    if (ui.lineupHidden) {
      return `<aside class="lineup collapsed"><button type="button" class="lineup-toggle" data-lineup aria-expanded="false">Starting Lineup ▸</button></aside>`;
    }
    const num = (p) => (p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : "");
    const who = (p, name) =>
      `<button type="button" class="pname" data-open="${esc(p.id)}" data-tip="${esc(p.id)}">${num(p)}${esc(name)}</button>`;
    let rows;
    if (t.sport === "baseball") {
      // Batting order: drag a row (or use ▲ ▼) to change the order. The starting pitcher sits below it.
      rows = M.battingOrder(t, st, s, view(t))
        .map(({ spot, pos, id }) => {
          const p = id && playerById(t, id);
          return `<li class="bo" draggable="true" data-bpos="${esc(pos)}">
            <span class="spot">${spot}</span>${p ? who(p, shortName(p.name)) : `<span class="muted">Open</span>`}<b>${esc(pos)}</b>
            <span class="bo-tools"><button type="button" data-bo="-1" aria-label="Bat ${esc(pos)} earlier">▲</button><button type="button" data-bo="1" aria-label="Bat ${esc(pos)} later">▼</button></span>
          </li>`;
        })
        .join("");
      const sp = M.starters(t, st, s, view(t)).find((x) => x.pos === "SP");
      const pitcher = sp && sp.id && playerById(t, sp.id);
      rows += `<li class="bo-sp"><span class="spot">SP</span>${pitcher ? who(pitcher, shortName(pitcher.name)) : `<span class="muted">Open</span>`}</li>`;
    } else {
      rows = M.starters(t, st, s, view(t))
        .map(({ pos, id }) => {
          const p = id && playerById(t, id);
          if (!p) return `<li><b>${esc(pos)}</b><span class="muted">Open</span></li>`;
          return `<li><b>${esc(pos)}</b>${who(p, p.name)}${chipHTML(t, p, s)}</li>`;
        })
        .join("");
    }
    return `<aside class="lineup lineup-${t.sport}" aria-label="Starting lineup">
      <header><h3>${t.sport === "baseball" ? "Batting Order" : "Starting Lineup"}</h3><button type="button" class="lineup-toggle" data-lineup aria-expanded="true" title="Hide">▾</button></header>
      <ol>${rows}</ol>
    </aside>`;
  }

  function slotHTML(t, s, pos, ids, at, unplaced) {
    const st = stateOf(t);
    const cap = at ? SLOT_CAP[pos] || DEFAULT_CAP : Infinity;
    const key = `${t.id}:${pos}`;
    const open = ui.expanded[key];
    // Players still to be placed always show, even past the card's limit.
    const shown = ids.filter((id, i) => open || i < cap || unplaced.has(id));
    const more = ids.length - shown.length;
    const rows = shown
      .map((id, i) => {
        const p = M.allPlayers(t, st).find((x) => x.id === id);
        if (!p) return "";
        const todo = unplaced.has(id);
        return `<li class="dp${todo ? " unplaced" : ""}${i === 0 ? " starter" : ""}" draggable="true" data-id="${esc(id)}" data-pos="${esc(pos)}"${
          todo ? ` title="Not on the depth chart yet: drag to a spot, or click ✓ to keep here"` : ""
        }>
          <span class="rank">${i + 1}</span>
          <button type="button" class="pname" data-open="${esc(id)}" data-tip="${esc(id)}">${p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""}${esc(shortName(p.name))}</button>
          ${chipHTML(t, p, s)}
          <span class="tools">${
            todo ? `<button type="button" data-act="place" title="Keep at ${esc(pos)}" aria-label="Keep ${esc(p.name)} at ${esc(pos)}">✓</button>` : ""
          }
            <button type="button" data-act="up" title="Move up" aria-label="Move ${esc(p.name)} up">▲</button>
            <button type="button" data-act="down" title="Move down" aria-label="Move ${esc(p.name)} down">▼</button>
          </span>
        </li>`;
      })
      .join("");
    const style = at ? ` style="--x:${at.x}%;--y:${at.y}%"` : "";
    return `<section class="slot${at ? " on-field" : ""}" data-pos="${esc(pos)}"${style}>
      <header><b>${esc(pos)}</b><span>${esc(M.posName(t, pos))}</span></header>
      <ol class="dlist" data-pos="${esc(pos)}">${rows || `<li class="open-slot">Open — drag a player here</li>`}</ol>
      ${
        more > 0 || open
          ? `<button type="button" class="more" data-expand="${esc(key)}">${open ? "Show fewer" : `+${more} more`}</button>`
          : ""
      }
    </section>`;
  }

  const GROUP_NAMES = { C: "Catchers", IF: "Infield", OF: "Outfield", SP: "Starters", RP: "Relievers", G: "Guards", F: "Forwards" };

  /**
   * Players in sections and sub-sections: [[section title or null, [[sub title, players]]]].
   * Baseball: position players (catchers, infield, outfield) and pitchers (starters, relievers).
   * Basketball: guards, forwards and centers (the roster list counts centers as forwards).
   */
  function groupsFor(t, players, { centersAsForwards = false } = {}) {
    const by = (g) => players.filter((p) => M.groupOf(t, p) === g);
    const subs = (keys) => keys.map((k) => [t.sport === "basketball" && k === "C" ? "Centers" : GROUP_NAMES[k], by(k)]);
    if (t.sport === "baseball") {
      return [
        ["Position players", subs(["C", "IF", "OF"])],
        ["Pitchers", subs(["SP", "RP"])],
      ];
    }
    if (centersAsForwards) {
      return [
        ["Guards", [[null, by("G")]]],
        ["Forwards", [[null, players.filter((p) => M.groupOf(t, p) !== "G")]]],
      ];
    }
    return [[null, subs(["G", "F", "C"])]];
  }

  const ROSTER_LABEL = { "26": "26", "40": "40", IL: "IL", P: "Prospect" };

  function rosterRow(t, s, p, depth, unplaced, hurt) {
    const slots = M.slotsOf(depth, p.id);
    const injured = hurt.has(p.id);
    const tag = t.sport === "baseball" && p.roster === "40" ? `<em class="lvl">40</em>` : "";
    return `<li class="rp${unplaced.has(p.id) ? " unplaced" : ""}${injured ? " injured" : ""}" draggable="true" data-id="${esc(p.id)}">
      <button type="button" class="pname" data-open="${esc(p.id)}" data-tip="${esc(p.id)}">${
        p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""
      }${esc(p.name)}</button>${tag}
      <span class="where">${
        injured ? `<em class="il-tag">IL</em>` : slots.length ? slots.map((x) => `${x.pos}${x.rank}`).join(" ") : "—"
      }</span>
    </li>`;
  }

  function renderRoster(t) {
    const s = season(t);
    const st = stateOf(t);
    const players = M.onTeamFor(t, st, s, view(t));
    const { depth, unplaced } = M.layoutFor(t, st, s, view(t));
    const hurt = M.injuredIds(t, st, s);
    const sections = groupsFor(t, players, { centersAsForwards: t.sport === "basketball" })
      .map(([title, subs]) => {
        const count = subs.reduce((n, [, list]) => n + list.length, 0);
        if (!count) return "";
        return `<h4>${esc(title)} <span>${count}</span></h4>${subs
          .filter(([, list]) => list.length)
          .map(
            ([sub, list]) =>
              `<div class="sub">${sub ? `<span class="sub-label">${esc(sub)}</span>` : ""}<ul>${list
                .map((p) => rosterRow(t, s, p, depth, unplaced, hurt))
                .join("")}</ul></div>`
          )
          .join("")}`;
      })
      .join("");
    // Prospects aren't on the 40-man, so they're listed apart and stay off the field.
    const prospects =
      t.sport === "baseball" ? M.allPlayers(t, st).filter((p) => M.level(p) === "P" && M.isOnTeam(t, p, s)) : [];
    $("#roster").innerHTML =
      `<h3>Roster <span>${esc(M.seasonLabel(t, s))}</span></h3><p class="hint">Everyone starts at their primary position. Drag a player to another spot on the ${
        t.sport === "baseball" ? "field" : "court"
      } to move them. Outlined players aren't on the depth chart yet.</p>` +
      sections +
      (prospects.length
        ? `<h4>Prospects <span>${prospects.length}</span></h4><div class="sub"><ul>${prospects
            .map(
              (p) => `<li class="rp prospect-row"><button type="button" class="pname" data-open="${esc(p.id)}" data-tip="${esc(p.id)}">${
                p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""
              }${esc(p.name)}</button><span class="where">${esc(p.pos[0])}</span></li>`
            )
            .join("")}</ul></div>`
        : "");
  }

  function renderTable(t) {
    const s = season(t);
    const st = stateOf(t);
    const baseball = t.sport === "baseball";
    const only = !!ui.tableOnly[t.id];
    const seasons = M.visibleSeasons(t, st);
    const hiddenSeasons = t.seasons.filter((y) => !seasons.includes(y));
    // Every roster level shows here (so a status can be changed); players set by hand stay even if blanked.
    const players = M.allPlayers(t, st).filter((p) => {
      if (only) return M.isOnTeam(t, p, s);
      if (M.hiddenWithSeasons(t, st, p)) return false;
      return seasons.some((y) => M.isOnTeam(t, p, y)) || Object.keys(p.seasons || {}).length > 0;
    });
    const cols = seasons.length + (baseball ? 5 : 4);
    const head = seasons
      .map(
        (y) =>
          `<th class="${y === s ? "cur" : ""}" scope="col"><span class="yr-head"><button type="button" class="yr" data-tyear="${y}" aria-pressed="${
            only && y === s
          }" title="Show only players on the team in ${esc(M.seasonLabel(t, y))}">${esc(M.seasonLabel(t, y))}</button>${
            seasons.length > 1
              ? `<button type="button" class="yr-hide" data-hide="${y}" title="Hide ${esc(M.seasonLabel(t, y))} and players whose last season it was" aria-label="Hide ${esc(
                  M.seasonLabel(t, y)
                )}">✕</button>`
              : ""
          }</span></th>`
      )
      .join("");
    const cell = (p, y) => {
      const x = M.statusFor(t, p, y);
      const cls = y === s ? "cur" : "";
      if (!baseball) {
        return `<td class="${cls}">${x ? `<span class="${stClass(x)}" title="${esc(x.label)}">${esc(x.short)}</span>` : ""}</td>`;
      }
      const next = M.STATUS_KINDS[M.nextStatus(t, p, y)];
      return `<td class="${cls}"><button type="button" class="cyc" data-cycle="${esc(p.id)}" data-year="${y}" title="${esc(
        `${M.seasonLabel(t, y)}: ${x ? x.label : "not on the team"}. Click for ${next ? next.label : "not on the team"}.`
      )}">${x ? `<span class="${stClass(x)}">${esc(x.short)}</span>` : `<span class="st-none">·</span>`}</button></td>`;
    };
    const row = (p, lead) => {
      const rs = M.rosterStatus(t, st, p, s);
      return `<tr>${lead}
        <td class="num">${p.num != null && p.num !== "" ? esc(p.num) : ""}</td>
        <th scope="row"><button type="button" class="pname" data-open="${esc(p.id)}" data-tip="${esc(p.id)}">${esc(p.name)}</button>${
          !baseball && rs === "IL" && M.isOnTeam(t, p, s) ? ` <em class="il-tag" title="Injured list in ${esc(M.seasonLabel(t, s))}">IL</em>` : ""
        }</th>
        <td class="pos">${esc(p.pos.join("/"))}</td>
        ${
          baseball
            ? `<td class="rs"><button type="button" class="rs-btn rs-${rs.toLowerCase()}" data-roster="${esc(p.id)}" title="Roster status in ${esc(
                M.seasonLabel(t, s)
              )}. Click to change: 26-man, 40-man, injured list, prospect.">${ROSTER_LABEL[rs]}</button></td>`
            : ""
        }
        ${seasons.map((y) => cell(p, y)).join("")}
      </tr>`;
    };
    const rows = groupsFor(t, players)
      .map(([title, subs]) => {
        const count = subs.reduce((n, [, list]) => n + list.length, 0);
        if (!count) return "";
        const head = title ? `<tr class="grp"><th colspan="${cols}" scope="rowgroup">${esc(title)} <span>${count}</span></th></tr>` : "";
        return (
          head +
          subs
            .filter(([, list]) => list.length)
            .map(([sub, list]) =>
              list
                .map((p, i) =>
                  row(
                    p,
                    i === 0
                      ? `<th class="sub-cell" rowspan="${list.length}" scope="rowgroup"><span>${esc(sub)}</span></th>`
                      : ""
                  ).replace("<tr>", i === 0 ? '<tr class="sub-first">' : "<tr>")
                )
                .join("")
            )
            .join("")
        );
      })
      .join("");
    const legend = baseball
      ? `Click a season to change it: <span class="st st-prearb">Pre-arb</span> → <span class="st st-arb">Arb</span> → <span class="st st-signed">Signed</span> → <span class="st st-option">Option</span> → <span class="st-none">·</span> not on the team. * after an opt-out.`
      : `Class by season, assuming every player stays five years: ${[1, 2, 3, 4, 5]
          .map((y) => `<span class="st st-class cls-${M.CLASS_SHORT[y].toLowerCase()}">${M.CLASS_SHORT[y]}</span>`)
          .join(" ")}`;
    const filterNote = only
      ? `<p class="filter-note">Showing the ${players.length} players on the team in <b>${esc(M.seasonLabel(t, s))}</b>. <button type="button" class="link" data-tall>Show all seasons</button></p>`
      : `<p class="filter-note muted">Click a season heading to see only that season's players; ✕ hides a season.</p>`;
    const hiddenNote = hiddenSeasons.length
      ? `<p class="filter-note">Hidden: ${hiddenSeasons
          .map((y) => `<button type="button" class="chip-btn" data-unhide="${y}" title="Show ${esc(M.seasonLabel(t, y))} again">${esc(M.seasonLabel(t, y))} ✕</button>`)
          .join(" ")}</p>`
      : "";
    const posOpts = M.POSITIONS[t.sport].map((x) => `<option value="${x}">${x}</option>`).join("");
    const extra = !baseball
      ? `<label class="qa-lbl">Class in ${esc(M.seasonLabel(t, s))} <select form="qa" name="year">${[1, 2, 3, 4, 5]
          .map((y) => `<option value="${y}">${M.CLASS_NAMES[y]}</option>`)
          .join("")}</select></label>`
      : `<label class="qa-lbl">Through <select form="qa" name="through">${Array.from({ length: 12 }, (_, i) => s + i)
          .map((y) => `<option value="${y}">${y}</option>`)
          .join("")}</select></label>`;
    const quick = `<tfoot><tr class="qa-row">
        <td></td>
        <td><input form="qa" name="num" inputmode="numeric" maxlength="3" placeholder="#" aria-label="Jersey number"></td>
        <td><input form="qa" name="name" id="qa-name" maxlength="60" placeholder="+ Add a ${baseball ? "player" : "recruit"}…" aria-label="Player name" required autocomplete="off"></td>
        <td><select form="qa" name="pos" aria-label="Position">${posOpts}</select></td>
        ${
          baseball
            ? `<td><select form="qa" name="roster" aria-label="Roster status"><option value="26">26</option><option value="40">40</option><option value="P">Prospect</option></select></td>`
            : ""
        }
        <td colspan="${seasons.length}"><div class="qa-more">${extra}<span class="muted">joins in ${esc(M.seasonLabel(t, s))}</span><button type="submit" form="qa" class="btn primary">Add</button></div></td>
      </tr></tfoot>`;
    $("#table").innerHTML = `<h3>${baseball ? "Contracts &amp; team control" : "Eligibility by season"}</h3>
      <p class="hint">${legend}</p>${filterNote}${hiddenNote}
      <form id="qa" class="qa-form"></form>
      <div class="table-scroll"><table class="grid"><thead><tr><th class="sub-cell"></th><th scope="col" class="num">#</th><th scope="col">Player</th><th scope="col">Pos</th>${
        baseball ? `<th scope="col" class="rs" title="Roster status in ${esc(M.seasonLabel(t, s))}">Status</th>` : ""
      }${head}</tr></thead><tbody>${rows}</tbody>${quick}</table></div>`;
  }

  document.addEventListener("submit", (e) => {
    if (e.target.id !== "qa") return;
    e.preventDefault();
    const t = team();
    const s = season(t);
    const f = new FormData(e.target);
    const name = String(f.get("name") || "").trim();
    if (!name) return;
    const num = String(f.get("num") || "").trim();
    const fields = { name, num: num === "" ? null : num, pos: [f.get("pos")], firstSeason: s };
    if (t.sport === "basketball") fields.year = Number(f.get("year"));
    else {
      const roster = f.get("roster");
      const through = Number(f.get("through"));
      // A prospect is under team control (pre-arb); anyone else gets a signed deal through that season.
      Object.assign(fields, roster === "P" ? { control: through } : { guaranteed: through }, { roster });
    }
    setState(t, M.addPlayer(t, stateOf(t), fields, s).state);
    const input = $("#qa-name");
    if (input) input.focus();
  });

  // ---------- tooltip ----------
  const tip = $("#tip");
  function showTip(el) {
    const t = team();
    const p = playerById(t, el.dataset.tip);
    if (!p) return;
    const lines = M.tooltipFor(t, p, season(t));
    tip.innerHTML = `<b>${esc(p.name)}</b><span class="tip-pos">${esc(p.pos.join(" / "))}</span>${lines
      .map((l, i) => `<div${i === 0 ? ' class="tip-key"' : ""}>${esc(l)}</div>`)
      .join("")}`;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8);
    let top = r.top - th - 8;
    if (top < 8) top = r.bottom + 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  function hideTip() {
    tip.hidden = true;
  }
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el) showTip(el);
    else hideTip();
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el) showTip(el);
    else hideTip();
  });
  document.addEventListener("scroll", hideTip, true);

  // ---------- clicks ----------
  document.addEventListener("click", (e) => {
    const t = team();
    const segBtn = e.target.closest("[data-seg]");
    if (segBtn) {
      const { seg: name, value } = segBtn.dataset;
      if (name === "sport") ui.sport = value;
      if (name === "team") ui.team[ui.sport] = value;
      if (name === "view") ui.view = value;
      if (name === "season") ui.season[t.id] = Number(value);
      hideTip();
      return render();
    }
    const cyc = e.target.closest("[data-cycle]");
    if (cyc) {
      const p = playerById(t, cyc.dataset.cycle);
      const y = Number(cyc.dataset.year);
      if (p) setState(t, M.setSeasonStatus(t, stateOf(t), p.id, y, M.nextStatus(t, p, y)));
      return;
    }
    const rs = e.target.closest("[data-roster]");
    if (rs) return setState(t, M.cycleRoster(t, stateOf(t), season(t), rs.dataset.roster));
    const hide = e.target.closest("[data-hide]");
    if (hide) return setState(t, M.setHidden(t, stateOf(t), Number(hide.dataset.hide), true));
    const unhide = e.target.closest("[data-unhide]");
    if (unhide) return setState(t, M.setHidden(t, stateOf(t), Number(unhide.dataset.unhide), false));
    const bo = e.target.closest("[data-bo]");
    if (bo) {
      const s = season(t);
      const order = M.battingOrder(t, stateOf(t), s, view(t)).map((x) => x.pos);
      const pos = bo.closest(".bo").dataset.bpos;
      const i = order.indexOf(pos);
      const dir = Number(bo.dataset.bo);
      if (i + dir < 0 || i + dir >= order.length) return;
      // Up: before the one above. Down: before the one two below (or to the end).
      const before = dir < 0 ? order[i - 1] : order[i + 2] || null;
      return setState(t, M.moveInOrder(t, stateOf(t), s, pos, before));
    }
    const yr = e.target.closest("[data-tyear]");
    if (yr) {
      const y = Number(yr.dataset.tyear);
      ui.tableOnly[t.id] = !(ui.tableOnly[t.id] && season(t) === y);
      ui.season[t.id] = y;
      return render();
    }
    if (e.target.closest("[data-tall]")) {
      ui.tableOnly[t.id] = false;
      return render();
    }
    if (e.target.closest("[data-lineup]")) {
      ui.lineupHidden = !ui.lineupHidden;
      return render();
    }
    const exp = e.target.closest("[data-expand]");
    if (exp) {
      ui.expanded[exp.dataset.expand] = !ui.expanded[exp.dataset.expand];
      return render();
    }
    const activate = e.target.closest("[data-activate]");
    if (activate) return setState(t, M.setInjured(t, stateOf(t), season(t), activate.dataset.activate, false));
    const act = e.target.closest("[data-act]");
    if (act) {
      const li = act.closest(".dp");
      const { id, pos } = li.dataset;
      const st = stateOf(t);
      const s = season(t);
      if (act.dataset.act === "place") setState(t, M.moveInDepth(t, st, s, { id, to: pos }));
      if (act.dataset.act === "up") setState(t, M.shiftInDepth(t, st, s, view(t), pos, id, -1));
      if (act.dataset.act === "down") setState(t, M.shiftInDepth(t, st, s, view(t), pos, id, +1));
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) return openPlayer(open.dataset.open);
  });

  $("#add-btn").addEventListener("click", () => openForm(null));
  $("#refresh-btn").addEventListener("click", openRefresh);
  $("#save-btn").addEventListener("click", openSave);
  $("#reset-btn").addEventListener("click", () => {
    const t = team();
    if (!confirm(`Undo every change you made to the ${t.name}: moves, additions and edits?\n\nA snapshot is kept under Save / restore.`)) return;
    snapshot(`Before resetting ${t.short}`);
    store.del(`dc.state.${t.id}`);
    store.del(`dc.seed.${t.id}`);
    delete states[t.id];
    render();
  });

  // ---------- drag and drop ----------
  let drag = null;
  // Batting order rows drag among themselves.
  let boDrag = null;
  document.addEventListener("dragstart", (e) => {
    const row = e.target.closest(".bo");
    if (!row) return;
    boDrag = row.dataset.bpos;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", boDrag);
    row.classList.add("dragging");
    hideTip();
  });
  function boTarget(e) {
    const list = e.target.closest(".lineup ol");
    if (!list) return null;
    const rows = [...list.querySelectorAll(".bo")].filter((r) => r.dataset.bpos !== boDrag);
    for (const r of rows) {
      const box = r.getBoundingClientRect();
      // Two columns: compare within the column under the pointer.
      if (e.clientX >= box.left && e.clientX <= box.right && e.clientY < box.top + box.height / 2) return { before: r.dataset.bpos, mark: [r, "ins-before"] };
    }
    const sameCol = rows.filter((r) => {
      const box = r.getBoundingClientRect();
      return e.clientX >= box.left && e.clientX <= box.right;
    });
    const last = sameCol[sameCol.length - 1];
    if (!last) return { before: null, mark: null };
    const order = [...list.querySelectorAll(".bo")].map((r) => r.dataset.bpos).filter((x) => x !== boDrag);
    const next = order[order.indexOf(last.dataset.bpos) + 1] || null;
    return { before: next, mark: [last, "ins-after"] };
  }
  document.addEventListener("dragover", (e) => {
    if (!boDrag) return;
    const tg = boTarget(e);
    if (!tg) return;
    e.preventDefault();
    clearMarks();
    if (tg.mark) tg.mark[0].classList.add(tg.mark[1]);
  });
  document.addEventListener("drop", (e) => {
    if (!boDrag) return;
    const tg = boTarget(e);
    e.preventDefault();
    clearMarks();
    const t = team();
    if (tg) setState(t, M.moveInOrder(t, stateOf(t), season(t), boDrag, tg.before));
    boDrag = null;
  });
  document.addEventListener("dragend", (e) => {
    const row = e.target.closest(".bo");
    if (row) row.classList.remove("dragging");
    boDrag = null;
  });

  document.addEventListener("dragstart", (e) => {
    if (boDrag) return;
    const item = e.target.closest(".dp, .rp, .ilp");
    if (!item) return;
    drag = { id: item.dataset.id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", drag.id);
    item.classList.add("dragging");
    hideTip();
  });
  document.addEventListener("dragend", (e) => {
    const item = e.target.closest(".dp, .rp, .ilp");
    if (item) item.classList.remove("dragging");
    clearMarks();
    drag = null;
  });
  function clearMarks() {
    document.querySelectorAll(".drop-target, .ins-before, .ins-after").forEach((el) => el.classList.remove("drop-target", "ins-before", "ins-after"));
  }
  function dropPoint(e) {
    const slot = e.target.closest(".slot");
    if (!slot) return null;
    const rows = [...slot.querySelectorAll(".dp")].filter((li) => li.dataset.id !== (drag && drag.id));
    let beforeId = null;
    let mark = null;
    for (const li of rows) {
      const r = li.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        beforeId = li.dataset.id;
        mark = [li, "ins-before"];
        break;
      }
    }
    if (!mark && rows.length) mark = [rows[rows.length - 1], "ins-after"];
    return { slot, pos: slot.dataset.pos, beforeId, mark };
  }
  document.addEventListener("dragover", (e) => {
    if (!drag) return;
    const pt = dropPoint(e);
    const il = e.target.closest("#il");
    if (!pt && !il) return;
    e.preventDefault();
    clearMarks();
    if (il) return il.classList.add("drop-target");
    pt.slot.classList.add("drop-target");
    if (pt.mark) pt.mark[0].classList.add(pt.mark[1]);
  });
  document.addEventListener("drop", (e) => {
    if (!drag) return;
    const t = team();
    const pt = dropPoint(e);
    e.preventDefault();
    clearMarks();
    const s = season(t);
    let st = stateOf(t);
    const hurt = M.injuredIds(t, st, s).has(drag.id);
    if (e.target.closest("#il")) {
      if (!hurt) setState(t, M.setInjured(t, st, s, drag.id, true));
    } else if (pt) {
      // Dropping an injured player on a position activates them there.
      if (hurt) st = M.setInjured(t, st, s, drag.id, false);
      setState(t, M.moveInDepth(t, st, s, { id: drag.id, to: pt.pos, beforeId: pt.beforeId }));
    }
    drag = null;
  });


  // ---------- player detail ----------
  const dlg = $("#dlg");
  function openDialog(html) {
    hideTip();
    $("#dlg-body").innerHTML = html;
    if (!dlg.open) dlg.showModal();
  }
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest("[data-close]")) dlg.close();
  });

  function openPlayer(id) {
    const t = team();
    const st = stateOf(t);
    const s = season(t);
    const p = playerById(t, id);
    if (!p) return;
    const depth = M.depthFor(t, st, s, "all");
    const slots = M.slotsOf(depth, id);
    const injured = M.injuredIds(t, st, s).has(id);
    const added = st.added.some((x) => x.id === id);
    const todo = M.unplacedFor(t, st, s, "all").has(id);
    const positions = M.POSITIONS[t.sport];
    const statuses = t.seasons
      .map((y) => {
        const x = M.statusFor(t, p, y);
        return `<li class="${y === s ? "cur" : ""}"><span>${esc(M.seasonLabel(t, y))}</span>${
          x ? `<span class="${stClass(x)}">${esc(x.short)}</span>` : `<span class="gone">—</span>`
        }</li>`;
      })
      .join("");
    openDialog(`
      <header class="dlg-head">
        <div><h2>${p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""}${esc(p.name)}</h2>
        <p>${esc(p.pos.map((x) => M.posName(t, x)).join(" · "))}</p></div>
        <button type="button" class="x" data-close aria-label="Close">✕</button>
      </header>
      <ul class="tip-lines">${M.tooltipFor(t, p, s).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      <ol class="by-season">${statuses}</ol>
      <h3>Depth chart, ${esc(M.seasonLabel(t, s))}</h3>
      ${
        M.isOnTeam(t, p, s)
          ? `<ul class="slots-held">${
              injured
                ? `<li>On the injured list. Moving them to a position activates them.</li>`
                : slots
                    .map((x) => `<li><b>${esc(x.pos)}</b> #${x.rank} on the depth chart${todo ? " (not placed yet)" : ""}</li>`)
                    .join("")
            }</ul>
            <div class="row">
              <label>Move to <select id="add-pos">${positions
                .map((x) => `<option value="${x}"${x === (slots[0] ? slots[0].pos : p.pos[0]) ? " selected" : ""}>${x} — ${esc(M.posName(t, x))}</option>`)
                .join("")}</select></label>
              <label>Place <select id="add-rank"><option value="top">Top (starter)</option><option value="end" selected>Bottom</option></select></label>
              <button type="button" id="do-slot" class="btn">Move</button>
            </div>
            <label class="chk"><input type="checkbox" id="do-il"${injured ? " checked" : ""}> On the injured list in ${esc(M.seasonLabel(t, s))} (doesn't count against the roster)</label>`
          : `<p class="muted">Not on the team in ${esc(M.seasonLabel(t, s))}.</p>`
      }
      ${
        t.sport === "baseball"
          ? `<div class="row"><label>Roster status <select id="lvl">${[
              ["26", "Active (26-man)"],
              ["40", "40-man (optioned / minors)"],
              ["P", "Prospect (not on the 40-man)"],
            ]
              .map(([v, l]) => `<option value="${v}"${M.level(p) === v ? " selected" : ""}>${l}</option>`)
              .join("")}</select></label></div>`
          : ""
      }
      <footer class="dlg-foot">
        <button type="button" class="btn" id="do-edit">Edit details</button>
        <button type="button" class="btn danger" id="do-remove">${added ? "Delete player" : "Remove from team"}</button>
      </footer>`);

    const body = $("#dlg-body");
    const doSlot = $("#do-slot", body);
    if (doSlot)
      doSlot.addEventListener("click", () => {
        const pos = $("#add-pos", body).value;
        const top = $("#add-rank", body).value === "top";
        const raw = M.depthFor(t, stateOf(t), s, "all")[pos].filter((x) => x !== id);
        const st2 = injured ? M.setInjured(t, stateOf(t), s, id, false) : stateOf(t);
        setState(t, M.moveInDepth(t, st2, s, { id, to: pos, beforeId: top ? raw[0] || null : null }));
        openPlayer(id);
      });
    const il = $("#do-il", body);
    if (il)
      il.addEventListener("change", () => {
        setState(t, M.setInjured(t, stateOf(t), s, id, il.checked));
        openPlayer(id);
      });
    const lvl = $("#lvl", body);
    if (lvl)
      lvl.addEventListener("change", () => {
        setState(t, M.editPlayer(t, stateOf(t), id, { roster: lvl.value }));
        openPlayer(id);
      });
    $("#do-edit", body).addEventListener("click", () => openForm(id));
    $("#do-remove", body).addEventListener("click", () => {
      if (!confirm(added ? `Delete ${p.name}?` : `Remove ${p.name} from the team in every season? (Reset changes brings them back.)`)) return;
      setState(t, M.removePlayer(t, stateOf(t), id));
      dlg.close();
    });
  }

  // ---------- add / edit form ----------
  function yearOptions(from, to, current, blank) {
    let html = blank ? `<option value="">${esc(blank)}</option>` : "";
    for (let y = from; y <= to; y++) html += `<option value="${y}"${Number(current) === y ? " selected" : ""}>${y}</option>`;
    return html;
  }

  function openForm(id) {
    const t = team();
    const s = season(t);
    const p = id ? playerById(t, id) : null;
    const positions = M.POSITIONS[t.sport];
    const first = p ? M.firstSeason(t, p) : s;
    const last = t.seasons[t.seasons.length - 1];
    const baseball = t.sport === "baseball";
    const label = (y) => M.seasonLabel(t, y);
    const seasonOpts = (cur, blank) =>
      (blank ? `<option value="">${esc(blank)}</option>` : "") +
      t.seasons.map((y) => `<option value="${y}"${Number(cur) === y ? " selected" : ""}>${esc(label(y))}</option>`).join("");

    openDialog(`
      <header class="dlg-head">
        <div><h2>${p ? `Edit ${esc(p.name)}` : baseball ? "Add a potential signing" : "Add a recruit or transfer"}</h2>
        <p>${p ? "Changes are saved in this browser." : `Joins the team from the season you pick, outlined at their position until you place them on the depth chart.`}</p></div>
        <button type="button" class="x" data-close aria-label="Close">✕</button>
      </header>
      <form id="pform" class="pform">
        <label class="wide">Name <input name="name" required maxlength="60" value="${esc(p ? p.name : "")}" autocomplete="off"></label>
        <label>Number <input name="num" inputmode="numeric" maxlength="3" value="${esc(p && p.num != null ? p.num : "")}"></label>
        <label>Primary position <select name="pos0">${positions
          .map((x) => `<option${p && p.pos[0] === x ? " selected" : ""}>${x}</option>`)
          .join("")}</select></label>
        <fieldset class="wide"><legend>Can also play</legend>${positions
          .map(
            (x) =>
              `<label class="chk"><input type="checkbox" name="alt" value="${x}"${p && p.pos.slice(1).includes(x) ? " checked" : ""}> ${x}</label>`
          )
          .join("")}</fieldset>
        <label>First season with team <select name="firstSeason">${seasonOpts(first)}</select></label>
        ${
          baseball
            ? `<label>Roster status <select name="roster">${[["26", "Active (26-man)"], ["40", "40-man"], ["P", "Prospect"]]
                .map(([v, l]) => `<option value="${v}"${(p ? M.level(p) : "26") === v ? " selected" : ""}>${l}</option>`)
                .join("")}</select></label>
              <label>Guaranteed through <select name="guaranteed">${yearOptions(t.baseSeason, t.baseSeason + 15, p ? p.guaranteed : s, "No guaranteed deal")}</select></label>
              <label>Team control through <select name="control">${yearOptions(t.baseSeason, t.baseSeason + 15, p ? p.control : "", "Same as deal")}</select></label>
              <label>Club option <select name="option">${yearOptions(t.baseSeason, t.baseSeason + 16, p && p.options ? p.options[0] : "", "None")}</select></label>
              <label>Opt-out after <select name="optOut">${yearOptions(t.baseSeason, t.baseSeason + 15, p && p.optOuts ? p.optOuts[0] : "", "None")}</select></label>
              <label>Bats <select name="bats">${["", "R", "L", "S"].map((v) => `<option${p && p.bats === v ? " selected" : ""}>${v}</option>`).join("")}</select></label>
              <label>Throws <select name="throws">${["", "R", "L"].map((v) => `<option${p && p.throws === v ? " selected" : ""}>${v}</option>`).join("")}</select></label>`
            : `<label>Class in first season <select name="year">${[1, 2, 3, 4, 5]
                .map((y) => `<option value="${y}"${(p ? p.year : 1) === y ? " selected" : ""}>${M.CLASS_NAMES[y]}</option>`)
                .join("")}</select></label>
              <label>Height <input name="ht" maxlength="6" placeholder="6-5" value="${esc(p && p.ht ? p.ht : "")}"></label>
              <label class="wide">Coming from <input name="from" maxlength="60" placeholder="High school or previous college" value="${esc(p && p.from ? p.from : "")}"></label>`
        }
        <label>Leaves early after <select name="leavesAfter">${seasonOpts(p ? p.leavesAfter : "", baseball ? "Stays through contract" : "Stays all five years")}</select></label>
        <label class="wide">Note <input name="note" maxlength="120" value="${esc(p && p.note ? p.note : "")}"></label>
        <footer class="dlg-foot wide">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn primary">${p ? "Save" : "Add player"}</button>
        </footer>
      </form>`);

    $("#pform").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const num = String(f.get("num") || "").trim();
      const pos0 = f.get("pos0");
      const fields = {
        name: String(f.get("name")).trim(),
        num: num === "" ? null : num,
        pos: [pos0].concat(f.getAll("alt").filter((x) => x !== pos0)),
        firstSeason: Number(f.get("firstSeason")),
        leavesAfter: f.get("leavesAfter") ? Number(f.get("leavesAfter")) : null,
        note: String(f.get("note") || "").trim() || undefined,
      };
      if (baseball) {
        const g = f.get("guaranteed");
        const c = f.get("control");
        Object.assign(fields, {
          roster: f.get("roster"),
          guaranteed: g ? Number(g) : undefined,
          control: c ? Number(c) : g ? undefined : Number(f.get("firstSeason")),
          options: f.get("option") ? [Number(f.get("option"))] : [],
          optOuts: f.get("optOut") ? [Number(f.get("optOut"))] : [],
          bats: f.get("bats") || undefined,
          throws: f.get("throws") || undefined,
        });
      } else {
        Object.assign(fields, {
          year: Number(f.get("year")),
          ht: String(f.get("ht") || "").trim() || undefined,
          from: String(f.get("from") || "").trim() || undefined,
        });
      }
      if (!fields.name) return;
      if (p) {
        setState(t, M.editPlayer(t, stateOf(t), p.id, fields));
        openPlayer(p.id);
      } else {
        const res = M.addPlayer(t, stateOf(t), fields, Math.max(s, fields.firstSeason));
        if (fields.firstSeason > s) ui.season[t.id] = fields.firstSeason;
        setState(t, res.state);
        dlg.close();
      }
    });
  }

  // ---------- refresh from the web ----------
  function openRefresh() {
    const t = team();
    const url = CONFIG.refreshUrl;
    openDialog(`
      <header class="dlg-head">
        <div><h2>Refresh roster from the web</h2><p>${esc(t.name)} · currently showing: ${esc(t.asOf)}</p></div>
        <button type="button" class="x" data-close aria-label="Close">✕</button>
      </header>
      ${
        url
          ? `<p>Ask the roster service for the latest ${esc(t.short)} roster, contracts and class years. Your moves and additions are kept.</p>
             <div class="row"><button type="button" class="btn primary" id="do-refresh">Search the web now</button><span id="refresh-msg" class="muted"></span></div>`
          : `<p>Live refresh needs a small roster service: a server-side function that searches the web for the latest roster and returns it as JSON in the same shape as the built-in data. A static page can't do that safely on its own. Set <code>window.DC_CONFIG = { refreshUrl: "…" }</code> in <code>js/config.js</code> to turn this button on.</p>`
      }
      <footer class="dlg-foot"><button type="button" class="btn" data-close>Close</button></footer>`);
    const btn = $("#do-refresh");
    if (btn)
      btn.addEventListener("click", async () => {
        const msg = $("#refresh-msg");
        btn.disabled = true;
        msg.textContent = "Searching…";
        try {
          const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}team=${encodeURIComponent(t.id)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!Array.isArray(data.players)) throw new Error("no players in the response");
          snapshot(`Before refreshing ${t.short} from the web`);
          store.set(`dc.seed.${t.id}`, { players: data.players, depth: data.depth || t.depth, asOf: data.asOf || "Refreshed from the web" });
          msg.textContent = `Updated: ${data.players.length} players.`;
          render();
        } catch (err) {
          msg.textContent = `Couldn't refresh (${err.message}).`;
        } finally {
          btn.disabled = false;
        }
      });
  }

  // ---------- save / restore ----------
  function openSave() {
    const teams = collectEdits();
    const snaps = store.get("dc.snapshots", []);
    const names = (ts) =>
      Object.keys(ts)
        .map((id) => (BUILTIN[id] ? BUILTIN[id].short : id))
        .join(", ");
    const when = (iso) => {
      const d = new Date(iso);
      return isNaN(d) ? iso : d.toLocaleString();
    };
    openDialog(`
      <header class="dlg-head">
        <div><h2>Save / restore your edits</h2><p>Your moves, additions and edits are saved in this browser automatically and stay through updates to the site.</p></div>
        <button type="button" class="x" data-close aria-label="Close">✕</button>
      </header>
      <h3>Backup file</h3>
      <p class="muted">Download a file to keep a copy, or to move your edits to another browser or computer. ${
        Object.keys(teams).length ? `Includes: ${esc(names(teams))}.` : "You haven't made any edits yet."
      }</p>
      <div class="row">
        <button type="button" class="btn primary" id="do-download"${Object.keys(teams).length ? "" : " disabled"}>Download backup</button>
        <label class="btn file-btn">Restore from file…<input type="file" id="do-upload" accept=".json,application/json" hidden></label>
      </div>
      <h3>Automatic snapshots</h3>
      ${
        snaps.length
          ? `<ul class="snaps">${snaps
              .map(
                (x, i) => `<li><div><b>${esc(when(x.at))}</b><span class="muted">${esc(x.reason)} · ${esc(names(x.teams || {}))}</span></div>
                  <button type="button" class="btn" data-snap="${i}">Restore</button></li>`
              )
              .join("")}</ul>`
          : `<p class="muted">None yet. One is taken before each site update, reset, restore or web refresh.</p>`
      }
      <footer class="dlg-foot"><button type="button" class="btn" data-close>Close</button></footer>`);

    const body = $("#dlg-body");
    $("#do-download", body).addEventListener("click", () => {
      const data = { app: "depth-chart", schema: M.SCHEMA, site: SITE_VERSION, savedAt: new Date().toISOString(), teams: collectEdits() };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `depth-chart-edits-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $("#do-upload", body).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || data.app !== "depth-chart" || !data.teams) throw new Error("not a Depth Chart backup");
        if (!confirm(`Replace your edits for ${names(data.teams) || "no teams"} with the backup from ${when(data.savedAt)}?`)) return;
        restoreTeams(data.teams);
        dlg.close();
        render();
      } catch (err) {
        alert(`Couldn't restore that file (${err.message}).`);
      }
    });
    body.querySelectorAll("[data-snap]").forEach((b) =>
      b.addEventListener("click", () => {
        const x = snaps[Number(b.dataset.snap)];
        if (!confirm(`Replace your edits for ${names(x.teams)} with the snapshot from ${when(x.at)}?`)) return;
        restoreTeams(x.teams);
        dlg.close();
        render();
      })
    );
  }

  render();
})();
