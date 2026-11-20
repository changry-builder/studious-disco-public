const test = require("node:test");
const assert = require("node:assert/strict");
const Config = require("../what-to-eat/js/config.js");
const Geo = require("../what-to-eat/js/geo.js");
const Storage = require("../what-to-eat/js/storage.js");
const Net = require("../what-to-eat/js/net.js");

const C = { lat: 40.7306, lng: -73.9866 };
const EPS = Config.OVERPASS_ENDPOINTS;
const OK_JSON = {
  elements: [
    { type: "node", id: 1, lat: 40.731, lon: -73.9866, tags: { name: "Thai One", amenity: "restaurant", cuisine: "thai" } },
    { type: "node", id: 2, lat: 40.735, lon: -73.9866, tags: { name: "Thai Two", amenity: "restaurant", cuisine: "thai" } },
  ],
};

function res(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body, text: async () => JSON.stringify(body) };
}

function harness(handler, opts = {}) {
  const calls = [];
  const sleeps = [];
  const clock = { t: 1_000_000 };
  const store = opts.store || Storage.create(Storage.memoryBackend());
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length - 1);
  };
  const sleep = async (ms) => {
    sleeps.push(ms);
    clock.t += ms;
  };
  const client = Net.create({ fetch, store, now: () => clock.t, sleep });
  return { client, calls, sleeps, clock, store };
}

const overpassCalls = (h) => h.calls.filter((c) => EPS.includes(c.url));

test("live success from first endpoint, then cached without fetch", async () => {
  const h = harness(() => res(200, OK_JSON));
  const a = await h.client.findRestaurants("thai", C, 2000);
  assert.equal(a.source, "live");
  assert.equal(a.endpoint, EPS[0]);
  assert.equal(a.error, null);
  assert.equal(a.stale, false);
  assert.equal(a.restaurants.length, 2);
  assert.ok(a.restaurants[0].distanceM <= a.restaurants[1].distanceM);
  assert.equal(h.calls.length, 1);
  const b = await h.client.findRestaurants("thai", C, 2000);
  assert.equal(b.source, "cache");
  assert.equal(b.stale, false);
  assert.equal(h.calls.length, 1);
  assert.equal(b.restaurants.length, 2);
  assert.ok(b.restaurants.every((r) => r.source === "cache"));
});

test("cache distances are recomputed for the requested center (same ~100 m cell)", async () => {
  const h = harness(() => res(200, OK_JSON));
  await h.client.findRestaurants("thai", C, 2000);
  const C2 = { lat: C.lat + 0.0002, lng: C.lng }; // same toFixed(3) key
  const b = await h.client.findRestaurants("thai", C2, 2000);
  assert.equal(b.source, "cache");
  assert.equal(h.calls.length, 1);
  for (const r of b.restaurants) assert.ok(Math.abs(r.distanceM - Geo.distanceM(C2, r)) < 1e-6);
});

test("POST body encoding and headers", async () => {
  const h = harness(() => res(200, OK_JSON));
  await h.client.findRestaurants("thai", C, 2000);
  const { url, init } = h.calls[0];
  assert.equal(url, EPS[0]);
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(init.body, "data=" + encodeURIComponent(Geo.buildOverpassQuery("thai", C, 2000)));
  assert.ok(init.signal);
});

test("TTL expiry refetches", async () => {
  const h = harness(() => res(200, OK_JSON));
  await h.client.findRestaurants("thai", C, 2000);
  h.clock.t += Config.CACHE_TTL_MS - 1000;
  assert.equal((await h.client.findRestaurants("thai", C, 2000)).source, "cache");
  assert.equal(h.calls.length, 1);
  h.clock.t += 2000;
  const r = await h.client.findRestaurants("thai", C, 2000);
  assert.equal(r.source, "live");
  assert.equal(h.calls.length, 2);
});

test("429 then OK: uses mirror 2 and sleeps 2000", async () => {
  const h = harness((url) => (url === EPS[0] ? res(429, {}) : res(200, OK_JSON)));
  const r = await h.client.findRestaurants("thai", C, 2000);
  assert.equal(r.source, "live");
  assert.equal(r.endpoint, EPS[1]);
  assert.deepEqual(h.sleeps, [2000]);
  assert.deepEqual(h.calls.map((c) => c.url), [EPS[0], EPS[1]]);
});

