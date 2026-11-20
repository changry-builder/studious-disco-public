/* WTE.Art + WTE.Dom — inline SVG tile art and a tiny DOM helper (lane B). */
(function (root) {
  const WTE = (root.WTE = root.WTE || {});

  let uid = 0;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hex = (c, fb) => (/^#[0-9a-fA-F]{3,8}$/.test(String(c)) ? c : fb);

  function patternDef(id, name, a) {
    switch (name) {
      case "stripes":
        return `<pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="8" height="18" fill="${a}"/></pattern>`;
      case "waves":
        return `<pattern id="${id}" width="32" height="16" patternUnits="userSpaceOnUse"><path d="M0 8Q8 0 16 8T32 8" fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/></pattern>`;
      case "grid":
        return `<pattern id="${id}" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="${a}" stroke-width="2.5"/></pattern>`;
      case "zigzag":
        return `<pattern id="${id}" width="24" height="16" patternUnits="userSpaceOnUse"><path d="M0 12L6 4L12 12L18 4L24 12" fill="none" stroke="${a}" stroke-width="3" stroke-linejoin="round"/></pattern>`;
      case "rings":
        return `<pattern id="${id}" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="18" cy="18" r="12" fill="none" stroke="${a}" stroke-width="3"/><circle cx="18" cy="18" r="4" fill="${a}"/></pattern>`;
      case "dots":
      default:
        return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3.5" fill="${a}"/><circle cx="17" cy="17" r="3.5" fill="${a}"/></pattern>`;
    }
  }

  /** Cuisine -> SVG markup string. Built only from bundled (trusted) cuisine data. */
  function tileSvg(cuisine, opts) {
    const size = (opts && opts.size) || 160;
    const id = "wte-p" + ++uid;
    const color = hex(cuisine.color, "#E4572E");
    const accent = hex(cuisine.accent, "#FFD166");
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
      `<defs>${patternDef(id, cuisine.pattern, accent)}` +
      `<radialGradient id="${id}g" cx="50%" cy="48%" r="55%"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="160" height="160" fill="${color}"/>` +
      `<rect width="160" height="160" fill="url(#${id})" opacity=".34"/>` +
      `<rect width="160" height="160" fill="url(#${id}g)"/>` +
      `<circle cx="80" cy="80" r="50" fill="#fff" opacity=".2"/>` +
      `<text x="80" y="82" font-size="76" text-anchor="middle" dominant-baseline="central" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${esc(cuisine.emoji)}</text>` +
      `</svg>`
    );
  }

  function markerHtml(cuisine) {
    return `<span class="wte-pin" style="--c:${hex(cuisine && cuisine.color, "#E4572E")}">${esc((cuisine && cuisine.emoji) || "🍽️")}</span>`;
  }

  /** Parse trusted SVG markup into a node. */
  function svgNode(markup) {
    const t = document.createElement("template");
    t.innerHTML = markup; // trusted: generated from bundled cuisine data only
    return t.content.firstElementChild;
  }

  WTE.Art = { tileSvg, markerHtml, svgNode };

  /* ---- DOM helper (never uses innerHTML) ---- */
  function h(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "on") for (const ev of Object.keys(v)) node.addEventListener(ev, v[ev]);
        else if (k === "style") node.style.cssText = v;
        else if (k === "dataset") Object.assign(node.dataset, v);
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, String(v));
      }
    }
    for (let i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach((x) => append(node, x));
    else node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  WTE.Dom = {
    h,
    clear(node) { while (node.firstChild) node.removeChild(node.firstChild); },
    reducedMotion() {
      try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
    },
  };
  WTE.UI = WTE.UI || {};
})(typeof window !== "undefined" ? window : globalThis);
