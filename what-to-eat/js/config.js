(function (root) {
  const WTE = (root.WTE = root.WTE || {});

  WTE.Config = {
    VERSION: "1.0.0",
    STORAGE_PREFIX: "wte:v1:",
    MAX_CONTENDERS: 16,
    RADIUS_STEPS_M: [500, 1000, 2000, 3000, 5000, 8000, 12000, 25000],
    DEFAULT_RADIUS_M: 2000,
    MAX_RESULTS: 150, // Overpass `out ... 150`
    OVERPASS_ENDPOINTS: [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ],
    OVERPASS_TIMEOUT_S: 25, // server [timeout:25]
    CLIENT_TIMEOUT_MS: 30000, // per endpoint attempt
    CACHE_TTL_MS: 24 * 3600 * 1000,
    CACHE_MAX_ENTRIES: 30,
    NOMINATIM_URL: "https://nominatim.openstreetmap.org",
    NOMINATIM_MIN_INTERVAL_MS: 1100, // policy: max 1 req/s
    TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    TILE_MAX_ZOOM: 19,
    ATTRIBUTION_HTML:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    DEMO_CENTER: { lat: 40.7306, lng: -73.9866, label: "East Village, New York (demo)" },
    FOOD_AMENITIES: ["restaurant", "fast_food", "cafe", "food_court", "ice_cream", "pub", "bar", "biergarten"],
  };

  if (typeof module !== "undefined") module.exports = WTE.Config;
})(typeof window !== "undefined" ? window : globalThis);
