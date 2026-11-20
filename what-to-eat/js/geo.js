(function (root) {
  const WTE = (root.WTE = root.WTE || {});
  const hasMod = typeof module !== "undefined" && typeof require === "function";
  if (hasMod) {
    if (!WTE.Config) require("./config.js");
    if (!WTE.Cuisines) require("./cuisines.js");
  }
  const Config = WTE.Config;
  const Cuisines = WTE.Cuisines;

  const R_EARTH = 6371008.8;
  const RAD = Math.PI / 180;

  // ---- Coordinates -------------------------------------------------------

  function distanceM(a, b) {
    const dLat = (b.lat - a.lat) * RAD;
    const dLng = (b.lng - a.lng) * RAD;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const h = s1 * s1 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * s2 * s2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function bboxAround(center, radiusM) {
    const dLat = (radiusM / R_EARTH) / RAD;
    const cos = Math.max(Math.cos(center.lat * RAD), 1e-6);
    const dLng = (radiusM / (R_EARTH * cos)) / RAD;
    return [center.lat - dLat, center.lng - dLng, center.lat + dLat, center.lng + dLng];
  }

  function clampLatLng(p) {
    const lat = Math.max(-85, Math.min(85, p.lat));
    let lng = p.lng;
    if (lng < -180 || lng > 180) lng = ((((lng + 180) % 360) + 360) % 360) - 180;
    return { lat: lat, lng: lng };
  }

  function isLatLng(p) {
    return (
      !!p &&
      typeof p === "object" &&
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      isFinite(p.lat) &&
      isFinite(p.lng) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180
    );
  }

  const NUM = "(-?\\d+(?:\\.\\d+)?)";
  const LATLNG_RE = new RegExp(
    "^\\s*([NSns])?\\s*" + NUM + "\\s*°?\\s*([NSns])?\\s*[,;\\s]\\s*([EWew])?\\s*" + NUM + "\\s*°?\\s*([EWew])?\\s*$"
  );

  function parseLatLngText(text) {
    if (typeof text !== "string") return null;
    const m = LATLNG_RE.exec(text);
    if (!m) return null;
    const ns = (m[1] || m[3] || "").toUpperCase();
    const ew = (m[4] || m[6] || "").toUpperCase();
    let lat = parseFloat(m[2]);
    let lng = parseFloat(m[5]);
    if (ns === "S") lat = -Math.abs(lat);
    else if (ns === "N") lat = Math.abs(lat);
    if (ew === "W") lng = -Math.abs(lng);
    else if (ew === "E") lng = Math.abs(lng);
    const p = { lat: lat, lng: lng };
    return isLatLng(p) ? p : null;
  }

  // ---- Cuisine tags ------------------------------------------------------

  function normalizeCuisineTokens(value) {
    if (typeof value !== "string") return [];
    const out = [];
    value.split(/[;,]/).forEach(function (part) {
      const t = part.trim().toLowerCase().replace(/\s+/g, "_");
      if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }

  function cuisineIdsForTags(tags) {
    const t = tags || {};
    const found = Object.create(null);
    normalizeCuisineTokens(t.cuisine).forEach(function (tok) {
      const id = Cuisines.forOsmValue(tok);
      if (id) found[id] = true;
    });
    Cuisines.LIST.forEach(function (cu) {
      cu.osmExtra.forEach(function (kv) {
        if (t[kv[0]] === kv[1]) found[cu.id] = true;
      });
    });
    if (t["diet:vegan"] === "only" || t["diet:vegetarian"] === "only") found.veggie = true;
    return Cuisines.LIST.map(function (cu) {
      return cu.id;
    }).filter(function (id) {
      return found[id];
    });
  }

  // ---- Overpass ----------------------------------------------------------

  function reEscape(s) {
    return s.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
  }

  function buildOverpassQuery(cuisineId, center, radiusM, opts) {
    const cu = Cuisines.byId(cuisineId);
    if (!cu) throw new Error("unknown cuisine");
    const o = opts || {};
    const r = Math.round(radiusM);
    const around = "(around:" + r + "," + center.lat.toFixed(5) + "," + center.lng.toFixed(5) + ");";
    const amen = Config.FOOD_AMENITIES.join("|");
    const toks = cu.osmCuisine.map(reEscape).join("|");
    const lines = [
      "[out:json][timeout:" + (o.timeout || Config.OVERPASS_TIMEOUT_S) + "];",
      "(",
      '  nwr["amenity"~"^(' + amen + ')$"]["cuisine"~"(^|;) *(' + toks + ') *(;|$)",i]' + around,
    ];
    cu.osmExtra.forEach(function (kv) {
      lines.push('  nwr["' + kv[0] + '"="' + kv[1] + '"]' + around);
    });
    if (cuisineId === "veggie") {
      lines.push('  nwr["amenity"~"^(' + amen + ')$"]["diet:vegan"="only"]' + around);
      lines.push('  nwr["amenity"~"^(' + amen + ')$"]["diet:vegetarian"="only"]' + around);
    }
    lines.push(");");
    lines.push("out center tags " + (o.limit || Config.MAX_RESULTS) + ";");
    return lines.join("\n");
  }

  // ---- URL safety --------------------------------------------------------

  function safeUrl(s) {
    if (typeof s !== "string") return null;
    const t = s.trim();
    if (!t || /[\s<>"'`\\]/.test(t) || /[\u0000-\u001f]/.test(t)) return null;
    let out;
    if (/^https?:\/\//i.test(t)) {
      out = t;
    } else if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t) || t.indexOf("//") === 0) {
      return null;
    } else if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?([\/?#].*)?$/i.test(t)) {
      out = "https://" + t;
    } else {
      return null;
    }
    try {
      const u = new URL(out);
      if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname) return null;
    } catch (e) {
      return null;
    }
    return out;
  }

  // ---- Restaurant normalizer --------------------------------------------

  function dietVal(v) {
    return v === "only" || v === "yes" || v === "limited" || v === "no" ? v : null;
  }

  function boolTag(v) {
    return v === "yes" || v === "only" ? true : v === "no" ? false : null;
  }

  function prettyCuisine(value) {
    if (typeof value !== "string") return "";
    const parts = [];
    value.split(/[;,]/).forEach(function (p) {
      const w = p
        .trim()
        .replace(/_/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map(function (x) {
          return x.charAt(0).toUpperCase() + x.slice(1);
        })
        .join(" ");
      if (w) parts.push(w);
    });
    return parts.join(", ");
  }

  function firstOf(v) {
    if (typeof v !== "string") return null;
    const f = v.split(";")[0].trim();
    return f || null;
  }

  function normalize(o) {
    const tags = o.tags;
    let ids = cuisineIdsForTags(tags);
    if (ids.length === 0) ids = [o.cuisineId];
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    const address = [street, tags["addr:city"]].filter(Boolean).join(", ");
    const wc = tags.wheelchair;
    return {
      id: o.id,
      name: String(tags.name).trim(),
      lat: o.lat,
      lng: o.lng,
      distanceM: distanceM(o.center, { lat: o.lat, lng: o.lng }),
      cuisineIds: ids,
      primaryCuisine: o.cuisineId,
      cuisineLabel: prettyCuisine(tags.cuisine),
      kind: tags.amenity || tags.shop || tags.tourism || "",
      address: address,
      phone: firstOf(tags.phone || tags["contact:phone"]),
      website: safeUrl(firstOf(tags.website || tags["contact:website"]) || ""),
      openingHours: typeof tags.opening_hours === "string" && tags.opening_hours.trim() ? tags.opening_hours : null,
      diet: {
        vegetarian: dietVal(tags["diet:vegetarian"]),
        vegan: dietVal(tags["diet:vegan"]),
        halal: dietVal(tags["diet:halal"]),
        kosher: dietVal(tags["diet:kosher"]),
        gluten_free: dietVal(tags["diet:gluten_free"]),
      },
      wheelchair: wc === "yes" || wc === "limited" || wc === "no" ? wc : null,
      takeaway: boolTag(tags.takeaway),
      delivery: boolTag(tags.delivery),
      osmUrl: o.osmUrl,
      source: o.source,
    };
  }

  function parseOverpass(json, center, cuisineId) {
    if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("bad-response");
    if (typeof json.remark === "string" && /runtime error/i.test(json.remark)) {
      throw new Error("overpass-runtime");
    }
    const els = Array.isArray(json.elements) ? json.elements : [];
    const byId = Object.create(null);
    const items = [];
    els.forEach(function (el) {
      if (!el || typeof el !== "object" || !el.tags || typeof el.tags !== "object") return;
      const lat = el.lat !== undefined ? el.lat : el.center && el.center.lat;
      const lng = el.lon !== undefined ? el.lon : el.center && el.center.lon;
      if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng)) return;
      if (typeof el.tags.name !== "string" || !el.tags.name.trim()) return;
      const id = el.type + "/" + el.id;
      if (byId[id]) return;
      byId[id] = true;
      const r = normalize({
        id: id,
        tags: el.tags,
        lat: lat,
        lng: lng,
        center: center,
        cuisineId: cuisineId,
        osmUrl: /^(node|way|relation)$/.test(el.type) ? "https://www.openstreetmap.org/" + id : null,
        source: "live",
      });
      items.push({ r: r, n: Object.keys(el.tags).length });
    });
    // De-duplicate same-name places within 30 m, keeping the one with more tags.
    const kept = [];
    items.forEach(function (it) {
      const nm = it.r.name.toLowerCase();
      for (let i = 0; i < kept.length; i++) {
        if (kept[i].r.name.toLowerCase() === nm && distanceM(kept[i].r, it.r) <= 30) {
          if (it.n > kept[i].n) kept[i] = it;
          return;
        }
      }
      kept.push(it);
    });
    return kept
      .map(function (it) {
        return it.r;
      })
      .sort(function (a, b) {
        return a.distanceM - b.distanceM;
      });
  }

  // ---- Opening hours -----------------------------------------------------

  const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  function parseDays(str) {
    const set = [];
    const parts = str.split(",");
    for (let i = 0; i < parts.length; i++) {
      const m = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/.exec(parts[i]);
      if (!m) return null;
      const a = DAY_NAMES.indexOf(m[1]);
      if (!m[2]) {
        set.push(a);
      } else {
        const b = DAY_NAMES.indexOf(m[2]);
        for (let d = a; ; d = (d + 1) % 7) {
          set.push(d);
          if (d === b) break;
        }
      }
    }
    return set;
  }

  function parseTimes(str) {
    const spans = [];
    const parts = str.split(",");
    for (let i = 0; i < parts.length; i++) {
      const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(parts[i].trim());
      if (!m) return null;
      const h1 = +m[1], mi1 = +m[2], h2 = +m[3], mi2 = +m[4];
      if (mi1 > 59 || mi2 > 59 || h1 > 24 || h2 > 48) return null;
      const start = h1 * 60 + mi1;
      let end = h2 * 60 + mi2;
      if (start > 1440 || end > 2880) return null;
      if (end < start) end += 1440;
      if (end === start) return null;
      spans.push([start, end]);
    }
    return spans;
  }

  function parseOpeningHours(str) {
    if (typeof str !== "string") return null;
    const s = str.trim();
    if (!s) return null;
    const days = [[], [], [], [], [], [], []];
    if (s === "24/7") {
      for (let d = 0; d < 7; d++) days[d] = [[0, 1440]];
      return { days: days };
    }
    const rules = s.split(";");
    let any = false;
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i].trim();
      if (!rule) continue;
      const sp = rule.search(/\s/);
      let dayPart = null;
      let timePart = rule;
      if (sp > 0) {
        dayPart = rule.slice(0, sp);
        timePart = rule.slice(sp).trim();
      }
      let dayIdx = [0, 1, 2, 3, 4, 5, 6];
      if (dayPart !== null) {
        const parsed = parseDays(dayPart);
        if (!parsed) {
          // e.g. "10:00-22:00" has no whitespace; "off" has none. Only a day token may precede whitespace.
          return null;
        }
        dayIdx = parsed;
      }
      let spans;
      const low = timePart.toLowerCase();
      if (low === "off" || low === "closed") spans = [];
      else {
        spans = parseTimes(timePart);
        if (!spans) return null;
      }
      dayIdx.forEach(function (d) {
        days[d] = spans.map(function (x) {
          return [x[0], x[1]];
        });
      });
      any = true;
    }
    if (!any) return null;
    days.forEach(function (d) {
      d.sort(function (a, b) {
        return a[0] - b[0];
      });
    });
    return { days: days };
  }

  function asSchedule(x) {
    if (x && typeof x === "object" && Array.isArray(x.days)) return x;
    return parseOpeningHours(x);
  }

  function isOpenAt(x, date) {
    const sch = asSchedule(x);
    if (!sch) return null;
    const d = (date.getDay() + 6) % 7;
    const m = date.getHours() * 60 + date.getMinutes();
    const today = sch.days[d] || [];
    for (let i = 0; i < today.length; i++) {
      if (m >= today[i][0] && m < today[i][1]) return true;
    }
    const prev = sch.days[(d + 6) % 7] || [];
    for (let i = 0; i < prev.length; i++) {
      if (m + 1440 >= prev[i][0] && m + 1440 < prev[i][1]) return true;
    }
    return false;
  }

  function fmtMin(mins) {
    const t = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(t / 60);
    const mm = t % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }

  // Minutes (from now) until the current open stretch ends, merging back-to-back spans.
  // Returns Infinity when effectively always open.
  function closingInfo(sch, date) {
    const d0 = (date.getDay() + 6) % 7;
    const m0 = date.getHours() * 60 + date.getMinutes();
    // absolute minute offsets measured from start of today (day d0)
    function spansFor(offsetDays) {
      return sch.days[(((d0 + offsetDays) % 7) + 7) % 7].map(function (sp) {
        return [sp[0] + offsetDays * 1440, sp[1] + offsetDays * 1440];
      });
    }
    let all = [];
    for (let k = -1; k <= 8; k++) all = all.concat(spansFor(k));
    all.sort(function (a, b) {
      return a[0] - b[0];
    });
    let end = null;
    for (let i = 0; i < all.length; i++) {
      if (m0 >= all[i][0] && m0 < all[i][1]) {
        end = Math.max(end === null ? 0 : end, all[i][1]);
      }
    }
    if (end === null) return null;
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < all.length; i++) {
        if (all[i][0] <= end && all[i][1] > end) {
          end = all[i][1];
          changed = true;
        }
      }
      if (end - m0 > 7 * 1440) return Infinity;
    }
    return end;
  }

  function openStatus(r, date) {
    const h = r && r.openingHours;
    const sch = asSchedule(h);
    if (!sch) return { open: null, label: "Hours unknown" };
    if (typeof h === "string" && h.trim() === "24/7") return { open: true, label: "Open 24/7" };
    const open = isOpenAt(sch, date);
    if (!open) return { open: false, label: "Closed" };
    const end = closingInfo(sch, date);
    if (end === Infinity) return { open: true, label: "Open 24/7" };
    if (end === null) return { open: true, label: "Open" };
    return { open: true, label: "Open", closesAt: fmtMin(end) };
  }

  // ---- Filtering / sorting ----------------------------------------------

  const DIET_OK = { yes: 1, only: 1, limited: 1 };

  function filterRestaurants(list, f, date) {
    const flt = f || {};
    return list.filter(function (r) {
      const d = r.diet || {};
      if (flt.openNow && isOpenAt(r.openingHours, date) !== true) return false;
      if (flt.vegetarian && !(DIET_OK[d.vegetarian] || DIET_OK[d.vegan])) return false;
      if (flt.vegan && !DIET_OK[d.vegan]) return false;
      if (flt.halal && !DIET_OK[d.halal]) return false;
      if (flt.kosher && !DIET_OK[d.kosher]) return false;
      if (flt.glutenFree && !DIET_OK[d.gluten_free]) return false;
      if (flt.wheelchair && r.wheelchair !== "yes" && r.wheelchair !== "limited") return false;
      return true;
    });
  }

  function sortRestaurants(list, by) {
    const out = list.slice();
    if (by === "name") {
      out.sort(function (a, b) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.distanceM - b.distanceM;
      });
    } else {
      out.sort(function (a, b) {
        return a.distanceM - b.distanceM;
      });
    }
    return out;
  }

  // ---- Formatting --------------------------------------------------------

  function unitsFor(locale) {
    if (typeof locale !== "string") return "km";
    const l = locale.toLowerCase().replace(/_/g, "-");
    if (l === "en-us" || l.indexOf("en-us-") === 0 || l === "en-lr" || l.indexOf("en-lr-") === 0) return "mi";
    if (l === "my" || l.indexOf("my-") === 0) return "mi";
    return "km";
  }

  function formatDistance(m, units) {
    if (units === "mi") {
      const mi = m / 1609.344;
      if (mi < 0.1) {
        const ft = Math.round((m * 3.28084) / 50) * 50;
        return ft + " ft";
      }
      return mi.toFixed(1) + " mi";
    }
    if (m < 1000) {
      const rounded = Math.round(m / 10) * 10;
      if (rounded < 1000) return rounded + " m";
    }
    return (m / 1000).toFixed(1) + " km";
  }

  function nextRadius(radiusM) {
    const steps = Config.RADIUS_STEPS_M;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] > radiusM) return steps[i];
    }
    return null;
  }

  function directionsUrl(r, platform) {
    const ll = r.lat + "," + r.lng;
    if (platform === "apple") return "https://maps.apple.com/?daddr=" + ll;
    return "https://www.google.com/maps/dir/?api=1&destination=" + ll;
  }

  // ---- Nominatim ---------------------------------------------------------

  function parseNominatim(json) {
    if (!Array.isArray(json)) return [];
    const out = [];
    json.forEach(function (it) {
      if (!it || typeof it !== "object") return;
      const lat = parseFloat(it.lat);
      const lng = parseFloat(it.lon);
      if (!isFinite(lat) || !isFinite(lng)) return;
      let bbox = null;
      if (Array.isArray(it.boundingbox) && it.boundingbox.length === 4) {
        const b = it.boundingbox.map(parseFloat); // Nominatim order: south, north, west, east
        if (b.every(isFinite)) bbox = [b[0], b[2], b[1], b[3]];
      }
      const label = typeof it.display_name === "string" && it.display_name ? it.display_name : it.name || "";
      if (!label) return;
      out.push({ label: String(label), lat: lat, lng: lng, bbox: bbox });
    });
    return out;
  }

  // ---- Sample data -------------------------------------------------------

  function sampleRestaurants(cuisineId, center, sampleData) {
    let sd = sampleData || WTE.SampleData;
    if (!sd && hasMod) sd = require("./sample-data.js");
    if (!sd) return [];
    const cosLat = Math.max(Math.cos(center.lat * RAD), 1e-6);
    const out = [];
    sd.places.forEach(function (p) {
      if (p.cuisine !== cuisineId) return;
      const tags = Object.assign({}, p.tags, { name: p.name });
      out.push(
        normalize({
          id: "sample/" + p.key,
          tags: tags,
          lat: center.lat + p.dy / 111320,
          lng: center.lng + p.dx / (111320 * cosLat),
          center: center,
          cuisineId: cuisineId,
          osmUrl: null,
          source: "sample",
        })
      );
    });
    return out.sort(function (a, b) {
      return a.distanceM - b.distanceM;
    });
  }

  WTE.Geo = {
    distanceM: distanceM,
    bboxAround: bboxAround,
    clampLatLng: clampLatLng,
    isLatLng: isLatLng,
    parseLatLngText: parseLatLngText,
    normalizeCuisineTokens: normalizeCuisineTokens,
    cuisineIdsForTags: cuisineIdsForTags,
    buildOverpassQuery: buildOverpassQuery,
    parseOverpass: parseOverpass,
    safeUrl: safeUrl,
    parseOpeningHours: parseOpeningHours,
    isOpenAt: isOpenAt,
    openStatus: openStatus,
    filterRestaurants: filterRestaurants,
    sortRestaurants: sortRestaurants,
    unitsFor: unitsFor,
    formatDistance: formatDistance,
    nextRadius: nextRadius,
    directionsUrl: directionsUrl,
    parseNominatim: parseNominatim,
    sampleRestaurants: sampleRestaurants,
  };

  if (typeof module !== "undefined") module.exports = WTE.Geo;
})(typeof window !== "undefined" ? window : globalThis);
