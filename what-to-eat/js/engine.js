(function (root) {
  const WTE = (root.WTE = root.WTE || {});
  const hasMod = typeof module !== "undefined" && typeof require === "function";
  if (hasMod) {
    if (!WTE.Config) require("./config.js");
    if (!WTE.Rng) require("./rng.js");
    if (!WTE.Cuisines) require("./cuisines.js");
  }
  const Config = WTE.Config;
  const Rng = WTE.Rng;
  const Cuisines = WTE.Cuisines;

  const PHASES = ["pick", "duel", "winner", "results"];
  const ROUND_NAMES = { 1: "Final", 2: "Semifinal", 3: "Quarterfinal", 4: "Round of 16" };

  function initialState() {
    return {
      v: 1,
      phase: "pick",
      marks: {},
      seed: 0,
      contenders: [],
      choices: [],
      winner: null,
      cuisine: null,
      notice: null,
    };
  }

  function validId(id) {
    return Cuisines.byId(id) !== null;
  }

  function validSeed(seed) {
    return typeof seed === "number" && isFinite(seed);
  }

  function contendersFor(marks) {
    const m = marks || {};
    const ids = Cuisines.LIST.map(function (cu) {
      return cu.id;
    });
    const kept = ids.filter(function (id) {
      return m[id] === "keep";
    });
    if (kept.length) return kept;
    return ids.filter(function (id) {
      return m[id] !== "reject";
    });
  }

  function startPreview(state) {
    const n = contendersFor(state.marks).length;
    const count = Math.min(n, Config.MAX_CONTENDERS);
    return {
      count: count,
      label: n === 0 ? "none" : n === 1 ? "single" : "duel",
      willCap: n > Config.MAX_CONTENDERS,
    };
  }

  // ---- Bracket -----------------------------------------------------------

  function bracket(state) {
    const c = state.contenders || [];
    const choices = state.choices || [];
    const n = c.length;
    const R = n <= 1 ? 0 : Math.ceil(Math.log2(n));
    const byes = n <= 1 ? 0 : Math.pow(2, R) - n;
    const base = {
      size: n,
      rounds: R,
      byes: byes,
      duelsPlayed: choices.length,
      duelsTotal: Math.max(0, n - 1),
    };

    const history = [];
    const losersByRound = []; // index = round - 1
    let advancers = c.slice(0, byes);
    let playing = c.slice(byes);
    let idx = 0;
    let found = null;

    if (n <= 1) {
      return Object.assign(base, {
        round: 1,
        roundName: "Final",
        matchIndex: 0,
        matchesInRound: 0,
        current: null,
        done: true,
        winner: n === 1 ? c[0] : null,
        standings: c.slice(),
        history: history,
      });
    }

    for (let round = 1; round <= R && !found; round++) {
      const matches = playing.length / 2;
      const winners = [];
      const losers = [];
      losersByRound[round - 1] = losers;
      for (let m = 0; m < matches; m++) {
        const left = playing[2 * m];
        const right = playing[2 * m + 1];
        if (idx >= choices.length) {
          found = {
            round: round,
            matchIndex: m,
            matchesInRound: matches,
            current: { left: left, right: right },
          };
          break;
        }
        const side = choices[idx++];
        const w = side === "L" ? left : right;
        const l = side === "L" ? right : left;
        history.push({ round: round, left: left, right: right, winner: w });
        winners.push(w);
        losers.push(l);
      }
      if (found) break;
      playing = advancers.concat(winners);
      advancers = [];
    }

    let winner = null;
    let info;
    if (found) {
      info = found;
    } else {
      winner = playing[0];
      info = {
        round: R,
        matchIndex: 0,
        matchesInRound: 1,
        current: null,
      };
    }

    const standings = [];
    const seen = Object.create(null);
    function add(id) {
      if (!seen[id]) {
        seen[id] = true;
        standings.push(id);
      }
    }
    if (winner) add(winner);
    for (let r = losersByRound.length - 1; r >= 0; r--) {
      (losersByRound[r] || []).forEach(add);
    }
    c.forEach(add);

    return Object.assign(base, {
      round: info.round,
      roundName: ROUND_NAMES[R - info.round + 1] || "Round of " + Math.pow(2, R - info.round + 1),
      matchIndex: info.matchIndex,
      matchesInRound: info.matchesInRound,
      current: info.current,
      done: !found,
      winner: winner,
      standings: standings,
      history: history,
    });
  }

  function runnerUps(state, k) {
    const kk = k === undefined ? 3 : k;
    if (!state.contenders || state.contenders.length < 2) return [];
    return bracket(state).standings.slice(1, 1 + kk);
  }

  // ---- Reducer -----------------------------------------------------------

  function withNotice(state, patch, notice) {
    return Object.assign({}, state, patch, { notice: notice === undefined ? null : notice });
  }

  function setMark(state, id, mark) {
    const marks = Object.assign({}, state.marks);
    if (mark === null) delete marks[id];
    else marks[id] = mark;
    return withNotice(state, { marks: marks });
  }

  function undo(state) {
    if (state.phase === "duel") {
      if (state.choices.length === 0) {
        return withNotice(state, { phase: "pick", contenders: [], choices: [], winner: null, cuisine: null });
      }
      return withNotice(state, { choices: state.choices.slice(0, -1) });
    }
    if (state.phase === "winner") {
      if (state.contenders.length >= 2 && state.choices.length > 0) {
        return withNotice(state, {
          phase: "duel",
          choices: state.choices.slice(0, -1),
          winner: null,
          cuisine: null,
        });
      }
      return withNotice(state, {
        phase: "pick",
        contenders: [],
        choices: [],
        winner: null,
        cuisine: null,
      });
    }
    return state;
  }

  function reduce(state, event) {
    if (!state || !event || typeof event.type !== "string") return state;
    const phase = state.phase;
    switch (event.type) {
      case "KEEP":
      case "REJECT":
      case "CLEAR":
      case "TOGGLE": {
        if (phase !== "pick" || !validId(event.id)) return state;
        const cur = state.marks[event.id];
        if (event.type === "KEEP") return setMark(state, event.id, "keep");
        if (event.type === "REJECT") return setMark(state, event.id, "reject");
        if (event.type === "CLEAR") return setMark(state, event.id, null);
        return setMark(state, event.id, cur === undefined ? "keep" : null);
      }
      case "KEEP_ALL": {
        if (phase !== "pick") return state;
        const marks = {};
        Cuisines.LIST.forEach(function (cu) {
          marks[cu.id] = "keep";
        });
        return withNotice(state, { marks: marks });
      }
      case "CLEAR_ALL":
        if (phase !== "pick") return state;
        return withNotice(state, { marks: {} });
      case "START": {
        if (phase !== "pick" || !validSeed(event.seed)) return state;
        const seed = event.seed >>> 0;
        const c = contendersFor(state.marks);
        if (c.length === 0) return withNotice(state, {}, "none-left");
        if (c.length === 1) {
          return withNotice(
            state,
            { phase: "winner", seed: seed, contenders: c, choices: [], winner: c[0], cuisine: null },
            "single"
          );
        }
        let list = Rng.shuffle(c, seed);
        let notice = null;
        if (list.length > Config.MAX_CONTENDERS) {
          list = list.slice(0, Config.MAX_CONTENDERS);
          notice = "capped";
        }
        return withNotice(
          state,
          { phase: "duel", seed: seed, contenders: list, choices: [], winner: null, cuisine: null },
          notice
        );
      }
      case "SURPRISE": {
        if (phase !== "pick" || !validSeed(event.seed)) return state;
        const seed = event.seed >>> 0;
        let pool = Cuisines.LIST.map(function (cu) {
          return cu.id;
        }).filter(function (id) {
          return state.marks[id] !== "reject";
        });
        if (pool.length === 0) pool = Cuisines.ids();
        const w = Rng.pick(pool, seed);
        return withNotice(
          state,
          { phase: "winner", seed: seed, contenders: [w], choices: [], winner: w, cuisine: null },
          "surprise"
        );
      }
      case "CHOOSE": {
        if (phase !== "duel" || (event.side !== "L" && event.side !== "R")) return state;
        if (state.choices.length >= state.contenders.length - 1) return state;
        const next = Object.assign({}, state, { choices: state.choices.concat(event.side), notice: null });
        const b = bracket(next);
        if (b.done) {
          next.phase = "winner";
          next.winner = b.winner;
        }
        return next;
      }
      case "UNDO":
        return phase === "duel" || phase === "winner" ? undo(state) : state;
      case "REMATCH": {
        if ((phase !== "winner" && phase !== "results") || !validSeed(event.seed)) return state;
        const seed = event.seed >>> 0;
        if (state.contenders.length < 2) {
          return withNotice(state, {
            phase: "pick",
            contenders: [],
            choices: [],
            winner: null,
            cuisine: null,
          });
        }
        return withNotice(state, {
          phase: "duel",
          seed: seed,
          contenders: Rng.shuffle(state.contenders, seed),
          choices: [],
          winner: null,
          cuisine: null,
        });
      }
      case "SHOW_RESULTS":
        if (phase !== "winner") return state;
        return withNotice(state, { phase: "results", cuisine: state.winner });
      case "USE_CUISINE":
        if (phase !== "results" || !validId(event.id)) return state;
        return withNotice(state, { cuisine: event.id });
      case "BACK":
        if (phase === "results") return withNotice(state, { phase: "winner", cuisine: null });
        if (phase === "winner" || phase === "duel") return undo(state);
        return state;
      case "RESET":
        return initialState();
      default:
        return state;
    }
  }

  // ---- Hash codec --------------------------------------------------------

  function idsInListOrder(set) {
    return Cuisines.LIST.map(function (cu) {
      return cu.id;
    }).filter(function (id) {
      return set[id];
    });
  }

  function encodeHash(state, extra) {
    const parts = ["v=1", "p=" + state.phase];
    if (state.seed) parts.push("s=" + (state.seed >>> 0).toString(36));
    const keep = {};
    const rej = {};
    Object.keys(state.marks || {}).forEach(function (id) {
      if (state.marks[id] === "keep") keep[id] = true;
      else if (state.marks[id] === "reject") rej[id] = true;
    });
    const k = idsInListOrder(keep);
    const x = idsInListOrder(rej);
    if (k.length) parts.push("k=" + k.join(","));
    if (x.length) parts.push("x=" + x.join(","));
    if (state.contenders && state.contenders.length) parts.push("c=" + state.contenders.join(","));
    if (state.choices && state.choices.length) parts.push("h=" + state.choices.join(""));
    if (state.winner) parts.push("w=" + state.winner);
    if (state.cuisine) parts.push("q=" + state.cuisine);
    if (extra) {
      const at = extra.at;
      if (at && isFinite(at.lat) && isFinite(at.lng)) {
        parts.push("at=" + at.lat.toFixed(5) + "," + at.lng.toFixed(5));
      }
      if (isFinite(extra.r) && extra.r > 0) parts.push("r=" + Math.round(extra.r));
    }
    return parts.join("&");
  }

  function parseIds(str) {
    const out = [];
    if (!str) return out;
    str.split(",").forEach(function (id) {
      if (validId(id) && out.indexOf(id) < 0) out.push(id);
    });
    return out;
  }

  function decodeHash(str) {
    if (typeof str !== "string") return null;
    let s = str.charAt(0) === "#" ? str.slice(1) : str;
    if (!s) return null;
    const params = Object.create(null);
    const pieces = s.split("&");
    for (let i = 0; i < pieces.length; i++) {
      const eq = pieces[i].indexOf("=");
      if (eq <= 0) return null;
      let val = pieces[i].slice(eq + 1);
      try {
        val = decodeURIComponent(val);
      } catch (e) {
        return null;
      }
      params[pieces[i].slice(0, eq)] = val;
    }
    if (params.v !== "1") return null;
    const phase = params.p;
    if (PHASES.indexOf(phase) < 0) return null;

    const state = initialState();
    parseIds(params.k).forEach(function (id) {
      state.marks[id] = "keep";
    });
    parseIds(params.x).forEach(function (id) {
      if (!state.marks[id]) state.marks[id] = "reject";
    });
    if (params.s !== undefined) {
      if (!/^[0-9a-z]{1,7}$/.test(params.s)) return null;
      const sd = parseInt(params.s, 36);
      if (!isFinite(sd) || sd > 4294967295) return null;
      state.seed = sd >>> 0;
    }

    const extra = {};
    if (params.at !== undefined) {
      const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(params.at);
      if (m) {
        const lat = parseFloat(m[1]);
        const lng = parseFloat(m[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) extra.at = { lat: lat, lng: lng };
      }
    }
    if (params.r !== undefined && /^\d{1,6}$/.test(params.r)) {
      const r = parseInt(params.r, 10);
      if (r > 0) extra.r = r;
    }

    if (phase === "pick") return { state: state, extra: extra };

    let contenders = parseIds(params.c).slice(0, Config.MAX_CONTENDERS);
    if (contenders.length === 0 && validId(params.w)) contenders = [params.w];
    if (contenders.length === 0) return null;
    state.contenders = contenders;

    if (contenders.length === 1) {
      state.winner = contenders[0];
      state.phase = phase === "duel" ? "winner" : phase;
    } else {
      const cap = contenders.length - 1;
      const h = (params.h || "").replace(/[^LR]/g, "").slice(0, cap);
      state.choices = h.split("").filter(Boolean);
      const b = bracket(state);
      if (b.done) {
        state.winner = b.winner;
        state.phase = phase === "duel" ? "winner" : phase;
      } else {
        state.phase = "duel";
      }
    }
    if (state.phase === "results") {
      state.cuisine = validId(params.q) ? params.q : state.winner;
    }
    return { state: state, extra: extra };
  }

  WTE.Engine = {
    initialState: initialState,
    reduce: reduce,
    contendersFor: contendersFor,
    startPreview: startPreview,
    bracket: bracket,
    runnerUps: runnerUps,
    encodeHash: encodeHash,
    decodeHash: decodeHash,
  };

  if (typeof module !== "undefined") module.exports = WTE.Engine;
})(typeof window !== "undefined" ? window : globalThis);
