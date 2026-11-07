// Roll Call game rules: answer matching and game state. No DOM, so it runs in the
// browser and under `node --test`.

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RollCall = factory();
})(this, function () {
  // Letters and digits only: "Van Buren", "van-buren" and "VanBuren" all match.
  function normalize(text) {
    return String(text)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  // How many typos a typed answer may have when the player presses Enter.
  function typoAllowance(key) {
    if (key.length >= 8) return 2;
    if (key.length >= 5) return 1;
    return 0;
  }

  // key → Set of answer ids that accept it
  function buildIndex(quiz) {
    const index = new Map();
    for (const [id, answer] of Object.entries(quiz.answers)) {
      for (const spelling of answer.accept) {
        const key = normalize(spelling);
        if (!key) continue;
        if (!index.has(key)) index.set(key, new Set());
        index.get(key).add(id);
      }
    }
    return index;
  }

  function createGame(quiz) {
    const index = buildIndex(quiz);
    const found = new Set();

    function lookup(key, fuzzy) {
      if (index.has(key)) return [...index.get(key)];
      if (!fuzzy) return null;
      const allow = typoAllowance(key);
      if (!allow) return null;
      let best = allow + 1;
      let ids = new Set();
      for (const [candidate, owners] of index) {
        const d = distance(key, candidate, allow);
        if (d < best) { best = d; ids = new Set(owners); }
        else if (d === best && d <= allow) owners.forEach((id) => ids.add(id));
      }
      return best <= allow ? [...ids] : null;
    }

    // Check what the player has typed.
    //   fuzzy: false while typing (exact matches only), true on Enter (typos forgiven).
    // Returns null when there's nothing to report, or one of:
    //   { type: "found", id }        newly named; it's now marked found
    //   { type: "repeat", ids }      matches only answers already named
    //   { type: "ambiguous", ids }   matches several unnamed answers
    //   { type: "miss" }             no match (fuzzy only)
    function guess(text, { fuzzy = false } = {}) {
      const key = normalize(text);
      if (!key) return null;
      const ids = lookup(key, fuzzy);
      if (!ids) return fuzzy ? { type: "miss" } : null;
      const open = ids.filter((id) => !found.has(id));
      if (open.length === 1) {
        found.add(open[0]);
        return { type: "found", id: open[0] };
      }
      if (open.length === 0) return { type: "repeat", ids };
      return { type: "ambiguous", ids: open };
    }

    return {
      quiz,
      guess,
      found,
      total: Object.keys(quiz.answers).length,
      isFound: (id) => found.has(id),
      isComplete: () => found.size === Object.keys(quiz.answers).length,
      missed: () => Object.keys(quiz.answers).filter((id) => !found.has(id)),
    };
  }

  function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  return { normalize, distance, buildIndex, createGame, formatClock };
});
