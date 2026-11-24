/* Pure roster logic: who is on the team in a season, what their status is, and depth-chart edits.
 * A "state" holds the user's changes on top of a team's seed data:
 *   { added: [player], edits: { id: {fields} }, removed: [id], depth: { season: { pos: [id] } } }
 */
(function (root) {
  const CLASS_NAMES = ["", "Freshman", "Sophomore", "Junior", "Senior", "Graduate (5th year)"];
  const CLASS_SHORT = ["", "Fr", "So", "Jr", "Sr", "Gr"];
  const MAX_COLLEGE_YEARS = 5;

  const POSITIONS = {
    baseball: ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "SP", "CL", "SU", "RP"],
    basketball: ["PG", "SG", "SF", "PF", "C"],
  };
  const POSITION_NAMES = {
    baseball: {
    C: "Catcher", "1B": "First base", "2B": "Second base", "3B": "Third base", SS: "Shortstop",
    LF: "Left field", CF: "Center field", RF: "Right field", DH: "Designated hitter",
    SP: "Rotation", CL: "Closer", SU: "Setup", RP: "Relief",
    },
    basketball: {
    PG: "Point guard", SG: "Shooting guard", SF: "Small forward", PF: "Power forward", C: "Center",
    },
  };
  const posName = (team, pos) => POSITION_NAMES[team.sport][pos] || pos;
  const PITCHER_POS = new Set(["SP", "CL", "SU", "RP"]);

  /*
   * Saved edits outlive new versions of the site. They are stored as changes on top of the built-in
   * data (keyed by player id), never as a copy of it, so a data update still shows through anything the
   * user didn't touch. Rules for future versions:
   *   - never rename or reuse a player id (tests/depth-chart.test.js pins the current ones);
   *   - when the saved shape has to change, bump SCHEMA and add a step to MIGRATIONS; never drop data.
   */
  const SCHEMA = 3;
  const MIGRATIONS = {
    // 0 -> 1: the first release saved the same fields without a version number.
    0: (s) => s,
    // 1 -> 2: injured lists by season ({ season: [id] }). Older edits had none.
    1: (s) => Object.assign({ il: {} }, s),
    // 2 -> 3: batting orders by season ({ season: [position] }) and hidden seasons ([season]).
    2: (s) => Object.assign({ order: {}, hidden: [] }, s),
  };

  function emptyState() {
    return { v: SCHEMA, added: [], edits: {}, removed: [], depth: {}, il: {}, order: {}, hidden: [] };
  }

  /** Bring saved edits from any earlier version up to date. Unknown fields are kept. */
  function normalizeState(s) {
    const e = emptyState();
    if (!s || typeof s !== "object") return e;
    let cur = Object.assign({}, s);
    for (let v = Number(cur.v) || 0; v < SCHEMA; v++) cur = Object.assign({}, MIGRATIONS[v](cur), { v: v + 1 });
    return Object.assign(cur, {
      v: SCHEMA,
      added: Array.isArray(cur.added) ? cur.added : e.added,
      edits: cur.edits && typeof cur.edits === "object" ? cur.edits : e.edits,
      removed: Array.isArray(cur.removed) ? cur.removed : e.removed,
      depth: cur.depth && typeof cur.depth === "object" ? cur.depth : e.depth,
      il: cur.il && typeof cur.il === "object" ? cur.il : e.il,
      order: cur.order && typeof cur.order === "object" ? cur.order : e.order,
      hidden: Array.isArray(cur.hidden) ? cur.hidden : e.hidden,
    });
  }

  function seasonLabel(team, season) {
    if (team.sport === "basketball") return `${season}-${String(season + 1).slice(2)}`;
    return String(season);
  }

  /** All players for the team with edits applied (any season). */
  function allPlayers(team, state) {
    const removed = new Set(state.removed);
    return team.players
      .concat(state.added)
      .filter((p) => !removed.has(p.id))
      .map((p) => Object.assign({}, p, state.edits[p.id] || {}));
  }

  function firstSeason(team, p) {
    return p.firstSeason != null ? p.firstSeason : team.baseSeason;
  }

  /*
   * Baseball status by season. It comes from the contract fields (guaranteed, control, options), unless the
   * user set a season by hand: `p.seasons = { 2027: "arb" | "prearb" | "signed" | "option" | "none" }`.
   */
  const STATUS_KINDS = {
    prearb: { kind: "prearb", short: "Pre-arb", label: "Pre-arbitration" },
    arb: { kind: "arb", short: "Arb", label: "Arbitration-eligible" },
    signed: { kind: "signed", short: "Signed", label: "Signed" },
    option: { kind: "option", short: "Option", label: "Club option" },
  };
  /** Clicking a season cell steps through these; "none" means not on the team. */
  const STATUS_CYCLE = ["prearb", "arb", "signed", "option", "none"];

  /** Last season from the contract fields alone. */
  function contractLast(team, p) {
    let last;
    if (team.sport === "basketball") {
      last = firstSeason(team, p) + (MAX_COLLEGE_YEARS - (p.year || 1));
    } else {
      const opts = p.options || [];
      last = Math.max(p.guaranteed || 0, p.control || 0, opts.length ? Math.max(...opts) : 0);
      if (!last) last = firstSeason(team, p);
    }
    if (p.leavesAfter != null) last = Math.min(last, p.leavesAfter);
    return last;
  }

  function contractStatus(team, p, season) {
    if (season < firstSeason(team, p) || season > contractLast(team, p)) return null;
    if (p.guaranteed && season <= p.guaranteed) {
      const optOut = (p.optOuts || []).some((y) => y < season);
      return optOut ? { kind: "signed", short: "Signed*", label: "Signed (after an opt-out year)" } : STATUS_KINDS.signed;
    }
    if ((p.options || []).includes(season)) return STATUS_KINDS.option;
    // Team control past the deal: the last three seasons are arbitration years.
    if (p.control && season <= p.control) return season > p.control - 3 ? STATUS_KINDS.arb : STATUS_KINDS.prearb;
    return STATUS_KINDS.signed;
  }

  function baseballStatus(team, p, season) {
    const set = (p.seasons || {})[season];
    if (set) return set === "none" ? null : STATUS_KINDS[set] || null;
    return contractStatus(team, p, season);
  }

  /** Last season the player belongs to the team. */
  function lastSeason(team, p) {
    const last = contractLast(team, p);
    if (team.sport === "basketball") return last;
    const set = Object.keys(p.seasons || {}).map(Number);
    const from = Math.min(firstSeason(team, p), ...set);
    const to = Math.max(last, ...set);
    for (let y = to; y >= from; y--) if (baseballStatus(team, p, y)) return y;
    return last;
  }

  function isOnTeam(team, p, season) {
    if (team.sport === "baseball") return !!baseballStatus(team, p, season);
    return season >= firstSeason(team, p) && season <= lastSeason(team, p);
  }

  /** The next status when a season cell is clicked (baseball). */
  function nextStatus(team, p, season) {
    const cur = baseballStatus(team, p, season);
    const i = STATUS_CYCLE.indexOf(cur ? cur.kind : "none");
    return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
  }

  function setSeasonStatus(team, state, id, season, kind) {
    const p = allPlayers(team, state).find((x) => x.id === id);
    if (!p) return state;
    return editPlayer(team, state, id, { seasons: Object.assign({}, p.seasons || {}, { [season]: kind }) });
  }

  function classYear(team, p, season) {
    return (p.year || 1) + (season - firstSeason(team, p));
  }

  /** Short status for a season: contract kind (baseball) or class (basketball). Null if not on team. */
  function statusFor(team, p, season) {
    if (!isOnTeam(team, p, season)) return null;
    if (team.sport === "basketball") {
      const y = classYear(team, p, season);
      return { kind: "class", short: CLASS_SHORT[y], label: CLASS_NAMES[y], year: y };
    }
    return baseballStatus(team, p, season);
  }

  /** The hover text: free-agency year (baseball) or class status (basketball). */
  function tooltipFor(team, p, season) {
    const lines = [];
    if (team.sport === "basketball") {
      const st = statusFor(team, p, season);
      if (st) lines.push(`${st.label} in ${seasonLabel(team, season)}`);
      const last = lastSeason(team, p);
      lines.push(`Final season: ${seasonLabel(team, last)}`);
      if (p.ht) lines.push(`Height: ${p.ht}`);
      if (p.from) lines.push(`Transfer from ${p.from}`);
    } else {
      const last = lastSeason(team, p);
      lines.push(`Free agent after ${last} (FA ${last + 1})`);
      const st = statusFor(team, p, season);
      if (st) lines.push(`${season}: ${st.label}`);
      const opts = team.seasons.filter((y) => (baseballStatus(team, p, y) || {}).kind === "option");
      if (opts.length) lines.push(`Club option: ${opts.join(", ")}`);
      if ((p.optOuts || []).length) lines.push(`Can opt out after ${p.optOuts.join(", ")}`);
      const hand = [p.bats && `Bats ${p.bats}`, p.throws && `Throws ${p.throws}`].filter(Boolean).join(" / ");
      if (hand) lines.push(hand);
    }
    if (p.note) lines.push(p.note);
    if (p.verify) lines.push("Details still to be verified");
    return lines;
  }

  /**
   * Roster level (baseball): "26" active, "40" on the 40-man but not active, "P" a prospect not yet on the
   * 40-man. ("IL" was a level before injuries were tracked by season; those players belong to the 26.)
   */
  function level(p) {
    return p.roster === "40" || p.roster === "P" ? p.roster : "26";
  }

  /** Roster filter for baseball: "26" the active roster, "40" the whole 40-man, "all" includes prospects. */
  function inRosterView(team, p, view) {
    if (team.sport !== "baseball" || view === "all") return true;
    const lv = level(p);
    if (view === "26") return lv === "26";
    return lv !== "P";
  }

  /**
   * Ids on the injured list in a season. Saved per season; otherwise the data's `il: [seasons]`
   * (and the older `roster: "IL"`, which meant the opening season).
   */
  function injuredIds(team, state, season) {
    const saved = (state.il || {})[season];
    if (Array.isArray(saved)) return new Set(saved);
    return new Set(
      allPlayers(team, state)
        .filter((p) => (p.il || []).includes(season) || (p.roster === "IL" && season === firstSeason(team, p)))
        .map((p) => p.id)
    );
  }

  function setInjured(team, state, season, id, on) {
    const cur = injuredIds(team, state, season);
    if (on) cur.add(id);
    else cur.delete(id);
    return Object.assign({}, state, { il: Object.assign({}, state.il || {}, { [season]: [...cur] }) });
  }

  /** On the team that season, in the roster view, injured or not. */
  function onTeamFor(team, state, season, view) {
    return allPlayers(team, state).filter((p) => isOnTeam(team, p, season) && inRosterView(team, p, view));
  }

  /** Healthy players: the ones who count against the roster limit and appear on the field. */
  function playersFor(team, state, season, view) {
    const hurt = injuredIds(team, state, season);
    return onTeamFor(team, state, season, view).filter((p) => !hurt.has(p.id));
  }

  /** What the roster-status column shows for a season: "26", "40", "IL" or "P". */
  function rosterStatus(team, state, p, season) {
    return injuredIds(team, state, season).has(p.id) ? "IL" : level(p);
  }

  /** Click order for the roster-status column: 26-man, 40-man, injured list, prospect, back to 26-man. */
  function cycleRoster(team, state, season, id) {
    const p = allPlayers(team, state).find((x) => x.id === id);
    if (!p) return state;
    const cur = rosterStatus(team, state, p, season);
    if (cur === "26") return editPlayer(team, state, id, { roster: "40" });
    if (cur === "40") return setInjured(team, state, season, id, true);
    if (cur === "IL") return editPlayer(team, setInjured(team, state, season, id, false), id, { roster: "P" });
    return editPlayer(team, state, id, { roster: "26" });
  }

  /** Players on the injured list that season (any roster level). */
  function injuredFor(team, state, season) {
    const hurt = injuredIds(team, state, season);
    return onTeamFor(team, state, season, "all").filter((p) => hurt.has(p.id));
  }

  function seedDepth(team) {
    const d = {};
    for (const pos of POSITIONS[team.sport]) d[pos] = (team.depth[pos] || []).slice();
    return d;
  }

  /** The value saved for a season, else for the nearest earlier season, else undefined. */
  function carried(map, season) {
    const keys = Object.keys(map || {}).map(Number).filter((y) => y <= season).sort((a, b) => b - a);
    return keys.length ? map[keys[0]] : undefined;
  }

  /** The stored depth for a season, else the nearest earlier stored season, else the seed. Unfiltered. */
  function rawDepth(team, state, season) {
    const src = carried(state.depth, season) || seedDepth(team);
    const d = {};
    for (const pos of POSITIONS[team.sport]) d[pos] = (src[pos] || []).slice();
    return d;
  }

  /**
   * Saved placements for a season, one position per player: a player listed twice keeps their primary
   * position (else their first listing). Includes players hidden from the current view, injured or gone,
   * so they keep their places.
   */
  function placedDepth(team, state, season) {
    const raw = rawDepth(team, state, season);
    const byId = new Map(allPlayers(team, state).map((p) => [p.id, p]));
    const keep = new Map();
    for (const pos of Object.keys(raw)) {
      for (const id of raw[pos]) {
        const p = byId.get(id);
        const primary = p ? p.pos[0] : null;
        if (!keep.has(id) || (pos === primary && keep.get(id) !== primary)) keep.set(id, pos);
      }
    }
    const d = {};
    for (const pos of Object.keys(raw)) d[pos] = raw[pos].filter((id, i, list) => keep.get(id) === pos && list.indexOf(id) === i);
    return d;
  }

  /**
   * Depth chart as shown, plus who still needs placing. Every healthy player on the team that season (and
   * in the roster view) appears once. Players with no saved place (new signings, recruits) go to the bottom
   * of their primary position and are listed in `unplaced` until they're moved or kept there.
   */
  function layoutFor(team, state, season, view) {
    const players = playersFor(team, state, season, view);
    const ok = new Set(players.map((p) => p.id));
    const placed = placedDepth(team, state, season);
    const d = {};
    const seen = new Set();
    for (const pos of Object.keys(placed)) {
      d[pos] = placed[pos].filter((id) => ok.has(id));
      d[pos].forEach((id) => seen.add(id));
    }
    const unplaced = new Set();
    for (const p of players) {
      if (seen.has(p.id)) continue;
      const pos = d[p.pos[0]] ? p.pos[0] : Object.keys(d)[0];
      d[pos].push(p.id);
      unplaced.add(p.id);
    }
    return { depth: d, unplaced };
  }

  function depthFor(team, state, season, view) {
    return layoutFor(team, state, season, view).depth;
  }

  function unplacedFor(team, state, season, view) {
    return layoutFor(team, state, season, view).unplaced;
  }

  /**
   * Move a player in a season's depth chart (which also places them if they weren't). Returns a new state.
   *   to:   destination position (players can't be taken off the field, only moved)
   *   beforeId: place ahead of this player in `to`, or null for the end
   * Everyone else keeps their saved place, including players hidden from the current view.
   */
  function moveInDepth(team, state, season, { id, to, beforeId = null }) {
    if (!to) return state;
    const d = placedDepth(team, state, season);
    if (!d[to]) return state;
    for (const pos of Object.keys(d)) d[pos] = d[pos].filter((x) => x !== id);
    const i = beforeId ? d[to].indexOf(beforeId) : -1;
    if (i === -1) d[to].push(id);
    else d[to].splice(i, 0, id);
    return Object.assign({}, state, { depth: Object.assign({}, state.depth, { [season]: d }) });
  }

  /** Shift a player one place up (-1) or down (+1) among the visible players at a position. */
  function shiftInDepth(team, state, season, view, pos, id, dir) {
    const visible = depthFor(team, state, season, view)[pos] || [];
    const i = visible.indexOf(id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= visible.length) return state;
    // Moving up: insert before the player above. Moving down: insert before the one after the player below.
    const beforeId = dir < 0 ? visible[j] : visible[j + 1] || null;
    return moveInDepth(team, state, season, { id, to: pos, beforeId });
  }

  function slug(name) {
    return String(name).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
  }

  function addPlayer(team, state, player, season) {
    const taken = new Set(allPlayers(team, state).map((p) => p.id).concat(team.players.map((p) => p.id)));
    let id = "new-" + slug(player.name);
    for (let n = 2; taken.has(id); n++) id = `new-${slug(player.name)}-${n}`;
    // Not placed yet: they show at the bottom of their primary position, outlined, until moved or kept.
    const p = Object.assign({}, player, { id });
    return { state: Object.assign({}, state, { added: state.added.concat([p]) }), id };
  }

  function editPlayer(team, state, id, fields) {
    if (state.added.some((p) => p.id === id)) {
      return Object.assign({}, state, { added: state.added.map((p) => (p.id === id ? Object.assign({}, p, fields) : p)) });
    }
    const edits = Object.assign({}, state.edits, { [id]: Object.assign({}, state.edits[id] || {}, fields) });
    return Object.assign({}, state, { edits });
  }

  function removePlayer(team, state, id) {
    if (state.added.some((p) => p.id === id)) {
      return Object.assign({}, state, { added: state.added.filter((p) => p.id !== id) });
    }
    return Object.assign({}, state, { removed: state.removed.concat([id]) });
  }

  /** Positions a player holds in a season's depth chart, with their place (1-based). */
  function slotsOf(depth, id) {
    const out = [];
    for (const pos of Object.keys(depth)) {
      const i = depth[pos].indexOf(id);
      if (i !== -1) out.push({ pos, rank: i + 1 });
    }
    return out;
  }

  /** Positions in the starting lineup: the nine fielders and the day's starting pitcher, or the five on the floor. */
  const LINEUP = {
    baseball: ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "SP"],
    basketball: ["PG", "SG", "SF", "PF", "C"],
  };

  /** The first player at each lineup position. */
  function starters(team, state, season, view) {
    const d = depthFor(team, state, season, view);
    return LINEUP[team.sport].map((pos) => ({ pos, id: (d[pos] || [])[0] || null }));
  }

  /** A batting order: lineup spots 1-9, each the current starter at a position. */
  const BATTING_POS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];

  /** Saved as positions, so a new starter at a position bats in that position's spot. */
  function battingOrder(team, state, season, view) {
    const starter = new Map(starters(team, state, season, view).map((x) => [x.pos, x.id]));
    const saved = carried(state.order, season) || team.lineup || BATTING_POS;
    const order = saved.filter((pos, i) => BATTING_POS.includes(pos) && saved.indexOf(pos) === i);
    for (const pos of BATTING_POS) if (!order.includes(pos)) order.push(pos);
    return order.map((pos, i) => ({ spot: i + 1, pos, id: starter.get(pos) || null }));
  }

  /** Move a position's spot in the order to just before another's (or to the end). */
  function moveInOrder(team, state, season, pos, beforePos) {
    const order = battingOrder(team, state, season, "all").map((x) => x.pos).filter((x) => x !== pos);
    const i = beforePos ? order.indexOf(beforePos) : -1;
    if (i === -1) order.push(pos);
    else order.splice(i, 0, pos);
    return Object.assign({}, state, { order: Object.assign({}, state.order || {}, { [season]: order }) });
  }

  /** Seasons shown, and hiding one. At least one season always stays visible. */
  function visibleSeasons(team, state) {
    const hidden = new Set(state.hidden || []);
    const shown = team.seasons.filter((y) => !hidden.has(y));
    return shown.length ? shown : [team.seasons[team.seasons.length - 1]];
  }

  function setHidden(team, state, season, on) {
    const hidden = new Set(state.hidden || []);
    if (on) hidden.add(season);
    else hidden.delete(season);
    const next = Object.assign({}, state, { hidden: [...hidden].sort() });
    return visibleSeasons(team, next).some((y) => !hidden.has(y)) ? next : state;
  }

  /** Whether a player is hidden along with a season: their last season was hidden, or none they play is shown. */
  function hiddenWithSeasons(team, state, p) {
    const hidden = new Set(state.hidden || []);
    if (!hidden.size) return false;
    if (hidden.has(lastSeason(team, p))) return true;
    return !visibleSeasons(team, state).some((y) => isOnTeam(team, p, y));
  }

  function isPitcher(p) {
    return PITCHER_POS.has((p.pos || [])[0]);
  }

  /**
   * Position group for rosters and tables. Baseball: C, IF, OF, SP, RP (a DH counts at his next position).
   * Basketball: G, F, C.
   */
  function groupOf(team, p) {
    const pos = p.pos || [];
    if (team.sport === "basketball") return (pos[0] || "").endsWith("G") ? "G" : pos[0] === "C" ? "C" : "F";
    if (pos[0] === "SP") return "SP";
    if (isPitcher(p)) return "RP";
    const field = pos[0] === "DH" ? pos.find((x) => x !== "DH") || "1B" : pos[0];
    if (field === "C") return "C";
    if (["LF", "CF", "RF"].includes(field)) return "OF";
    return "IF";
  }

  const Model = {
    CLASS_NAMES, CLASS_SHORT, MAX_COLLEGE_YEARS, POSITIONS, POSITION_NAMES, posName,
    emptyState, normalizeState, seasonLabel, allPlayers, firstSeason, lastSeason, isOnTeam, classYear,
    statusFor, tooltipFor, inRosterView, playersFor, onTeamFor, injuredIds, setInjured, injuredFor, seedDepth,
    rawDepth, placedDepth, layoutFor, depthFor, unplacedFor, moveInDepth,
    shiftInDepth, addPlayer, editPlayer, removePlayer, slotsOf, isPitcher, starters, LINEUP, SCHEMA,
    STATUS_KINDS, STATUS_CYCLE, nextStatus, setSeasonStatus, level, rosterStatus, cycleRoster,
    BATTING_POS, battingOrder, moveInOrder, visibleSeasons, setHidden, hiddenWithSeasons, groupOf,
  };
  root.DC_Model = Model;
  if (typeof module !== "undefined") module.exports = Model;
})(typeof window !== "undefined" ? window : globalThis);
