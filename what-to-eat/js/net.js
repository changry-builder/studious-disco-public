(function (root) {
  const WTE = (root.WTE = root.WTE || {});
  if (typeof module !== "undefined" && typeof require === "function") {
    if (!WTE.Config) require("./config.js");
    if (!WTE.Cuisines) require("./cuisines.js");
    if (!WTE.Geo) require("./geo.js");
    if (!WTE.SampleData) require("./sample-data.js");
  }

  function abortError() {
    if (typeof DOMException !== "undefined") return new DOMException("Aborted", "AbortError");
    const e = new Error("Aborted");
    e.name = "AbortError";
    return e;
  }

  function coded(code) {
    const e = new Error(code);
    e.code = code;
    return e;
  }

  function isAbort(e) {
    return !!e && e.name === "AbortError";
  }

  /** Short human label from a Nominatim reverse (jsonv2) response, or null. */
  function shortLabel(j) {
    if (!j || typeof j !== "object" || j.error) return null;
    const a = j.address && typeof j.address === "object" ? j.address : {};
    const road = a.road || a.pedestrian || a.footway || a.path || a.neighbourhood || a.suburb || "";
    const street = road && a.house_number ? a.house_number + " " + road : road;
    const place = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb || a.county || "";
    const parts = [];
    [street || j.name, place].forEach(function (p) {
      if (p && typeof p === "string" && parts.indexOf(p) < 0) parts.push(p);
    });
    if (!parts.length && typeof j.display_name === "string") {
      j.display_name
        .split(",")
        .slice(0, 2)
        .forEach(function (p) {
          if (p.trim()) parts.push(p.trim());
        });
    }
    return parts.length ? parts.join(", ") : null;
  }

  function create(deps) {
    const d = deps || {};
    const Geo = WTE.Geo;
    const cfg = d.config || WTE.Config;
    const fetchFn =
      d.fetch ||
      function () {
        return root.fetch.apply(root, arguments);
      };
    const now = d.now || Date.now;
    const sleep =
      d.sleep ||
      function (ms) {
        return new Promise(function (r) {
          setTimeout(r, ms);
        });
      };
    let store = d.store;
    if (!store) {
      const mem = Object.create(null);
      store = {
        get: function (k, fb) {
          return k in mem ? mem[k] : fb;
        },
        set: function (k, v) {
          mem[k] = v;
          return true;
        },
        remove: function (k) {
          delete mem[k];
        },
        keys: function (p) {
          return Object.keys(mem).filter(function (k) {
            return k.indexOf(p || "") === 0;
          });
        },
      };
    }

    let startIdx = 0;
    const inflight = new Map();

    // ---- cache ----------------------------------------------------------

    function cacheKey(cuisineId, center, radiusM) {
      return cuisineId + "|" + center.lat.toFixed(3) + "|" + center.lng.toFixed(3) + "|" + radiusM;
    }

    function cacheGet(key) {
      const e = store.get("cache:" + key, null);
      return e && typeof e.t === "number" && Array.isArray(e.restaurants) ? e : null;
    }

    function touch(key) {
      let idx = store.get("cache:index", []);
      if (!Array.isArray(idx)) idx = [];
      idx = idx.filter(function (k) {
        return k !== key;
      });
      idx.push(key);
      while (idx.length > cfg.CACHE_MAX_ENTRIES) store.remove("cache:" + idx.shift());
      store.set("cache:index", idx);
    }

    function cachePut(key, restaurants) {
      store.set("cache:" + key, { t: now(), restaurants: restaurants });
      touch(key);
    }

    function rebase(list, center, source) {
      return list
        .map(function (r) {
          return Object.assign({}, r, { distanceM: Geo.distanceM(center, r), source: source });
        })
        .sort(function (a, b) {
          return a.distanceM - b.distanceM;
        });
    }

    // ---- one Overpass attempt ------------------------------------------

    function attempt(endpoint, body, callerSignal) {
      return new Promise(function (resolve, reject) {
        const ac = new AbortController();
        let settled = false;
        let timer = null;
        function cleanup() {
          if (timer) clearTimeout(timer);
          if (callerSignal) callerSignal.removeEventListener("abort", onAbort);
        }
        function fail(e) {
          if (settled) return;
          settled = true;
          cleanup();
          reject(e);
        }
        function onAbort() {
          ac.abort();
          fail(abortError());
        }
        if (callerSignal) {
          if (callerSignal.aborted) return fail(abortError());
          callerSignal.addEventListener("abort", onAbort);
        }
        timer = setTimeout(function () {
          ac.abort();
          fail(coded("timeout"));
        }, cfg.CLIENT_TIMEOUT_MS);

        Promise.resolve()
          .then(function () {
            return fetchFn(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: body,
              signal: ac.signal,
            });
          })
          .then(function (res) {
            if (res.status === 429) throw coded("rate-limited");
            if (!res.ok) throw coded(res.status >= 500 ? "server" : "bad-response");
            return Promise.resolve(typeof res.json === "function" ? res.json() : JSON.parse(res.text())).catch(
              function () {
                throw coded("bad-response");
              }
            );
          })
          .then(
            function (json) {
              if (settled) return;
              settled = true;
              cleanup();
              resolve(json);
            },
            function (e) {
              if (isAbort(e)) return fail(e);
              fail(e && e.code ? e : coded("offline"));
            }
          );
      });
    }

    async function run(cuisineId, center, radiusM, key, signal) {
      const query = Geo.buildOverpassQuery(cuisineId, center, radiusM);
      const body = "data=" + encodeURIComponent(query);
      const endpoints = cfg.OVERPASS_ENDPOINTS;
      let lastErr = "offline";
      for (let n = 0; n < endpoints.length; n++) {
        if (signal.aborted) throw abortError();
        const idx = (startIdx + n) % endpoints.length;
        try {
          const json = await attempt(endpoints[idx], body, signal);
          const restaurants = Geo.parseOverpass(json, center, cuisineId);
          startIdx = idx;
          cachePut(key, restaurants);
          return { restaurants: restaurants, source: "live", endpoint: endpoints[idx], error: null, stale: false };
        } catch (e) {
          if (isAbort(e) || signal.aborted) throw abortError();
          let code = e && e.code;
          if (!code) code = e && e.message === "bad-response" ? "bad-response" : "server"; // incl. overpass-runtime
          lastErr = code;
          if (code === "rate-limited") await sleep(2000);
        }
      }
      if (signal.aborted) throw abortError();
      const stale = cacheGet(key);
      if (stale) {
        return {
          restaurants: rebase(stale.restaurants, center, "cache"),
          source: "cache",
          endpoint: null,
          error: lastErr,
          stale: true,
        };
      }
      return {
        restaurants: Geo.sampleRestaurants(cuisineId, center).filter(function (r) {
          return r.distanceM <= radiusM;
        }),
        source: "sample",
        endpoint: null,
        error: lastErr,
        stale: false,
      };
    }

    function findRestaurants(cuisineId, center, radiusM, opts) {
      const signal = opts && opts.signal;
      if (signal && signal.aborted) return Promise.reject(abortError());
      const key = cacheKey(cuisineId, center, radiusM);
      const hit = cacheGet(key);
      if (hit && now() - hit.t < cfg.CACHE_TTL_MS) {
        touch(key);
        return Promise.resolve({
          restaurants: rebase(hit.restaurants, center, "cache"),
          source: "cache",
          endpoint: null,
          error: null,
          stale: false,
        });
      }
      let entry = inflight.get(key);
      if (!entry) {
        const ctrl = new AbortController();
        entry = { refs: 0, ctrl: ctrl, promise: null };
        const mine = entry;
        mine.promise = run(cuisineId, center, radiusM, key, ctrl.signal).then(
          function (v) {
            inflight.delete(key);
            return v;
          },
          function (e) {
            inflight.delete(key);
            throw e;
          }
        );
        inflight.set(key, mine);
      }
      const e = entry;
      e.refs++;
      if (!signal) return e.promise;
      return new Promise(function (resolve, reject) {
        function onAbort() {
          e.refs--;
          if (e.refs <= 0) e.ctrl.abort();
          reject(abortError());
        }
        signal.addEventListener("abort", onAbort, { once: true });
        e.promise.then(
          function (v) {
            signal.removeEventListener("abort", onAbort);
            resolve(v);
          },
          function (err) {
            signal.removeEventListener("abort", onAbort);
            reject(err);
          }
        );
      });
    }

    // ---- Nominatim -------------------------------------------------------

    let nomQueue = Promise.resolve();
    let nomLast = null;
    const geoCache = new Map();
    const revCache = new Map();

    function throttled(fn, signal) {
      const job = nomQueue.then(async function () {
        if (signal && signal.aborted) throw abortError();
        if (nomLast !== null) {
          const wait = nomLast + cfg.NOMINATIM_MIN_INTERVAL_MS - now();
          if (wait > 0) await sleep(wait);
        }
        if (signal && signal.aborted) throw abortError();
        nomLast = now();
        return fn();
      });
      nomQueue = job.then(
        function () {},
        function () {}
      );
      return job;
    }

    async function nominatimGet(url, signal) {
      let res;
      try {
        res = await fetchFn(url, { method: "GET", signal: signal });
      } catch (e) {
        if (isAbort(e) || (signal && signal.aborted)) throw abortError();
        throw new Error("offline");
      }
      if (res.status === 429) throw new Error("rate-limited");
      if (!res.ok) throw new Error("server");
      try {
        return typeof res.json === "function" ? await res.json() : JSON.parse(await res.text());
      } catch (e) {
        throw new Error("server");
      }
    }

    function langParam(lang) {
      return lang ? "&accept-language=" + encodeURIComponent(lang) : "";
    }

    async function geocode(query, opts) {
      const o = opts || {};
      const q = String(query || "").trim();
      if (!q) return [];
      if (o.signal && o.signal.aborted) throw abortError();
      const ck = q.toLowerCase() + "|" + (o.lang || "");
      if (geoCache.has(ck)) return geoCache.get(ck).map(function (p) { return Object.assign({}, p); });
      const url =
        cfg.NOMINATIM_URL + "/search?format=jsonv2&limit=5&q=" + encodeURIComponent(q) + langParam(o.lang);
      const places = await throttled(async function () {
        return Geo.parseNominatim(await nominatimGet(url, o.signal));
      }, o.signal);
      geoCache.set(ck, places);
      return places.map(function (p) {
        return Object.assign({}, p);
      });
    }

    async function reverse(center, opts) {
      const o = opts || {};
      try {
        if (o.signal && o.signal.aborted) return null;
        const ck = center.lat.toFixed(4) + "|" + center.lng.toFixed(4) + "|" + (o.lang || "");
        if (revCache.has(ck)) return revCache.get(ck);
        const url =
          cfg.NOMINATIM_URL +
          "/reverse?format=jsonv2&zoom=17&lat=" +
          encodeURIComponent(center.lat.toFixed(5)) +
          "&lon=" +
          encodeURIComponent(center.lng.toFixed(5)) +
          langParam(o.lang);
        const label = await throttled(async function () {
          return shortLabel(await nominatimGet(url, o.signal));
        }, o.signal);
        if (label) revCache.set(ck, label);
        return label;
      } catch (e) {
        return null;
      }
    }

    function clearCache() {
      let idx = store.get("cache:index", []);
      if (!Array.isArray(idx)) idx = [];
      idx.forEach(function (k) {
        store.remove("cache:" + k);
      });
      store.keys("cache:").forEach(function (k) {
        store.remove(k);
      });
      store.remove("cache:index");
    }

    return {
      findRestaurants: findRestaurants,
      geocode: geocode,
      reverse: reverse,
      clearCache: clearCache,
    };
  }

  WTE.Net = { create: create, shortLabel: shortLabel };

  if (typeof module !== "undefined") module.exports = WTE.Net;
})(typeof window !== "undefined" ? window : globalThis);
