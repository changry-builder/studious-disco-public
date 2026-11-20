#!/usr/bin/env node
"use strict";
// Rasterizes the What to Eat icon art to PNG files using only Node built-ins (zlib, fs, path).
//
// The art mirrors icons/icon.svg (viewBox 0 0 512 512). If you change one, change the other.
// Run from anywhere:   node what-to-eat/tools/make-icons.js
//
// Writes into what-to-eat/icons/:
//   icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png (180x180),
//   favicon-32.png
// All outputs are fully opaque RGB (the background is full-bleed), which suits iOS and maskable use.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ART = 512;          // design units (matches the SVG viewBox)
const SUPERSAMPLE = 4;    // SUPERSAMPLE x SUPERSAMPLE samples per output pixel (anti-aliasing)
const SAFE_RADIUS = 0.4 * ART; // Android maskable safe zone: circle of 80% diameter

const ORANGE = "#E4572E";
const CREAM = "#FFF8F0";
const YELLOW = "#FFD166";

// Shapes are painted in order; later shapes overwrite earlier ones.
function artShapes() {
  return [
    { t: "rect", bg: true, x: 0, y: 0, w: ART, h: ART, c: ORANGE },
    // plate
    { t: "circle", cx: 288, cy: 262, r: 108, c: CREAM },
    { t: "circle", cx: 288, cy: 262, r: 76, c: YELLOW },
    // fork, centred on x = 138
    { t: "rect", x: 117, y: 142, w: 10, h: 54, c: CREAM },  // tine
    { t: "rect", x: 133, y: 142, w: 10, h: 54, c: CREAM },  // tine
    { t: "rect", x: 149, y: 142, w: 10, h: 54, c: CREAM },  // tine
    { t: "rect", x: 117, y: 192, w: 42, h: 22, c: CREAM },  // head
    { t: "rect", x: 131, y: 212, w: 14, h: 32, c: CREAM },  // neck
    { t: "rect", x: 128, y: 240, w: 20, h: 116, c: CREAM }, // handle
    { t: "circle", cx: 138, cy: 360, r: 10, c: CREAM },     // handle end
  ];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function contains(s, px, py) {
  if (s.t === "rect") {
    return px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h;
  }
  const dx = px - s.cx;
  const dy = py - s.cy;
  return dx * dx + dy * dy <= s.r * s.r;
}

// Throws if any non-background shape leaves the maskable safe zone.
function assertMaskableSafe(shapes) {
  const c = ART / 2;
  const far = (x, y) => Math.hypot(x - c, y - c);
  for (const s of shapes) {
    if (s.bg) continue;
    let worst;
    if (s.t === "rect") {
      worst = Math.max(
        far(s.x, s.y), far(s.x + s.w, s.y),
        far(s.x, s.y + s.h), far(s.x + s.w, s.y + s.h)
      );
    } else {
      worst = far(s.cx, s.cy) + s.r;
    }
    if (worst > SAFE_RADIUS) {
      throw new Error(`shape outside maskable safe zone: ${JSON.stringify(s)}`);
    }
  }
}

// Returns a raw RGB pixel buffer (size * size * 3).
function render(size, shapes) {
  const painted = shapes.map((s) => ({ ...s, rgb: hexToRgb(s.c) }));
  const out = Buffer.alloc(size * size * 3);
  const unit = ART / size;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const px = (x + (sx + 0.5) / SUPERSAMPLE) * unit;
          const py = (y + (sy + 0.5) / SUPERSAMPLE) * unit;
          let colour = [0, 0, 0];
          for (const s of painted) {
            if (contains(s, px, py)) colour = s.rgb;
          }
          r += colour[0];
          g += colour[1];
          b += colour[2];
        }
      }
      const o = (y * size + x) * 3;
      out[o] = Math.round(r / samples);
      out[o + 1] = Math.round(g / samples);
      out[o + 2] = Math.round(b / samples);
    }
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

// 8-bit RGB (colour type 2), filter type 0 on every scanline.
function encodePng(size, rgb) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;  // bit depth
  header[9] = 2;  // colour type: truecolour RGB
  header[10] = 0; // compression
  header[11] = 0; // filter method
  header[12] = 0; // no interlace

  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const TARGETS = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 }, // same art; verified inside the safe zone above
  { file: "apple-touch-icon.png", size: 180 },
  { file: "favicon-32.png", size: 32 },
];

function main() {
  const shapes = artShapes();
  assertMaskableSafe(shapes);

  const outDir = path.join(__dirname, "..", "icons");
  fs.mkdirSync(outDir, { recursive: true });

  for (const target of TARGETS) {
    const png = encodePng(target.size, render(target.size, shapes));
    const outPath = path.join(outDir, target.file);
    fs.writeFileSync(outPath, png);
    console.log(`${outPath} ${target.size}x${target.size} ${png.length} bytes`);
  }
}

main();
