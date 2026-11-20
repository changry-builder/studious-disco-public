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
  const SCHEMA = 2;
  const MIGRATIONS = {
    // 0 -> 1: the first release saved the same fields without a version number.
    0: (s) => s,
    // 1 -> 2: injured lists by season ({ season: [id] }). Older edits had none.
    1: (s) => Object.assign({ il: {} }, s),
  };

  function emptyState() {
    return { v: SCHEMA, added: [], edits: {}, removed: [], depth: {}, il: {} };
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

  /** Last season the player belongs to the team, or Infinity. */
  function lastSeason(team, p) {
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

  function isOnTeam(team, p, season) {
    return season >= firstSeason(team, p) && season <= lastSeason(team, p);
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
    if (p.guaranteed && season <= p.guaranteed) {
      const optOut = (p.optOuts || []).some((y) => y < season);
      return { kind: "signed", short: optOut ? "Signed*" : "Signed", label: optOut ? "Signed (after an opt-out year)" : "Signed" };
    }
    if ((p.options || []).includes(season)) return { kind: "option", short: "Option", label: "Club option" };
    // Team control past the deal: the last three seasons are arbitration years.
    if (p.control && season <= p.control) {
      return season > p.control - 3
        ? { kind: "arb", short: "Arb", label: "Arbitration-eligible" }
        : { kind: "prearb", short: "Pre-arb", label: "Pre-arbitration" };
    }
    return { kind: "signed", short: "Signed", label: "Signed" };
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
      if ((p.options || []).length) lines.push(`Club option: ${p.options.join(", ")}`);
      if ((p.optOuts || []).length) lines.push(`Can opt out after ${p.optOuts.join(", ")}`);
      const hand = [p.bats && `Bats ${p.bats}`, p.throws && `Throws ${p.throws}`].filter(Boolean).join(" / ");
      if (hand) lines.push(hand);
    }
    if (p.note) lines.push(p.note);
    if (p.verify) lines.push("Details still to be verified");
    return lines;
  }

  /** Roster filter for baseball: "26" active roster only, "40" the whole 40-man. */
  function inRosterView(team, p, view) {
    if (team.sport !== "baseball" || view !== "26") return true;
    // "IL" was a roster level before injuries were tracked by season; those players belong to the 26.
    return (p.roster || "26") !== "40";
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

  /** The stored depth for a season, else the nearest earlier stored season, else the seed. Unfiltered. */
  function rawDepth(team, state, season) {
    const stored = Object.keys(state.depth).map(Number).filter((y) => y <= season).sort((a, b) => b - a);
    const src = stored.length ? state.depth[stored[0]] : seedDepth(team);
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

  function isPitcher(p) {
    return (p.pos || []).some((x) => PITCHER_POS.has(x));
  }

  const Model = {
    CLASS_NAMES, CLASS_SHORT, MAX_COLLEGE_YEARS, POSITIONS, POSITION_NAMES, posName,
    emptyState, normalizeState, seasonLabel, allPlayers, firstSeason, lastSeason, isOnTeam, classYear,
    statusFor, tooltipFor, inRosterView, playersFor, onTeamFor, injuredIds, setInjured, injuredFor, seedDepth,
    rawDepth, placedDepth, layoutFor, depthFor, unplacedFor, moveInDepth,
    shiftInDepth, addPlayer, editPlayer, removePlayer, slotsOf, isPitcher, starters, LINEUP, SCHEMA,
  };
  root.DC_Model = Model;
  if (typeof module !== "undefined") module.exports = Model;
})(typeof window !== "undefined" ? window : globalThis);
