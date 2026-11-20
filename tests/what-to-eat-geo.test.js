const test = require("node:test");
const assert = require("node:assert/strict");
const Config = require("../what-to-eat/js/config.js");
const Cuisines = require("../what-to-eat/js/cuisines.js");
const Geo = require("../what-to-eat/js/geo.js");
const SampleData = require("../what-to-eat/js/sample-data.js");

const C = { lat: 40.7306, lng: -73.9866 };

test("distanceM: NYC-LA and zero", () => {
  const d = Geo.distanceM({ lat: 40.7128, lng: -74.006 }, { lat: 34.0522, lng: -118.2437 });
  assert.ok(Math.abs(d / 1000 - 3936) / 3936 < 0.005, String(d));
  assert.equal(Geo.distanceM(C, C), 0);
  assert.ok(Math.abs(Geo.distanceM(C, { lat: C.lat + 0.001, lng: C.lng }) - 111.2) < 0.5);
});

test("bboxAround is symmetric", () => {
  const [s, w, n, e] = Geo.bboxAround(C, 2000);
  assert.ok(s < C.lat && n > C.lat && w < C.lng && e > C.lng);
  assert.ok(Math.abs(C.lat - s - (n - C.lat)) < 1e-9);
  assert.ok(Math.abs(C.lng - w - (e - C.lng)) < 1e-9);
  assert.ok(Math.abs(Geo.distanceM(C, { lat: n, lng: C.lng }) - 2000) < 5);
});

test("clampLatLng and isLatLng", () => {
  assert.deepEqual(Geo.clampLatLng({ lat: 95, lng: 190 }), { lat: 85, lng: -170 });
  assert.deepEqual(Geo.clampLatLng({ lat: -95, lng: -190 }), { lat: -85, lng: 170 });
  assert.deepEqual(Geo.clampLatLng({ lat: 10, lng: 20 }), { lat: 10, lng: 20 });
  assert.equal(Geo.isLatLng({ lat: 1, lng: 2 }), true);
  assert.equal(Geo.isLatLng({ lat: "1", lng: 2 }), false);
  assert.equal(Geo.isLatLng(null), false);
  assert.equal(Geo.isLatLng({ lat: NaN, lng: 2 }), false);
  assert.equal(Geo.isLatLng({ lat: 100, lng: 2 }), false);
});

test("parseLatLngText variants and rejects", () => {
  assert.deepEqual(Geo.parseLatLngText("40.73, -73.98"), { lat: 40.73, lng: -73.98 });
  assert.deepEqual(Geo.parseLatLngText("40.73 -73.98"), { lat: 40.73, lng: -73.98 });
  assert.deepEqual(Geo.parseLatLngText("40.73° N, 73.98° W"), { lat: 40.73, lng: -73.98 });
  assert.deepEqual(Geo.parseLatLngText("33.9 S 151.2 E"), { lat: -33.9, lng: 151.2 });
  assert.equal(Geo.parseLatLngText("Paris"), null);
  assert.equal(Geo.parseLatLngText("10001"), null);
  assert.equal(Geo.parseLatLngText("95, 10"), null);
  assert.equal(Geo.parseLatLngText("10, 200"), null);
  assert.equal(Geo.parseLatLngText(""), null);
  assert.equal(Geo.parseLatLngText(null), null);
});

test("normalizeCuisineTokens", () => {
  assert.deepEqual(Geo.normalizeCuisineTokens("Pizza; Italian ,burger"), ["pizza", "italian", "burger"]);
  assert.deepEqual(Geo.normalizeCuisineTokens("Dim Sum;dim_sum"), ["dim_sum"]);
  assert.deepEqual(Geo.normalizeCuisineTokens(""), []);
});

