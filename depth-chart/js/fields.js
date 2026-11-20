/* Field drawings and where each position's card sits on them (x, y as % of the field box). */
(function (root) {
  const baseballSVG = `
<svg viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <pattern id="mow" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="var(--grass)"/><rect width="4" height="8" fill="var(--grass-2)"/>
    </pattern>
  </defs>
  <rect width="100" height="80" fill="var(--stands)"/>
  <path d="M50 76 L5.5 31.5 A63 63 0 0 1 94.5 31.5 Z" fill="var(--track)"/>
  <path d="M50 76 L7.5 33.5 A60 60 0 0 1 92.5 33.5 Z" fill="url(#mow)"/>
  <path d="M50 76 L32 58 A25 25 0 0 1 68 58 Z" fill="var(--dirt)"/>
  <path d="M50 70.5 L39.5 60 L50 49.5 L60.5 60 Z" fill="url(#mow)"/>
  <circle cx="50" cy="60.5" r="3.2" fill="var(--dirt)"/>
  <circle cx="50" cy="73.5" r="4.4" fill="var(--dirt)"/>
  <g stroke="var(--chalk)" stroke-width="0.35" fill="none">
    <path d="M50 76 L7.5 33.5 M50 76 L92.5 33.5"/>
    <circle cx="50" cy="73.5" r="4.4" stroke-width="0.2"/>
  </g>
  <g fill="var(--chalk)">
    <rect x="59.6" y="59.1" width="1.8" height="1.8" transform="rotate(45 60.5 60)"/>
    <rect x="49.1" y="48.6" width="1.8" height="1.8" transform="rotate(45 50 49.5)"/>
    <rect x="38.6" y="59.1" width="1.8" height="1.8" transform="rotate(45 39.5 60)"/>
    <path d="M49 73 h2 v0.9 l-1 0.9 l-1 -0.9 Z"/>
    <rect x="49.3" y="60.1" width="1.4" height="0.4"/>
  </g>
</svg>`;

  // College half court, 50 ft wide x 47 ft deep (2 units per foot), basket at the top.
  const courtSVG = `
<svg viewBox="0 0 100 94" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <pattern id="boards" width="100" height="3" patternUnits="userSpaceOnUse">
      <rect width="100" height="3" fill="var(--wood)"/><rect y="2.8" width="100" height="0.2" fill="var(--wood-2)"/>
    </pattern>
  </defs>
  <rect width="100" height="94" fill="url(#boards)"/>
  <rect x="38" y="0" width="24" height="38" fill="var(--paint)"/>
  <g stroke="var(--line)" stroke-width="0.5" fill="none">
    <rect x="0.25" y="0.25" width="99.5" height="93.5"/>
    <rect x="38" y="0" width="24" height="38"/>
    <path d="M38 38 A12 12 0 0 0 62 38" />
    <path d="M38 38 A12 12 0 0 1 62 38" stroke-dasharray="2 1.6"/>
    <path d="M6.7 0 V19.9 A44.3 44.3 0 0 0 93.3 19.9 V0"/>
    <path d="M42 10.5 A8 8 0 0 0 58 10.5"/>
    <path d="M38 94 A12 12 0 0 1 62 94"/>
    <path d="M44 8 H56" stroke-width="0.8"/>
  </g>
  <circle cx="50" cy="10.5" r="1.5" fill="none" stroke="var(--rim)" stroke-width="0.5"/>
</svg>`;

  const LAYOUTS = {
    baseball: {
      svg: baseballSVG,
      aspect: "100 / 80",
      slots: {
        CF: [50, 17], LF: [17, 30], RF: [83, 30],
        SS: [35, 47], "2B": [65, 47], "3B": [19, 64], "1B": [81, 64],
        SP: [50, 64], C: [50, 92], DH: [12, 90],
      },
      side: { title: "Bullpen", slots: ["CL", "SU", "RP"] },
    },
    basketball: {
      svg: courtSVG,
      aspect: "100 / 94",
      slots: { C: [50, 22], PF: [20, 26], SF: [80, 42], SG: [20, 70], PG: [62, 82] },
      side: null,
    },
  };

  root.DC_Fields = LAYOUTS;
  if (typeof module !== "undefined") module.exports = LAYOUTS;
})(typeof window !== "undefined" ? window : globalThis);
