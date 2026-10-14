// Builds the map data the reveal screen uses:
//   js/world.js   country outlines (Natural Earth via world-atlas), keyed by ISO alpha-3 code
//   js/places.js  [longitude, latitude] for every city in js/countries.js (GeoNames via all-the-cities)
//
// Run after changing the country list:
//   npm install --no-save world-atlas@2 all-the-cities@3 topojson-client@3 i18n-iso-countries@7
//   node scripts/build-geo.js
//
// Cities the dataset can't find by name are listed in MANUAL below.

const fs = require("fs");
const path = require("path");
const topojson = require("topojson-client");
const isoCodes = require("i18n-iso-countries/codes.json");
const cities = require("all-the-cities");
const { COUNTRIES } = require("../js/countries.js");
const Engine = require("../js/engine.js");

const root = path.join(__dirname, "..");
const atlas = (res) => require(`world-atlas/countries-${res}m.json`);

const alpha3 = new Map(isoCodes.map(([a2, a3, num]) => [num, a3]));
const alpha2 = new Map(isoCodes.map(([a2, a3]) => [a3, a2]));

// Coordinates for places GeoNames lists under another name or not at all. [lon, lat]
const MANUAL = {
  "DEU:Frankfurt": [8.684, 50.116],
  "RUS:Nizhny Novgorod": [44.002, 56.329],
  "GRC:Patras": [21.734, 38.244],
  "GRC:Larissa": [22.418, 39.637],
  "THA:Nonthaburi": [100.515, 13.861],
  "ARE:Al Ain": [55.761, 24.192],
  "ARE:Ajman": [55.479, 25.402],
  "PHL:Caloocan": [120.968, 14.65],
  "UKR:Zaporizhzhia": [35.19, 47.823],
  "ECU:Santo Domingo": [-79.175, -0.253],
  "AFG:Mazar-i-Sharif": [67.111, 36.709],
  "KAZ:Karaganda": [73.102, 49.802],
  "SYR:Hama": [36.758, 35.132],
  "QAT:Al Khor": [51.506, 25.684],
  "GTM:Antigua": [-90.734, 14.561],
  "HTI:Delmas": [-72.303, 18.545],
  "LBY:Misrata": [15.093, 32.375],
  "SOM:Hargeisa": [44.065, 9.56],
  "UZB:Andijan": [72.344, 40.782],
  "AZE:Sumqayit": [49.669, 40.59],
  "AZE:Mingachevir": [47.06, 40.764],
  "YEM:Taiz": [44.021, 13.58],
  "BHR:Muharraq": [50.612, 26.257],
  "DOM:Santiago de los Caballeros": [-70.697, 19.451],
  "IND:New Delhi": [77.209, 28.614],
  "LKA:Sri Jayawardenepura Kotte": [79.902, 6.889],
  "MMR:Naypyidaw": [96.13, 19.745],
  "GRC:Heraklion": [25.134, 35.339],
  "IRL:Limerick": [-8.63, 52.664],
  "IRL:Galway": [-9.049, 53.271],
  "IDN:Nusantara": [116.7, -0.97],
  "BOL:El Alto": [-68.163, -16.504],
  "URY:Ciudad de la Costa": [-55.95, -34.82],
  "MNG:Darkhan": [105.95, 49.47],
  "LBN:Byblos": [35.648, 34.121],
  "QAT:Al Rayyan": [51.424, 25.292],
  "BLR:Gomel": [30.98, 52.44],
  "HTI:Cap-Haïtien": [-72.2, 19.76],
  "PRY:Luque": [-57.487, -25.267],
  "UGA:Nansana": [32.53, 0.36],
  "UGA:Kira": [32.64, 0.4],
  "SDN:Khartoum North": [32.55, 15.64],
  "GNQ:Ciudad de la Paz": [10.82, 1.59],
  "BHR:Riffa": [50.555, 26.13],
  "BHR:Isa Town": [50.548, 26.174],
  "FJI:Nasinu": [178.5, -18.07],
};

