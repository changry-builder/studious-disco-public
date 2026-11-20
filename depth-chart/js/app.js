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
    return t.seasons.includes(s) ? s : t.baseSeason;
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
    const seasons = t.seasons.map((y) => [String(y), M.seasonLabel(t, y)]);
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
    const limit = t.sport === "baseball" ? ROSTER_LIMIT[ui.view] : ROSTER_LIMIT.basketball;
    const projected = s !== t.baseSeason;
    $("#summary").innerHTML = `
      <h2>${esc(t.name)} <span>${esc(M.seasonLabel(t, s))}</span></h2>
      <p>${
        projected
          ? `Projection: ${t.sport === "baseball" ? "players under contract or team control" : "returning players (five-year rule)"} plus your additions.`
          : esc(t.asOf)
      } <b class="count ${players.length > limit ? "over" : ""}">${players.length} / ${limit}</b></p>`;
  }

  function renderField(t) {
    const s = season(t);
    const v = view(t);
    const layout = FIELDS[t.sport];
    const depth = M.depthFor(t, stateOf(t), s, v);
    const field = $("#field");
    field.className = `field field-${t.sport}`;
    field.style.setProperty("--aspect", layout.aspect);
    const slots = Object.entries(layout.slots)
      .map(([pos, [x, y]]) => slotHTML(t, s, pos, depth[pos], { x, y }))
      .join("");
    field.innerHTML = `<div class="turf">${layout.svg}</div>${t.sport === "basketball" ? lineupHTML(t, s) : ""}<div class="slots">${slots}</div>`;

    const side = $("#side");
    if (layout.side) {
      side.hidden = false;
      side.innerHTML = `<h3>${esc(layout.side.title)}</h3><div class="side-slots">${layout.side.slots
        .map((pos) => slotHTML(t, s, pos, depth[pos], null))
        .join("")}</div>`;
    } else {
      side.hidden = true;
      side.innerHTML = "";
    }
  }

  function lineupHTML(t, s) {
    const st = stateOf(t);
    if (ui.lineupHidden) {
      return `<aside class="lineup collapsed"><button type="button" class="lineup-toggle" data-lineup aria-expanded="false">Starting Lineup ▸</button></aside>`;
    }
    const rows = M.starters(t, st, s, view(t))
      .map(({ pos, id }) => {
        const p = id && playerById(t, id);
        if (!p) return `<li><b>${esc(pos)}</b><span class="muted">Open</span></li>`;
        return `<li><b>${esc(pos)}</b><button type="button" class="pname" data-open="${esc(p.id)}" data-tip="${esc(p.id)}">${
          p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""
        }${esc(p.name)}</button><span class="chip">${esc(chipText(t, p, s))}</span></li>`;
      })
      .join("");
    return `<aside class="lineup" aria-label="Starting lineup">
      <header><h3>Starting Lineup</h3><button type="button" class="lineup-toggle" data-lineup aria-expanded="true" title="Hide">▾</button></header>
      <ol>${rows}</ol>
    </aside>`;
  }

  function slotHTML(t, s, pos, ids, at) {
    const st = stateOf(t);
    const cap = at ? SLOT_CAP[pos] || DEFAULT_CAP : Infinity;
    const key = `${t.id}:${pos}`;
    const open = ui.expanded[key];
    const shown = open ? ids : ids.slice(0, cap);
    const more = ids.length - shown.length;
    const rows = shown
      .map((id, i) => {
        const p = M.allPlayers(t, st).find((x) => x.id === id);
        if (!p) return "";
        return `<li class="dp${p.prospect ? " prospect" : ""}${i === 0 ? " starter" : ""}" draggable="true" data-id="${esc(id)}" data-pos="${esc(pos)}">
          <span class="rank">${i + 1}</span>
          <button type="button" class="pname" data-open="${esc(id)}" data-tip="${esc(id)}">${p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""}${esc(shortName(p.name))}</button>
          <span class="chip">${esc(chipText(t, p, s))}</span>
          <span class="tools">
            <button type="button" data-act="up" title="Move up" aria-label="Move ${esc(p.name)} up">▲</button>
            <button type="button" data-act="down" title="Move down" aria-label="Move ${esc(p.name)} down">▼</button>
            ${
              M.isExclusive(t)
                ? ""
                : `<button type="button" data-act="drop" title="Remove from ${esc(pos)}" aria-label="Remove ${esc(p.name)} from ${esc(pos)}">✕</button>`
            }
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

  function groupsFor(t, players, { centersAsForwards = false } = {}) {
    if (t.sport === "baseball") {
      return [
        ["Position players", players.filter((p) => !M.isPitcher(p))],
        ["Pitchers", players.filter((p) => M.isPitcher(p))],
      ];
    }
    const g = (pre) => players.filter((p) => (p.pos[0] || "").endsWith(pre));
    if (centersAsForwards) {
      return [
        ["Guards", g("G")],
        ["Forwards", players.filter((p) => !(p.pos[0] || "").endsWith("G"))],
      ];
    }
    return [
      ["Guards", g("G")],
      ["Forwards", g("F")],
      ["Centers", players.filter((p) => p.pos[0] === "C")],
    ];
  }

  function renderRoster(t) {
    const s = season(t);
    const st = stateOf(t);
    const players = M.playersFor(t, st, s, view(t));
    const depth = M.depthFor(t, st, s, view(t));
    $("#roster").innerHTML =
      `<h3>Roster <span>${esc(M.seasonLabel(t, s))}</span></h3><p class="hint">${
        t.sport === "baseball"
          ? "Drag onto the field to add to a position. Drag here to take a player off a position."
          : "Everyone plays their primary position. Drag a player to another spot on the court to move them."
      }</p>` +
      groupsFor(t, players, { centersAsForwards: t.sport === "basketball" })
        .filter(([, list]) => list.length)
        .map(
          ([title, list]) => `<h4>${esc(title)} <span>${list.length}</span></h4><ul>${list
            .map((p) => {
              const slots = M.slotsOf(depth, p.id);
              const tag = t.sport === "baseball" && p.roster && p.roster !== "26" ? `<em class="lvl">${p.roster === "IL" ? "IL" : "40"}</em>` : "";
              return `<li class="rp${p.prospect ? " prospect" : ""}${slots.length ? "" : " unassigned"}" draggable="true" data-id="${esc(p.id)}">
                <button type="button" class="pname" data-open="${esc(p.id)}" data-tip="${esc(p.id)}">${
                  p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""
                }${esc(p.name)}</button>${tag}
                <span class="where">${slots.length ? slots.map((x) => `${x.pos}${x.rank}`).join(" ") : "—"}</span>
              </li>`;
            })
            .join("")}</ul>`
        )
        .join("");
  }

  function renderTable(t) {
    const s = season(t);
    const st = stateOf(t);
    const only = !!ui.tableOnly[t.id];
    const players = M.allPlayers(t, st).filter(
      (p) => M.inRosterView(t, p, view(t)) && (only ? M.isOnTeam(t, p, s) : t.seasons.some((y) => M.isOnTeam(t, p, y)))
    );
    const cols = t.seasons.length + 3;
    const head = t.seasons
      .map(
        (y) =>
          `<th class="${y === s ? "cur" : ""}" scope="col"><button type="button" class="yr" data-tyear="${y}" aria-pressed="${only && y === s}" title="Show only players on the team in ${esc(
            M.seasonLabel(t, y)
          )}">${esc(M.seasonLabel(t, y))}</button></th>`
      )
      .join("");
    const rows = groupsFor(t, players)
      .filter(([, list]) => list.length)
      .map(
        ([title, list]) =>
          `<tr class="grp"><th colspan="${cols}" scope="rowgroup">${esc(title)} <span>${list.length}</span></th></tr>` +
          list
            .map(
              (p) => `<tr>
                <td class="num">${p.num != null && p.num !== "" ? esc(p.num) : ""}</td>
                <th scope="row"><button type="button" class="pname" data-open="${esc(p.id)}" data-tip="${esc(p.id)}">${esc(p.name)}</button>${
                  p.prospect ? ` <em class="new">new</em>` : ""
                }</th>
                <td class="pos">${esc(p.pos.join("/"))}</td>
                ${t.seasons
                  .map((y) => {
                    const x = M.statusFor(t, p, y);
                    return `<td class="${y === s ? "cur" : ""}">${x ? `<span class="st st-${x.kind}" title="${esc(x.label)}">${esc(x.short)}</span>` : ""}</td>`;
                  })
                  .join("")}
              </tr>`
            )
            .join("")
      )
      .join("");
    const legend =
      t.sport === "baseball"
        ? `<span class="st st-signed">Signed</span> guaranteed deal · <span class="st st-option">Option</span> club option · <span class="st st-arb">Arb</span> arbitration · <span class="st st-prearb">Pre-arb</span> pre-arbitration · * after an opt-out`
        : `Class by season, assuming every player stays five years.`;
    const filterNote = only
      ? `<p class="filter-note">Showing the ${players.length} players on the team in <b>${esc(M.seasonLabel(t, s))}</b>. <button type="button" class="link" data-tall>Show all seasons</button></p>`
      : `<p class="filter-note muted">Click a season to see only that season's players.</p>`;
    const posOpts = M.POSITIONS[t.sport].map((x) => `<option value="${x}">${x}</option>`).join("");
    const extra =
      t.sport === "basketball"
        ? `<label class="qa-lbl">Class in ${esc(M.seasonLabel(t, s))} <select form="qa" name="year">${[1, 2, 3, 4, 5]
            .map((y) => `<option value="${y}">${M.CLASS_NAMES[y]}</option>`)
            .join("")}</select></label>`
        : `<label class="qa-lbl">Signed through <select form="qa" name="guaranteed">${Array.from({ length: 12 }, (_, i) => s + i)
            .map((y) => `<option value="${y}">${y}</option>`)
            .join("")}</select></label>`;
    const quick = `<tfoot><tr class="qa-row">
        <td><input form="qa" name="num" inputmode="numeric" maxlength="3" placeholder="#" aria-label="Jersey number"></td>
        <td><input form="qa" name="name" id="qa-name" maxlength="60" placeholder="+ Add a ${t.sport === "baseball" ? "signing" : "recruit"}…" aria-label="Player name" required autocomplete="off"></td>
        <td><select form="qa" name="pos" aria-label="Position">${posOpts}</select></td>
        <td colspan="${t.seasons.length}"><div class="qa-more">${extra}<span class="muted">joins in ${esc(M.seasonLabel(t, s))}</span><button type="submit" form="qa" class="btn primary">Add</button></div></td>
      </tr></tfoot>`;
    $("#table").innerHTML = `<h3>${t.sport === "baseball" ? "Contracts &amp; team control" : "Eligibility by season"}</h3>
      <p class="hint">${legend}</p>${filterNote}
      <form id="qa" class="qa-form"></form>
      <div class="table-scroll"><table><thead><tr><th scope="col" class="num">#</th><th scope="col">Player</th><th scope="col">Pos</th>${head}</tr></thead><tbody>${rows}</tbody>${quick}</table></div>`;
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
    else Object.assign(fields, { guaranteed: Number(f.get("guaranteed")), roster: "26" });
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
    const act = e.target.closest("[data-act]");
    if (act) {
      const li = act.closest(".dp");
      const { id, pos } = li.dataset;
      const st = stateOf(t);
      const s = season(t);
      if (act.dataset.act === "up") setState(t, M.shiftInDepth(t, st, s, view(t), pos, id, -1));
      if (act.dataset.act === "down") setState(t, M.shiftInDepth(t, st, s, view(t), pos, id, +1));
      if (act.dataset.act === "drop") setState(t, M.moveInDepth(t, st, s, { id, from: pos, to: null }));
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) return openPlayer(open.dataset.open);
  });

  $("#add-btn").addEventListener("click", () => openForm(null));
  $("#refresh-btn").addEventListener("click", openRefresh);
  $("#reset-btn").addEventListener("click", () => {
    const t = team();
    if (!confirm(`Undo every change you made to the ${t.name}: moves, additions and edits?`)) return;
    store.del(`dc.state.${t.id}`);
    store.del(`dc.seed.${t.id}`);
    delete states[t.id];
    render();
  });

  // ---------- drag and drop ----------
  let drag = null;
  document.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".dp, .rp");
    if (!item) return;
    drag = { id: item.dataset.id, from: item.classList.contains("dp") ? item.dataset.pos : null };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", drag.id);
    item.classList.add("dragging");
    hideTip();
  });
  document.addEventListener("dragend", (e) => {
    const item = e.target.closest(".dp, .rp");
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
    const roster = e.target.closest("#roster");
    if (!pt && !(roster && drag.from && !M.isExclusive(team()))) return;
    e.preventDefault();
    clearMarks();
    if (pt) {
      pt.slot.classList.add("drop-target");
      if (pt.mark) pt.mark[0].classList.add(pt.mark[1]);
    } else roster.classList.add("drop-target");
  });
  document.addEventListener("drop", (e) => {
    if (!drag) return;
    const t = team();
    const pt = dropPoint(e);
    e.preventDefault();
    clearMarks();
    const st = stateOf(t);
    const s = season(t);
    if (pt) setState(t, M.moveInDepth(t, st, s, { id: drag.id, from: drag.from, to: pt.pos, beforeId: pt.beforeId }));
    else if (e.target.closest("#roster") && drag.from && !M.isExclusive(t)) setState(t, M.moveInDepth(t, st, s, { id: drag.id, from: drag.from, to: null }));
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
    const positions = M.POSITIONS[t.sport];
    const statuses = t.seasons
      .map((y) => {
        const x = M.statusFor(t, p, y);
        return `<li class="${y === s ? "cur" : ""}"><span>${esc(M.seasonLabel(t, y))}</span>${
          x ? `<span class="st st-${x.kind}">${esc(x.short)}</span>` : `<span class="gone">—</span>`
        }</li>`;
      })
      .join("");
    openDialog(`
      <header class="dlg-head">
        <div><h2>${p.num != null && p.num !== "" ? `<i>#${esc(p.num)}</i> ` : ""}${esc(p.name)}</h2>
        <p>${esc(p.pos.map((x) => M.posName(t, x)).join(" · "))}${p.prospect ? ` · <em class="new">${t.sport === "baseball" ? "prospective signing" : "prospective recruit"}</em>` : ""}</p></div>
        <button type="button" class="x" data-close aria-label="Close">✕</button>
      </header>
      <ul class="tip-lines">${M.tooltipFor(t, p, s).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      <ol class="by-season">${statuses}</ol>
      <h3>Depth chart, ${esc(M.seasonLabel(t, s))}</h3>
      ${
        M.isOnTeam(t, p, s)
          ? `<ul class="slots-held">${
              slots.length
                ? slots
                    .map(
                      (x) =>
                        `<li><b>${esc(x.pos)}</b> #${x.rank} on the depth chart${
                          M.isExclusive(t) ? "" : ` <button type="button" class="link" data-unslot="${esc(x.pos)}">Remove</button>`
                        }</li>`
                    )
                    .join("")
                : `<li class="muted">Not at any position.</li>`
            }</ul>
            <div class="row">
              <label>${M.isExclusive(t) ? "Move to" : "Add at"} <select id="add-pos">${positions
                .map((x) => `<option value="${x}"${x === (M.isExclusive(t) && slots[0] ? slots[0].pos : p.pos[0]) ? " selected" : ""}>${x} — ${esc(M.posName(t, x))}</option>`)
                .join("")}</select></label>
              <label>Place <select id="add-rank"><option value="top">Top (starter)</option><option value="end" selected>Bottom</option></select></label>
              <button type="button" id="do-slot" class="btn">${M.isExclusive(t) ? "Move" : "Add"}</button>
            </div>`
          : `<p class="muted">Not on the team in ${esc(M.seasonLabel(t, s))}.</p>`
      }
      ${
        t.sport === "baseball"
          ? `<div class="row"><label>Roster status <select id="lvl">${[
              ["26", "Active (26-man)"],
              ["40", "40-man (optioned / minors)"],
              ["IL", "Injured list"],
            ]
              .map(([v, l]) => `<option value="${v}"${(p.roster || "26") === v ? " selected" : ""}>${l}</option>`)
              .join("")}</select></label></div>`
          : ""
      }
      <footer class="dlg-foot">
        <button type="button" class="btn" id="do-edit">Edit details</button>
        <button type="button" class="btn danger" id="do-remove">${p.prospect ? "Delete player" : "Remove from team"}</button>
      </footer>`);

    const body = $("#dlg-body");
    body.querySelectorAll("[data-unslot]").forEach((b) =>
      b.addEventListener("click", () => {
        setState(t, M.moveInDepth(t, stateOf(t), s, { id, from: b.dataset.unslot, to: null }));
        openPlayer(id);
      })
    );
    const doSlot = $("#do-slot", body);
    if (doSlot)
      doSlot.addEventListener("click", () => {
        const pos = $("#add-pos", body).value;
        const top = $("#add-rank", body).value === "top";
        const raw = M.depthFor(t, stateOf(t), s, "all")[pos].filter((x) => x !== id);
        setState(t, M.moveInDepth(t, stateOf(t), s, { id, from: null, to: pos, beforeId: top ? raw[0] || null : null }));
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
      if (!confirm(p.prospect ? `Delete ${p.name}?` : `Remove ${p.name} from the team in every season? (Reset changes brings them back.)`)) return;
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
        <p>${p ? "Changes are saved in this browser." : `Joins the team from the season you pick and appears dashed until you make it official.`}</p></div>
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
            ? `<label>Roster status <select name="roster">${[["26", "Active (26-man)"], ["40", "40-man"], ["IL", "Injured list"]]
                .map(([v, l]) => `<option value="${v}"${(p ? p.roster || "26" : "26") === v ? " selected" : ""}>${l}</option>`)
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
        ${p && p.prospect ? `<label class="chk wide"><input type="checkbox" name="official"> Make official (no longer a prospect)</label>` : ""}
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
      if (f.get("official")) fields.prospect = false;
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
      <h3>Move your changes between browsers</h3>
      <p class="muted">Copy this JSON to keep a backup, or paste JSON here to load it. It holds your moves, additions and edits for ${esc(t.short)}.</p>
      <textarea id="json" rows="7" spellcheck="false">${esc(JSON.stringify(stateOf(t), null, 1))}</textarea>
      <footer class="dlg-foot">
        <button type="button" class="btn" id="do-import">Load pasted JSON</button>
        <button type="button" class="btn" data-close>Close</button>
      </footer>`);
    $("#do-import").addEventListener("click", () => {
      try {
        setState(t, M.normalizeState(JSON.parse($("#json").value)));
        dlg.close();
      } catch (err) {
        alert("That isn't valid JSON.");
      }
    });
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

  render();
})();