test("mirror failover: 504, network error, bad JSON, runtime remark", async () => {
  const h = harness((url) => {
    if (url === EPS[0]) return res(504, {});
    if (url === EPS[1]) throw new TypeError("network down");
    return res(200, OK_JSON);
  });
  const r = await h.client.findRestaurants("thai", C, 2000);
  assert.equal(r.endpoint, EPS[2]);
  assert.equal(r.source, "live");

  const h2 = harness((url) => {
    if (url === EPS[0]) return { status: 200, ok: true, json: async () => { throw new SyntaxError("bad"); } };
    if (url === EPS[1]) return res(200, { elements: [], remark: "runtime error: Query timed out" });
    return res(200, OK_JSON);
  });
  const r2 = await h2.client.findRestaurants("thai", C, 2000);
  assert.equal(r2.endpoint, EPS[2]);
});

test("remembers last successful endpoint", async () => {
  const h = harness((url) => (url === EPS[0] ? res(500, {}) : res(200, OK_JSON)));
  await h.client.findRestaurants("thai", C, 2000);
  h.calls.length = 0;
  await h.client.findRestaurants("pizza", C, 2000);
  assert.equal(h.calls[0].url, EPS[1]);
});

test("all fail: sample fallback with error, never rejects", async () => {
  const cases = [
    [() => { throw new TypeError("offline"); }, "offline"],
    [() => res(500, {}), "server"],
    [() => res(429, {}), "rate-limited"],
    [() => ({ status: 200, ok: true, json: async () => { throw new Error("x"); } }), "bad-response"],
  ];
  for (const [handler, err] of cases) {
    const h = harness(handler);
    const r = await h.client.findRestaurants("thai", C, 2000);
    assert.equal(r.source, "sample");
    assert.equal(r.error, err);
    assert.equal(r.endpoint, null);
    assert.ok(r.restaurants.length >= 1);
    assert.ok(r.restaurants.every((x) => x.distanceM <= 2000 && x.source === "sample"));
    assert.equal(overpassCalls(h).length, EPS.length);
  }
});

test("all fail with 429 sleeps between attempts", async () => {
  const h = harness(() => res(429, {}));
  await h.client.findRestaurants("thai", C, 2000);
  assert.ok(h.sleeps.filter((s) => s === 2000).length >= EPS.length - 1);
});

test("stale cache preferred over sample", async () => {
  let fail = false;
  const h = harness(() => (fail ? res(500, {}) : res(200, OK_JSON)));
  await h.client.findRestaurants("thai", C, 2000);
  fail = true;
  h.clock.t += Config.CACHE_TTL_MS + 1;
  const r = await h.client.findRestaurants("thai", C, 2000);
  assert.equal(r.source, "cache");
  assert.equal(r.stale, true);
  assert.equal(r.error, "server");
  assert.equal(r.restaurants.length, 2);
});

test("empty live result is cached", async () => {
  const h = harness(() => res(200, { elements: [] }));
  const a = await h.client.findRestaurants("thai", C, 2000);
  assert.equal(a.source, "live");
  assert.deepEqual(a.restaurants, []);
  const b = await h.client.findRestaurants("thai", C, 2000);
  assert.equal(b.source, "cache");
  assert.equal(h.calls.length, 1);
});

test("abort rejects with AbortError, no fallback", async () => {
  const h = harness((url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))));
  const ctrl = new AbortController();
  const p = h.client.findRestaurants("thai", C, 2000, { signal: ctrl.signal });
  await new Promise((r) => setImmediate(r));
  ctrl.abort();
  await assert.rejects(p, (e) => e.name === "AbortError");
  assert.equal(overpassCalls(h).length, 1);

  const pre = new AbortController();
  pre.abort();
  await assert.rejects(h.client.findRestaurants("pizza", C, 2000, { signal: pre.signal }), (e) => e.name === "AbortError");
});