test("cuisineIdsForTags", () => {
  assert.deepEqual(Geo.cuisineIdsForTags({ amenity: "restaurant", cuisine: "pizza;italian" }), ["pizza", "italian"]);
  assert.deepEqual(Geo.cuisineIdsForTags({ amenity: "restaurant", cuisine: "sushi" }), ["japanese"]);
  assert.deepEqual(Geo.cuisineIdsForTags({ amenity: "restaurant", cuisine: "asian" }), []);
  assert.deepEqual(Geo.cuisineIdsForTags({ amenity: "cafe" }), ["coffee"]);
  assert.deepEqual(Geo.cuisineIdsForTags({ amenity: "biergarten" }), ["german"]);
  assert.deepEqual(Geo.cuisineIdsForTags({ shop: "bakery" }), ["bakery"]);
  assert.deepEqual(Geo.cuisineIdsForTags({ amenity: "restaurant", "diet:vegan": "only" }), ["veggie"]);
  assert.deepEqual(Geo.cuisineIdsForTags({ amenity: "restaurant", "diet:vegetarian": "only" }), ["veggie"]);
  assert.deepEqual(Geo.cuisineIdsForTags({ amenity: "restaurant", "diet:vegan": "yes" }), []);
  // LIST order: pizza before veggie
  assert.deepEqual(Geo.cuisineIdsForTags({ cuisine: "vegan;pizza" }), ["pizza", "veggie"]);
});

test("buildOverpassQuery shape", () => {
  const q = Geo.buildOverpassQuery("thai", C, 2000);
  assert.ok(q.startsWith("[out:json][timeout:25];"));
  assert.ok(q.includes("around:2000,40.73060,-73.98660"));
  assert.ok(q.includes("out center tags 150;"));
  assert.ok(q.includes(Config.FOOD_AMENITIES.join("|")));
  assert.ok(q.includes('["cuisine"~"(^|;) *(thai) *(;|$)",i]'));
  assert.ok(/^\(/m.test(q) && /^\);/m.test(q));
});

test("buildOverpassQuery: every token, escaping, extras, veggie", () => {
  const q = Geo.buildOverpassQuery("mexican", C, 1234.6);
  assert.ok(q.includes("around:1235,"));
  for (const t of Cuisines.byId("mexican").osmCuisine) {
    assert.ok(q.includes(t.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")), t);
  }
  assert.ok(q.includes("tex\\-mex"));
  const dess = Geo.buildOverpassQuery("dessert", C, 2000);
  assert.ok(dess.includes('nwr["amenity"="ice_cream"](around:2000,40.73060,-73.98660);'));
  assert.ok(dess.includes('nwr["shop"="confectionery"](around:2000,40.73060,-73.98660);'));
  const ger = Geo.buildOverpassQuery("german", C, 2000);
  assert.ok(ger.includes('nwr["amenity"="biergarten"]'));
  const v = Geo.buildOverpassQuery("veggie", C, 2000);
  assert.ok(v.includes('["diet:vegan"="only"](around:2000'));
  assert.ok(v.includes('["diet:vegetarian"="only"](around:2000'));
  assert.throws(() => Geo.buildOverpassQuery("nope", C, 2000), /unknown cuisine/);
});

const FIXTURE = {
  elements: [
    { type: "node", id: 1, lat: 40.7316, lon: -73.9866, tags: { name: "Far Thai", amenity: "restaurant", cuisine: "thai", "addr:housenumber": "12", "addr:street": "Main St", "addr:city": "Springfield", phone: "+1 555 0100; +1 555 0101", website: "example.org/far", opening_hours: "Mo-Su 10:00-22:00", "diet:vegetarian": "yes", "diet:vegan": "limited", "diet:halal": "only", "diet:kosher": "no", "diet:gluten_free": "yes", wheelchair: "limited", takeaway: "yes", delivery: "no" } },
    { type: "way", id: 2, center: { lat: 40.7308, lon: -73.9866 }, tags: { name: "Way Thai", amenity: "restaurant", cuisine: "thai;pizza", "contact:phone": "123", "contact:website": "javascript:alert(1)" } },
    { type: "node", id: 3, lat: 40.73, lon: -73.98, tags: { amenity: "restaurant", cuisine: "thai" } }, // no name
    { type: "node", id: 4, tags: { name: "No coords", amenity: "restaurant" } },
    { type: "node", id: 1, lat: 40.7316, lon: -73.9866, tags: { name: "Far Thai dupe id", amenity: "restaurant" } },
    { type: "node", id: 5, lat: 40.73081, lon: -73.98661, tags: { name: "way thai", amenity: "restaurant", cuisine: "thai", phone: "1", website: "https://a.example", opening_hours: "24/7" } },
    { type: "node", id: 6, lat: 40.7307, lon: -73.9866, tags: { name: "<img src=x onerror=alert(1)>", amenity: "cafe" } },
  ],
};

test("parseOverpass fixture", () => {
  const out = Geo.parseOverpass(FIXTURE, C, "thai");
  const ids = out.map((r) => r.id);
  // node/3 no name, node/4 no coords dropped, node/1 deduped by id; way/2 vs node/5 same name within 30m
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes("node/3") && !ids.includes("node/4"));
  assert.equal(out.length, 3);
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].distanceM <= out[i].distanceM);
  const dupName = out.filter((r) => r.name.toLowerCase() === "way thai");
  assert.equal(dupName.length, 1);
  assert.equal(dupName[0].id, "node/5"); // more tags kept

  const far = out.find((r) => r.id === "node/1");
  assert.equal(far.name, "Far Thai");
  assert.ok(Math.abs(far.distanceM - Geo.distanceM(C, far)) < 1e-6);
  assert.equal(far.address, "12 Main St, Springfield");
  assert.equal(far.phone, "+1 555 0100");
  assert.equal(far.website, "https://example.org/far");
  assert.equal(far.openingHours, "Mo-Su 10:00-22:00");
  assert.deepEqual(far.diet, { vegetarian: "yes", vegan: "limited", halal: "only", kosher: "no", gluten_free: "yes" });
  assert.equal(far.wheelchair, "limited");
  assert.equal(far.takeaway, true);
  assert.equal(far.delivery, false);
  assert.equal(far.primaryCuisine, "thai");
  assert.deepEqual(far.cuisineIds, ["thai"]);
  assert.equal(far.cuisineLabel, "Thai");
  assert.equal(far.kind, "restaurant");
  assert.equal(far.osmUrl, "https://www.openstreetmap.org/node/1");
  assert.equal(far.source, "live");
  assert.equal(typeof far.lat, "number");
  assert.equal(typeof far.lng, "number");
});