// ---------- outlines ----------

const round = (coords) =>
  typeof coords[0] === "number" ? [Math.round(coords[0] * 100) / 100, Math.round(coords[1] * 100) / 100] : coords.map(round);

function features(res) {
  const topo = atlas(res);
  return topojson.feature(topo, topo.objects.countries).features.map((f) => ({
    type: "Feature",
    id: alpha3.get(f.id) || null,
    properties: { name: f.properties.name },
    geometry: f.geometry,
  }));
}

// Natural Earth draws Somaliland separately; the quiz treats it as part of Somalia.
const UNASSIGNED = { Somaliland: "SOM" };
const coarse = features(110).map((f) => (f.id ? f : { ...f, id: UNASSIGNED[f.properties.name] || null }));
const have = new Set(coarse.map((f) => f.id));
// Small countries (Bahrain, Liechtenstein, Mauritius…) only exist in the finer 50m set.
const fine = features(50).filter((f) => f.id && !have.has(f.id) && COUNTRIES.some((c) => c.code === f.id));
const world = [...coarse, ...fine]
  .filter((f) => f.geometry && f.properties.name !== "Antarctica")
  .map((f) => ({ ...f, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } }));

const noOutline = COUNTRIES.filter((c) => !world.some((f) => f.id === c.code)).map((c) => c.code);

// ---------- cities ----------

const byCountry = new Map();
for (const city of cities) {
  if (!byCountry.has(city.country)) byCountry.set(city.country, []);
  byCountry.get(city.country).push(city);
}

function locate(country, entry) {
  const name = Engine.displayName(entry);
  const manual = MANUAL[`${country.code}:${name}`];
  if (manual) return manual;
  const spellings = new Set(entry.split("|").map(Engine.normalize));
  const pool = byCountry.get(alpha2.get(country.code)) || [];
  const matches = pool.filter(
    (c) => spellings.has(Engine.normalize(c.name)) || (c.altName || "").split(",").some((a) => spellings.has(Engine.normalize(a)))
  );
  if (!matches.length) return null;
  // Prefer the capital feature, then the most populous match.
  matches.sort((a, b) => (b.featureCode === "PPLC") - (a.featureCode === "PPLC") || b.population - a.population);
  const isCapital = country.capital.includes(entry);
  const best = isCapital ? matches[0] : matches.sort((a, b) => b.population - a.population)[0];
  return best.loc.coordinates.map((n) => Math.round(n * 1000) / 1000);
}

const places = {};
const missing = [];
for (const country of COUNTRIES) {
  places[country.code] = {};
  for (const entry of [...country.capital, ...country.largest, ...country.cities]) {
    const name = Engine.displayName(entry);
    if (places[country.code][name]) continue;
    const at = locate(country, entry);
    if (at) places[country.code][name] = at;
    else missing.push(`${country.code}:${name}`);
  }
}

// ---------- write ----------

const header = "// Generated by scripts/build-geo.js. Do not edit by hand.\n";
fs.writeFileSync(
  path.join(root, "js/world.js"),
  `${header}// Country outlines from Natural Earth (public domain) via world-atlas.\nconst WORLD = ${JSON.stringify({ type: "FeatureCollection", features: world })};\nif (typeof module !== "undefined") module.exports = { WORLD };\n`
);
fs.writeFileSync(
  path.join(root, "js/places.js"),
  `${header}// City coordinates [longitude, latitude] from GeoNames (CC BY 4.0) via all-the-cities.\nconst PLACES = ${JSON.stringify(places, null, 0).replace(/\],"/g, '],"').replace(/\},"/g, '},\n"')};\nif (typeof module !== "undefined") module.exports = { PLACES };\n`
);

console.log(`outlines: ${world.length} (${fine.length} from 50m)`);
console.log(`countries without an outline: ${noOutline.join(", ") || "none"}`);
console.log(`cities without coordinates (${missing.length}): ${missing.join(", ") || "none"}`);