test("in-flight dedupe: one fetch for two concurrent calls", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const h = harness(async () => { await gate; return res(200, OK_JSON); });
  const p1 = h.client.findRestaurants("thai", C, 2000);
  const p2 = h.client.findRestaurants("thai", C, 2000);
  await new Promise((r) => setImmediate(r));
  release();
  const [a, b] = await Promise.all([p1, p2]);
  assert.equal(h.calls.length, 1);
  assert.equal(a.restaurants.length, b.restaurants.length);
});

test("different keys are not deduped", async () => {
  const h = harness(() => res(200, OK_JSON));
  await Promise.all([h.client.findRestaurants("thai", C, 2000), h.client.findRestaurants("thai", C, 3000), h.client.findRestaurants("pizza", C, 2000)]);
  assert.equal(h.calls.length, 3);
});

test("LRU trims cache to CACHE_MAX_ENTRIES", async () => {
  const h = harness(() => res(200, OK_JSON));
  const N = Config.CACHE_MAX_ENTRIES + 5;
  for (let i = 0; i < N; i++) await h.client.findRestaurants("thai", { lat: 10 + i * 0.01, lng: 20 }, 2000);
  assert.equal(h.store.keys("cache:").filter((k) => k !== "cache:index").length, Config.CACHE_MAX_ENTRIES);
  assert.equal(h.store.get("cache:index", []).length, Config.CACHE_MAX_ENTRIES);
  // oldest evicted -> refetch; newest still cached
  h.calls.length = 0;
  await h.client.findRestaurants("thai", { lat: 10 + (N - 1) * 0.01, lng: 20 }, 2000);
  assert.equal(h.calls.length, 0);
  await h.client.findRestaurants("thai", { lat: 10, lng: 20 }, 2000);
  assert.equal(h.calls.length, 1);
});

test("clearCache", async () => {
  const h = harness(() => res(200, OK_JSON));
  await h.client.findRestaurants("thai", C, 2000);
  h.client.clearCache();
  assert.deepEqual(h.store.keys("cache:"), []);
  await h.client.findRestaurants("thai", C, 2000);
  assert.equal(h.calls.length, 2);
});

test("client timeout falls through to next endpoint", async () => {
  const cfg = Object.assign({}, Config, { CLIENT_TIMEOUT_MS: 20 });
  const calls = [];
  const client = Net.create({
    fetch: (url, init) => {
      calls.push(url);
      if (url === EPS[0]) return new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))));
      return Promise.resolve(res(200, OK_JSON));
    },
    store: Storage.create(Storage.memoryBackend()),
    now: () => 1,
    sleep: async () => {},
    config: cfg,
  });
  const r = await client.findRestaurants("thai", C, 2000);
  assert.equal(r.source, "live");
  assert.equal(r.endpoint, EPS[1]);
});

// ---------- Nominatim ----------
const PARIS = [{ display_name: "Paris, France", lat: "48.8566", lon: "2.3522", boundingbox: ["48.8", "48.9", "2.2", "2.4"] }];

test("geocode: URL, parsing, cached identical query", async () => {
  const h = harness(() => res(200, PARIS));
  const a = await h.client.geocode("Paris", { lang: "en" });
  assert.equal(a.length, 1);
  assert.equal(a[0].label, "Paris, France");
  const u = h.calls[0].url;
  assert.ok(u.startsWith(Config.NOMINATIM_URL + "/search?"));
  assert.ok(u.includes("format=jsonv2") && u.includes("limit=5") && u.includes("q=Paris") && u.includes("accept-language=en"));
  assert.ok(!h.calls[0].init || !h.calls[0].init.headers);
  await h.client.geocode("Paris", { lang: "en" });
  assert.equal(h.calls.length, 1);
});

test("geocode: URL-encodes query", async () => {
  const h = harness(() => res(200, []));
  await h.client.geocode("a&b c#d");
  assert.ok(h.calls[0].url.includes("q=" + encodeURIComponent("a&b c#d")));
});