test("parseOverpass: way center, unsafe website, empty fields, xss name verbatim", () => {
  const out = Geo.parseOverpass({ elements: [FIXTURE.elements[1], FIXTURE.elements[6]] }, C, "thai");
  const w = out.find((r) => r.id === "way/2");
  assert.equal(w.website, null);
  assert.equal(w.phone, "123");
  assert.equal(w.address, "");
  assert.equal(w.openingHours, null);
  assert.deepEqual(w.cuisineIds, ["pizza", "thai"]); // LIST order
  assert.equal(w.cuisineLabel, "Thai, Pizza");
  assert.deepEqual(w.diet, { vegetarian: null, vegan: null, halal: null, kosher: null, gluten_free: null });
  assert.equal(w.wheelchair, null);
  assert.equal(w.takeaway, null);
  const x = out.find((r) => r.id === "node/6");
  assert.equal(x.name, "<img src=x onerror=alert(1)>");
  assert.deepEqual(x.cuisineIds, ["coffee"]);
  assert.equal(x.cuisineLabel, "");
});

test("parseOverpass: osmExtra-only hit falls back to queried cuisine", () => {
  const out = Geo.parseOverpass({ elements: [{ type: "node", id: 9, lat: 40.731, lon: -73.9866, tags: { name: "X", amenity: "restaurant" } }] }, C, "bakery");
  assert.deepEqual(out[0].cuisineIds, ["bakery"]);
  assert.equal(out[0].primaryCuisine, "bakery");
});

test("parseOverpass: empty, bad input, runtime error", () => {
  assert.deepEqual(Geo.parseOverpass({ elements: [] }, C, "thai"), []);
  assert.throws(() => Geo.parseOverpass(null, C, "thai"));
  assert.throws(() => Geo.parseOverpass("x", C, "thai"));
  assert.throws(() => Geo.parseOverpass({ elements: [], remark: "runtime error: Query timed out" }, C, "thai"), /overpass-runtime/);
  assert.deepEqual(Geo.parseOverpass({ elements: [], remark: "something harmless" }, C, "thai"), []);
});

