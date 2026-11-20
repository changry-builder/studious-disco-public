(function (root) {
  const WTE = (root.WTE = root.WTE || {});

  const hasL = () => typeof root.L !== "undefined" && root.L && typeof root.L.map === "function";
  const cfg = () => WTE.Config || {};

  let map = null;
  let opts = null;
  let tiles = null;
  let pin = null;
  let circle = null;
  let userDot = null;
  let userRing = null;
  let markers = new Map(); // id -> { marker, r }
  let center = null;
  let radiusM = 2000;
  let interactive = true;
  let activeId = null;

  const reduceMotion = () => {
    try {
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  };

  const ll = (p) => [p.lat, p.lng];
  const fromLeaflet = (p) => ({ lat: p.lat, lng: root.L.Util.wrapNum(p.lng, [-180, 180], true) });

  function labelOf(key, fallback) {
    return (opts && opts.labels && opts.labels[key]) || fallback;
  }

  function fmtDistance(m) {
    try {
      const Geo = WTE.Geo;
      const lang = (root.navigator && root.navigator.language) || "en-US";
      return Geo.formatDistance(m, Geo.unitsFor(lang));
    } catch (e) {
      return Math.round(m) + " m";
    }
  }

  function popupFor(r) {
    const wrap = document.createElement("div");
    wrap.className = "wte-popup";
    const name = document.createElement("strong");
    name.className = "wte-popup-name";
    name.textContent = r.name;
    const dist = document.createElement("div");
    dist.className = "wte-popup-dist";
    dist.textContent = fmtDistance(r.distanceM);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wte-popup-btn";
    btn.textContent = "Details";
    btn.addEventListener("click", () => {
      if (opts && typeof opts.onSelect === "function") opts.onSelect(r.id);
    });
    wrap.appendChild(name);
    wrap.appendChild(dist);
    wrap.appendChild(btn);
    return wrap;
  }

  function pinIcon() {
    const L = root.L;
    return L.divIcon({
      className: "wte-center-pin",
      html: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function ensurePin() {
    const L = root.L;
    if (pin) return;
    const title = labelOf("pin", "Search center");
    pin = L.marker(ll(center), {
      draggable: true,
      keyboard: true,
      title: title,
      alt: title,
      icon: pinIcon(),
      zIndexOffset: 1000,
    }).addTo(map);
    pin.on("dragend", () => {
      const p = fromLeaflet(pin.getLatLng());
      center = p;
      syncCircle();
      if (opts && typeof opts.onPinMove === "function") opts.onPinMove(p, "drag");
    });
  }

  function syncCircle() {
    const L = root.L;
    if (!center) return;
    if (!circle) {
      circle = L.circle(ll(center), {
        radius: radiusM,
        color: "#E4572E",
        weight: 2,
        opacity: 0.8,
        fillColor: "#E4572E",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
    } else {
      circle.setLatLng(ll(center));
      circle.setRadius(radiusM);
    }
  }

  function fitCircle() {
    if (!map || !circle) return;
    map.fitBounds(circle.getBounds(), { padding: [16, 16], animate: !reduceMotion() });
  }

  function setActiveClass(id, on) {
    const entry = markers.get(id);
    if (!entry) return;
    const el = entry.marker.getElement && entry.marker.getElement();
    if (!el) return;
    const pinEl = el.querySelector(".wte-pin") || el;
    pinEl.classList.toggle("is-active", on);
    entry.marker.setZIndexOffset(on ? 500 : 0);
  }

  const MapView = {
    isAvailable() {
      return hasL();
    },

    init(el, options) {
      if (!hasL() || map || !el) return;
      const L = root.L;
      opts = options || {};
      radiusM = opts.radiusM || cfg().DEFAULT_RADIUS_M || 2000;
      const rm = reduceMotion();
      map = L.map(el, {
        zoomAnimation: !rm,
        fadeAnimation: !rm,
        markerZoomAnimation: !rm,
        worldCopyJump: true,
        minZoom: 2,
      });
      tiles = L.tileLayer(cfg().TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: cfg().TILE_MAX_ZOOM || 19,
        attribution:
          cfg().ATTRIBUTION_HTML ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      map.on("click", (e) => {
        if (!interactive) return;
        const p = fromLeaflet(e.latlng);
        center = p;
        ensurePin();
        pin.setLatLng(ll(p));
        syncCircle();
        if (typeof opts.onPinMove === "function") opts.onPinMove(p, "click");
      });

      if (opts.center) {
        center = { lat: opts.center.lat, lng: opts.center.lng };
        ensurePin();
        syncCircle();
        if (typeof opts.zoom === "number") map.setView(ll(center), opts.zoom, { animate: false });
        else map.fitBounds(circle.getBounds(), { padding: [16, 16], animate: false });
      } else {
        map.setView([20, 0], typeof opts.zoom === "number" ? opts.zoom : 2, { animate: false });
      }
    },

    setCenter(c, o) {
      if (!map || !c) return;
      const fit = !o || o.fit !== false;
      center = { lat: c.lat, lng: c.lng };
      ensurePin();
      pin.setLatLng(ll(center));
      syncCircle();
      if (fit) fitCircle();
    },

    setRadius(m) {
      if (!map) return;
      radiusM = m;
      if (!center) return;
      syncCircle();
      if (map.getBounds().contains(ll(center))) fitCircle();
    },

    setUserLocation(p, accuracyM) {
      if (!map) return;
      const L = root.L;
      if (!p) {
        if (userDot) map.removeLayer(userDot);
        if (userRing) map.removeLayer(userRing);
        userDot = userRing = null;
        return;
      }
      const title = labelOf("you", "You are here");
      if (!userDot) {
        userDot = L.marker(ll(p), {
          icon: L.divIcon({
            className: "wte-user-dot",
            html: "",
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
          interactive: false,
          keyboard: false,
          title: title,
          alt: title,
          zIndexOffset: 900,
        }).addTo(map);
      } else {
        userDot.setLatLng(ll(p));
      }
      if (typeof accuracyM === "number" && accuracyM > 0) {
        if (!userRing) {
          userRing = L.circle(ll(p), {
            radius: accuracyM,
            color: "#2A7DE1",
            weight: 1,
            fillColor: "#2A7DE1",
            fillOpacity: 0.1,
            interactive: false,
          }).addTo(map);
        } else {
          userRing.setLatLng(ll(p));
          userRing.setRadius(accuracyM);
        }
      } else if (userRing) {
        map.removeLayer(userRing);
        userRing = null;
      }
    },

    setRestaurants(list) {
      if (!map) return;
      const L = root.L;
      markers.forEach((e) => map.removeLayer(e.marker));
      markers = new Map();
      activeId = null;
      (list || []).forEach((r) => {
        let html = "";
        try {
          html = opts && opts.markerHtml ? opts.markerHtml(r) : "";
        } catch (e) {
          html = "";
        }
        const m = L.marker([r.lat, r.lng], {
          icon: L.divIcon({
            className: "wte-marker",
            html: html,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16],
          }),
          keyboard: true,
          title: r.name,
          alt: r.name,
        }).addTo(map);
        m.bindPopup(popupFor(r), { closeButton: true, autoPanPadding: [24, 24] });
        m.on("click", () => {
          if (opts && typeof opts.onSelect === "function") opts.onSelect(r.id);
        });
        markers.set(r.id, { marker: m, r: r });
      });
    },

    highlight(id, o) {
      if (!map) return;
      const pan = !o || o.pan !== false;
      const openPopup = !o || o.openPopup !== false;
      if (activeId && activeId !== id) setActiveClass(activeId, false);
      if (!id || !markers.has(id)) {
        activeId = null;
        map.closePopup();
        return;
      }
      activeId = id;
      const entry = markers.get(id);
      setActiveClass(id, true);
      if (pan) map.panTo(entry.marker.getLatLng(), { animate: !reduceMotion() });
      if (openPopup) entry.marker.openPopup();
    },

    fitToResults() {
      if (!map) return;
      const L = root.L;
      const pts = [];
      if (center) pts.push(ll(center));
      markers.forEach((e) => pts.push(e.marker.getLatLng()));
      if (!pts.length) return;
      if (pts.length === 1) {
        if (circle) fitCircle();
        return;
      }
      map.fitBounds(L.latLngBounds(pts), { padding: [32, 32], animate: !reduceMotion() });
    },

    invalidateSize() {
      if (map) map.invalidateSize();
    },

    setInteractive(on) {
      interactive = !!on;
      if (!map) return;
      const c = map.getContainer();
      c.classList.toggle("wte-map-locked", !interactive);
      if (pin && pin.dragging) {
        if (interactive) pin.dragging.enable();
        else pin.dragging.disable();
      }
    },

    destroy() {
      if (map) map.remove();
      map = opts = tiles = pin = circle = userDot = userRing = null;
      markers = new Map();
      center = null;
      activeId = null;
      interactive = true;
    },
  };

  WTE.MapView = MapView;
})(typeof window !== "undefined" ? window : globalThis);