test("geocode: throttles >= 1100 ms between calls using sleep", async () => {
  const h = harness(() => res(200, PARIS));
  await h.client.geocode("Paris");
  assert.deepEqual(h.sleeps, []);
  await h.client.geocode("London");
  assert.equal(h.sleeps.length, 1);
  assert.ok(h.sleeps[0] >= 1, "slept " + h.sleeps[0]);
  assert.ok(h.sleeps[0] <= Config.NOMINATIM_MIN_INTERVAL_MS);
  // total spacing between the two fetches in fake time >= min interval
  const h2 = harness(() => res(200, PARIS));
  const stamps = [];
  const orig = h2.client;
  const stampedFetch = async (url) => { stamps.push(h2.clock.t); return res(200, PARIS); };
  const c = Net.create({ fetch: stampedFetch, store: h2.store, now: () => h2.clock.t, sleep: async (ms) => { h2.clock.t += ms; } });
  await Promise.all([c.geocode("A"), c.geocode("B"), c.geocode("C")]);
  assert.equal(stamps.length, 3);
  assert.ok(stamps[1] - stamps[0] >= Config.NOMINATIM_MIN_INTERVAL_MS);
  assert.ok(stamps[2] - stamps[1] >= Config.NOMINATIM_MIN_INTERVAL_MS);
  void orig;
});

test("geocode: errors", async () => {
  await assert.rejects(harness(() => res(429, {})).client.geocode("x"), /rate-limited/);
  await assert.rejects(harness(() => res(500, {})).client.geocode("x"), /server/);
  await assert.rejects(harness(() => { throw new TypeError("net"); }).client.geocode("x"), /offline/);
  assert.deepEqual(await harness(() => res(200, [])).client.geocode("   "), []);
});

test("reverse: URL, label, null on failure", async () => {
  const h = harness(() => res(200, { display_name: "12 Main St, Springfield, USA", address: { house_number: "12", road: "Main St", city: "Springfield" } }));
  const label = await h.client.reverse(C, { lang: "en" });
  assert.equal(label, "12 Main St, Springfield");
  const u = h.calls[0].url;
  assert.ok(u.startsWith(Config.NOMINATIM_URL + "/reverse?"));
  assert.ok(u.includes("format=jsonv2") && u.includes("zoom=17") && u.includes("lat=40.73060") && u.includes("lon=-73.98660"));
  assert.equal(await harness(() => res(500, {})).client.reverse(C), null);
  assert.equal(await harness(() => res(429, {})).client.reverse(C), null);
  assert.equal(await harness(() => { throw new Error("x"); }).client.reverse(C), null);
  assert.equal(await harness(() => res(200, { error: "Unable to geocode" })).client.reverse(C), null);
});

// ---------- Storage ----------
test("Storage with throwing backend never throws", () => {
  const boom = () => { throw new Error("quota"); };
  const be = { get length() { throw new Error("x"); }, key: boom, getItem: boom, setItem: boom, removeItem: boom };
  const s = Storage.create(be);
  assert.equal(s.get("a", "fb"), "fb");
  assert.equal(s.set("a", 1), false);
  assert.doesNotThrow(() => s.remove("a"));
  assert.deepEqual(s.keys("a"), []);
});

test("Storage: namespacing, JSON, keys, corrupt values", () => {
  const be = Storage.memoryBackend();
  const s = Storage.create(be);
  assert.equal(s.set("prefs", { a: 1 }), true);
  assert.deepEqual(s.get("prefs", null), { a: 1 });
  assert.equal(be.getItem(Config.STORAGE_PREFIX + "prefs"), '{"a":1}');
  s.set("cache:x", 1);
  s.set("cache:y", 2);
  assert.deepEqual(s.keys("cache:").sort(), ["cache:x", "cache:y"]);
  s.remove("cache:x");
  assert.deepEqual(s.keys("cache:"), ["cache:y"]);
  assert.equal(s.get("missing", 7), 7);
  be.setItem(Config.STORAGE_PREFIX + "bad", "{not json");
  assert.equal(s.get("bad", "fb"), "fb");
  assert.equal(s.set("u", undefined), false);
});

test("Net works with a throwing store (never throws)", async () => {
  const boom = () => { throw new Error("quota"); };
  const store = Storage.create({ length: 0, key: boom, getItem: boom, setItem: boom, removeItem: boom });
  const client = Net.create({ fetch: async () => res(200, OK_JSON), store, now: () => 1, sleep: async () => {} });
  const r = await client.findRestaurants("thai", C, 2000);
  assert.equal(r.source, "live");
});