test("safeUrl", () => {
  assert.equal(Geo.safeUrl("https://a.example/x"), "https://a.example/x");
  assert.equal(Geo.safeUrl("http://a.example"), "http://a.example");
  assert.equal(Geo.safeUrl("example.org"), "https://example.org");
  assert.equal(Geo.safeUrl("javascript:alert(1)"), null);
  assert.equal(Geo.safeUrl("data:text/html,hi"), null);
  assert.equal(Geo.safeUrl("ftp://a.example"), null);
  assert.equal(Geo.safeUrl("a b.com"), null);
  assert.equal(Geo.safeUrl(""), null);
  assert.equal(Geo.safeUrl(null), null);
});

// ---------- opening hours ----------
// 2024-01-01 is a Monday (local time).
const at = (dow, h, m = 0) => new Date(2024, 0, 1 + ((dow + 6) % 7), h, m); // dow: 0=Sun..6=Sat
const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

test("hours: 24/7", () => {
  assert.equal(Geo.isOpenAt("24/7", at(WED, 3)), true);
  assert.equal(Geo.isOpenAt("24/7", at(SUN, 23, 59)), true);
});

test("hours: Mo-Fr 09:00-17:00", () => {
  const h = "Mo-Fr 09:00-17:00";
  assert.equal(Geo.isOpenAt(h, at(WED, 10)), true);
  assert.equal(Geo.isOpenAt(h, at(WED, 8, 59)), false);
  assert.equal(Geo.isOpenAt(h, at(WED, 17)), false);
  assert.equal(Geo.isOpenAt(h, at(SAT, 10)), false);
});

test("hours: past midnight spill", () => {
  const h = "Mo-Su 18:00-02:00";
  assert.equal(Geo.isOpenAt(h, at(TUE, 1)), true);
  assert.equal(Geo.isOpenAt(h, at(TUE, 2, 30)), false);
  assert.equal(Geo.isOpenAt(h, at(TUE, 19)), true);
  assert.equal(Geo.isOpenAt(h, at(TUE, 12)), false);
  const f = "Fr 20:00-03:00";
  assert.equal(Geo.isOpenAt(f, at(SAT, 1)), true);
  assert.equal(Geo.isOpenAt(f, at(FRI, 1)), false);
  assert.equal(Geo.isOpenAt("Mo 10:00-26:00", at(TUE, 1)), true);
});

test("hours: wrap ranges, lists, multiple spans", () => {
  const wrap = "Fr-Mo 10:00-20:00";
  for (const d of [FRI, SAT, SUN, MON]) assert.equal(Geo.isOpenAt(wrap, at(d, 12)), true, "day " + d);
  for (const d of [TUE, WED, THU]) assert.equal(Geo.isOpenAt(wrap, at(d, 12)), false, "day " + d);
  const l = "Mo,We 11:00-14:00,17:00-22:00";
  assert.equal(Geo.isOpenAt(l, at(MON, 12)), true);
  assert.equal(Geo.isOpenAt(l, at(MON, 15)), false);
  assert.equal(Geo.isOpenAt(l, at(MON, 18)), true);
  assert.equal(Geo.isOpenAt(l, at(TUE, 12)), false);
  assert.equal(Geo.isOpenAt(l, at(WED, 21)), true);
});

test("hours: later rules override; off/closed", () => {
  const h = "Mo-Su 10:00-22:00; Su off";
  assert.equal(Geo.isOpenAt(h, at(SAT, 12)), true);
  assert.equal(Geo.isOpenAt(h, at(SUN, 12)), false);
  assert.equal(Geo.isOpenAt("Mo-Sa 10:00-20:00; We closed", at(WED, 12)), false);
  assert.equal(Geo.isOpenAt("10:00-20:00", at(SUN, 12)), true); // no days = every day
});

test("hours: unsupported syntax is unknown", () => {
  for (const s of ["PH off", "Mo-Su 10:00-22:00; PH off", "sunrise-sunset", '"by appointment"', "", "Mo-Fr 09:00+", "Jan-Mar Mo 10:00-12:00", "Mo[1] 10:00-12:00", "SH off", "week 1-10 Mo 10:00-11:00"]) {
    assert.equal(Geo.parseOpeningHours(s), null, JSON.stringify(s));
    assert.equal(Geo.isOpenAt(s, at(MON, 12)), null, JSON.stringify(s));
  }
  assert.equal(Geo.parseOpeningHours(null), null);
  assert.equal(Geo.isOpenAt(null, at(MON, 12)), null);
});

