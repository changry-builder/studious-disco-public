(function (root) {
  const WTE = (root.WTE = root.WTE || {});
  if (typeof module !== "undefined" && typeof require === "function" && !WTE.Config) require("./config.js");
  const Config = WTE.Config;

  /** In-memory stand-in with the Web Storage surface we use. */
  function memoryBackend() {
    const m = new Map();
    return {
      get length() {
        return m.size;
      },
      key: function (i) {
        return Array.from(m.keys())[i] === undefined ? null : Array.from(m.keys())[i];
      },
      getItem: function (k) {
        return m.has(k) ? m.get(k) : null;
      },
      setItem: function (k, v) {
        m.set(k, String(v));
      },
      removeItem: function (k) {
        m.delete(k);
      },
    };
  }

  function defaultBackend() {
    try {
      const ls = root.localStorage;
      if (ls) {
        const probe = Config.STORAGE_PREFIX + "__probe";
        ls.setItem(probe, "1");
        ls.removeItem(probe);
        return ls;
      }
    } catch (e) {
      /* private mode / blocked */
    }
    return memoryBackend();
  }

  /**
   * Store keys are app-level names ("prefs", "cache:abc"); the backend sees STORAGE_PREFIX + name.
   * keys(prefix) returns app-level names (without STORAGE_PREFIX) that start with `prefix`.
   */
  function create(backend) {
    const be = backend || defaultBackend();
    const P = Config.STORAGE_PREFIX;
    return {
      get: function (key, fallback) {
        try {
          const raw = be.getItem(P + key);
          if (raw === null || raw === undefined) return fallback;
          return JSON.parse(raw);
        } catch (e) {
          return fallback;
        }
      },
      set: function (key, value) {
        try {
          const raw = JSON.stringify(value);
          if (raw === undefined) return false;
          be.setItem(P + key, raw);
          return true;
        } catch (e) {
          return false;
        }
      },
      remove: function (key) {
        try {
          be.removeItem(P + key);
        } catch (e) {
          /* ignore */
        }
      },
      keys: function (prefix) {
        const out = [];
        try {
          const want = P + (prefix || "");
          for (let i = 0; i < be.length; i++) {
            const k = be.key(i);
            if (typeof k === "string" && k.indexOf(want) === 0) out.push(k.slice(P.length));
          }
        } catch (e) {
          /* ignore */
        }
        return out;
      },
    };
  }

  WTE.Storage = { create: create, memoryBackend: memoryBackend };

  if (typeof module !== "undefined") module.exports = WTE.Storage;
})(typeof window !== "undefined" ? window : globalThis);
