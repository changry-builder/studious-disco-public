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

  function emptyState() {
    return { added: [], edits: {}, removed: [], depth: {} };
  }

  function normalizeState(s) {
    const e = emptyState();
    if (!s || typeof s !== "object") return e;
    return {
      added: Array.isArray(s.added) ? s.added : e.added,
      edits: s.edits && typeof s.edits === "object" ? s.edits : e.edits,
      removed: Array.isArray(s.removed) ? s.removed : e.removed,
      depth: s.depth && typeof s.depth === "object" ? s.depth : e.depth,
    };
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
    if (p.prospect) lines.push(team.sport === "basketball" ? "Prospective recruit / transfer" : "Prospective signing");
    if (p.verify) lines.push("Details still to be verified");
    return lines;
  }

  /** Roster filter for baseball: "26" active only, "40" whole 40-man (plus IL). */
  function inRosterView(team, p, view) {
    if (team.sport !== "baseball" || view !== "26") return true;
    return (p.roster || "26") === "26";
  }

  function playersFor(team, state, season, view) {
    return allPlayers(team, state).filter((p) => isOnTeam(team, p, season) && inRosterView(team, p, view));
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

  /** Depth chart as shown: ids filtered to players on the team (and in the roster view) that season. */
  function depthFor(team, state, season, view) {
    const ok = new Set(playersFor(team, state, season, view).map((p) => p.id));
    const raw = rawDepth(team, state, season);
    const d = {};
    for (const pos of Object.keys(raw)) d[pos] = raw[pos].filter((id) => ok.has(id));
    return d;
  }

  /**
   * Move or add a player in a season's depth chart. Returns a new state.
   *   from: position the player is dragged from, or null when added from the roster list
   *   to:   destination position, or null to remove from `from`
   *   beforeId: place ahead of this player in `to`, or null for the end
   */
  function moveInDepth(team, state, season, { id, from, to, beforeId = null }) {
    const d = rawDepth(team, state, season);
    if (from && d[from]) d[from] = d[from].filter((x) => x !== id);
    if (to && d[to]) {
      d[to] = d[to].filter((x) => x !== id);
      const i = beforeId ? d[to].indexOf(beforeId) : -1;
      if (i === -1) d[to].push(id);
      else d[to].splice(i, 0, id);
    }
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
    return moveInDepth(team, state, season, { id, from: pos, to: pos, beforeId });
  }

  function slug(name) {
    return String(name).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
  }

  function addPlayer(team, state, player, season) {
    const taken = new Set(allPlayers(team, state).map((p) => p.id).concat(team.players.map((p) => p.id)));
    let id = "new-" + slug(player.name);
    for (let n = 2; taken.has(id); n++) id = `new-${slug(player.name)}-${n}`;
    const p = Object.assign({ prospect: true }, player, { id });
    let next = Object.assign({}, state, { added: state.added.concat([p]) });
    const pos = (p.pos || [])[0];
    if (pos && POSITIONS[team.sport].includes(pos)) {
      next = moveInDepth(team, next, season, { id, from: null, to: pos });
    }
    return { state: next, id };
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

  function isPitcher(p) {
    return (p.pos || []).some((x) => PITCHER_POS.has(x));
  }

  const Model = {
    CLASS_NAMES, CLASS_SHORT, MAX_COLLEGE_YEARS, POSITIONS, POSITION_NAMES, posName,
    emptyState, normalizeState, seasonLabel, allPlayers, firstSeason, lastSeason, isOnTeam, classYear,
    statusFor, tooltipFor, inRosterView, playersFor, seedDepth, rawDepth, depthFor, moveInDepth,
    shiftInDepth, addPlayer, editPlayer, removePlayer, slotsOf, isPitcher,
  };
  root.DC_Model = Model;
  if (typeof module !== "undefined") module.exports = Model;
})(typeof window !== "undefined" ? window : globalThis);