test("hours: schedule shape and Schedule input", () => {
  const sch = Geo.parseOpeningHours("Mo 09:00-17:00");
  assert.equal(sch.days.length, 7);
  assert.deepEqual(sch.days[0], [[540, 1020]]);
  assert.deepEqual(sch.days[1], []);
  assert.equal(Geo.isOpenAt(sch, at(MON, 10)), true);
  assert.deepEqual(Geo.parseOpeningHours("Mo 18:00-02:00").days[0], [[1080, 1560]]);
});

test("openStatus", () => {
  const r = (oh) => ({ openingHours: oh });
  assert.deepEqual(Geo.openStatus(r("24/7"), at(MON, 3)).label, "Open 24/7");
  assert.equal(Geo.openStatus(r("24/7"), at(MON, 3)).open, true);
  const o = Geo.openStatus(r("Mo-Su 10:00-22:00"), at(MON, 12));
  assert.equal(o.open, true);
  assert.equal(o.label, "Open");
  assert.equal(o.closesAt, "22:00");
  const c = Geo.openStatus(r("Mo-Su 10:00-22:00"), at(MON, 23));
  assert.equal(c.open, false);
  assert.equal(c.label, "Closed");
  const u = Geo.openStatus(r(null), at(MON, 12));
  assert.equal(u.open, null);
  assert.equal(u.label, "Hours unknown");
  assert.equal(Geo.openStatus(r("PH off"), at(MON, 12)).label, "Hours unknown");
});

// ---------- filter / sort ----------
const NODIET = { vegetarian: null, vegan: null, halal: null, kosher: null, gluten_free: null };
function R(name, over) {
  return Object.assign({ id: name, name, distanceM: 100, openingHours: null, diet: NODIET, wheelchair: null }, over);
}
const NOF = { openNow: false, vegetarian: false, vegan: false, halal: false, kosher: false, glutenFree: false, wheelchair: false };

test("filterRestaurants flags", () => {
  const d = (o) => ({ diet: Object.assign({}, NODIET, o) });
  const list = [
    R("a", d({ vegetarian: "yes" })),
    R("b", d({ vegan: "only" })),
    R("c", d({ halal: "limited" })),
    R("d", d({ kosher: "yes" })),
    R("e", d({ gluten_free: "yes" })),
    R("f", { wheelchair: "yes" }),
    R("g", { wheelchair: "limited" }),
    R("h", { wheelchair: "no" }),
    R("i", d({ vegetarian: "no", halal: "no" })),
    R("j", { openingHours: "Mo-Su 10:00-22:00" }),
    R("k", { openingHours: "PH off" }),
    R("l"),
  ];
  const names = (f) => Geo.filterRestaurants(list, Object.assign({}, NOF, f), at(MON, 12)).map((r) => r.name);
  assert.equal(names({}).length, list.length);
  assert.deepEqual(names({ vegetarian: true }), ["a", "b"]);
  assert.deepEqual(names({ vegan: true }), ["b"]);
  assert.deepEqual(names({ halal: true }), ["c"]);
  assert.deepEqual(names({ kosher: true }), ["d"]);
  assert.deepEqual(names({ glutenFree: true }), ["e"]);
  assert.deepEqual(names({ wheelchair: true }), ["f", "g"]);
  assert.deepEqual(names({ openNow: true }), ["j"]);
  assert.deepEqual(names({ vegetarian: true, vegan: true }), ["b"]);
  assert.equal(Geo.filterRestaurants(list, NOF, at(MON, 12)) !== list, true);
});

test("sortRestaurants", () => {
  const list = [R("banana", { distanceM: 5 }), R("Apple", { distanceM: 9 }), R("cherry", { distanceM: 1 }), R("Äpfel", { distanceM: 3 })];
  const copy = list.slice();
  assert.deepEqual(Geo.sortRestaurants(list, "distance").map((r) => r.name), ["cherry", "Äpfel", "banana", "Apple"]);
  const byName = Geo.sortRestaurants(list, "name").map((r) => r.name);
  assert.equal(byName[byName.length - 1], "cherry");
  assert.ok(byName.indexOf("Apple") < byName.indexOf("banana"));
  assert.deepEqual(list, copy);
});

