/* What to Eat service worker. Bump CACHE whenever any shell file changes. */
const CACHE = "wte-shell-v1";

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/vendor/leaflet/leaflet.js",
  "js/config.js",
  "js/cuisines.js",
  "js/sample-data.js",
  "js/rng.js",
  "js/engine.js",
  "js/geo.js",
  "js/storage.js",
  "js/net.js",
  "js/art.js",
  "js/map-view.js",
  "js/pwa.js",
  "js/ui-pick.js",
  "js/ui-duel.js",
  "js/ui-results.js",
  "js/app.js",
  "js/vendor/leaflet/leaflet.css",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Add individually so one missing optional file doesn't abort install.
      Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("wte-") && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Cross-origin (Overpass, Nominatim, OSM tiles): never intercepted.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === "navigate") {
        const shell = (await cache.match("index.html")) || (await cache.match("./"));
        if (shell) return shell;
      }
      return Response.error();
    })
  );
});