test("unitsFor / formatDistance / nextRadius", () => {
  assert.equal(Geo.unitsFor("en-US"), "mi");
  assert.equal(Geo.unitsFor("en-LR"), "mi");
  assert.equal(Geo.unitsFor("my"), "mi");
  assert.equal(Geo.unitsFor("en-GB"), "km");
  assert.equal(Geo.unitsFor("de-DE"), "km");
  assert.equal(Geo.unitsFor(undefined), "km");
  assert.equal(Geo.formatDistance(347, "km"), "350 m");
  assert.equal(Geo.formatDistance(999, "km"), "1.0 km"); // rounds up across the boundary
  assert.equal(Geo.formatDistance(1000, "km"), "1.0 km");
  assert.equal(Geo.formatDistance(1234, "km"), "1.2 km");
  assert.equal(Geo.formatDistance(150, "mi"), "500 ft");
  assert.equal(Geo.formatDistance(100, "mi"), "350 ft");
  assert.equal(Geo.formatDistance(320, "mi"), "0.2 mi");
  assert.equal(Geo.formatDistance(5000, "mi"), "3.1 mi");
  assert.equal(Geo.nextRadius(500), 1000);
  assert.equal(Geo.nextRadius(2000), 3000);
  assert.equal(Geo.nextRadius(12000), 25000);
  assert.equal(Geo.nextRadius(25000), null);
  assert.equal(Geo.nextRadius(2500), 3000);
});

test("directionsUrl", () => {
  const r = { lat: 40.5, lng: -73.25 };
  assert.equal(Geo.directionsUrl(r, "apple"), "https://maps.apple.com/?daddr=40.5,-73.25");
  assert.equal(Geo.directionsUrl(r, "other"), "https://www.google.com/maps/dir/?api=1&destination=40.5,-73.25");
});

test("parseNominatim fixture", () => {
  const out = Geo.parseNominatim([
    { display_name: "Paris, Île-de-France, France", lat: "48.8566", lon: "2.3522", boundingbox: ["48.81", "48.90", "2.22", "2.47"] },
    { display_name: "No bbox", lat: "1.5", lon: "2.5" },
    { display_name: "bad", lat: "x", lon: "y" },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].label, "Paris, Île-de-France, France");
  assert.equal(out[0].lat, 48.8566);
  assert.equal(out[0].lng, 2.3522);
  assert.deepEqual(out[0].bbox, [48.81, 2.22, 48.9, 2.47]); // [s,w,n,e] from [s,n,w,e]
  assert.equal(out[1].bbox, null);
  assert.deepEqual(Geo.parseNominatim([]), []);
  assert.deepEqual(Geo.parseNominatim(null), []);
});

test("sampleRestaurants: offsets, shape, sorted, source", () => {
  const list = Geo.sampleRestaurants("thai", C);
  const places = SampleData.places.filter((p) => p.cuisine === "thai");
  assert.equal(list.length, places.length);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].distanceM <= list[i].distanceM);
  for (const r of list) {
    const p = places.find((x) => "sample/" + x.key === r.id);
    assert.ok(p, r.id);
    assert.equal(r.source, "sample");
    assert.equal(r.osmUrl, null);
    assert.equal(r.primaryCuisine, "thai");
    assert.ok(r.name.endsWith("(sample)"));
    const east = Geo.distanceM({ lat: r.lat, lng: C.lng }, { lat: r.lat, lng: r.lng });
    const north = Geo.distanceM({ lat: C.lat, lng: C.lng }, { lat: r.lat, lng: C.lng });
    assert.ok(Math.abs(Math.sign(r.lng - C.lng) * east - p.dx) < 1.5, `dx ${r.id}`);
    assert.ok(Math.abs(Math.sign(r.lat - C.lat) * north - p.dy) < 1.5, `dy ${r.id}`);
    assert.ok(Math.abs(r.distanceM - Math.hypot(p.dx, p.dy)) < 3);
  }
  // works far from the equator and in the southern hemisphere
  const syd = Geo.sampleRestaurants("pizza", { lat: -33.87, lng: 151.21 });
  assert.ok(syd.length >= 3);
  assert.ok(syd.every((r) => r.distanceM < 4000));
});
