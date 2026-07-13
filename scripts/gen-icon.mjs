// Generates a 1024x1024 PNG source icon (no external deps) for `tauri icon`.
// Design: light-blue rounded-square background with an orange git-branch motif
// (a top node, a central hub, a right node, and an elbow down to a bottom node).
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const S = 1024;
const buf = Buffer.alloc(S * S * 4);

function px(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

// Palette.
const BG = [0x88, 0xc9, 0xf2]; // light blue
const OR_TOP = [0xf9, 0x9b, 0x33]; // lighter orange (top)
const OR_BOT = [0xf0, 0x4e, 0x1c]; // deeper orange (bottom)

// Vertical gradient for the orange motif.
const Y_MIN = 170;
const Y_MAX = 870;
function orange(y) {
  let t = (y - Y_MIN) / (Y_MAX - Y_MIN);
  t = Math.max(0, Math.min(1, t));
  return [
    Math.round(OR_TOP[0] + (OR_BOT[0] - OR_TOP[0]) * t),
    Math.round(OR_TOP[1] + (OR_BOT[1] - OR_TOP[1]) * t),
    Math.round(OR_TOP[2] + (OR_BOT[2] - OR_TOP[2]) * t),
  ];
}

// White background fills the full canvas (macOS clips to squircle).
// Blue rounded-rect is inset so the icon doesn't fill edge-to-edge
// (matches ChatGPT / standard macOS badge-style icon proportions).
const INSET = 100;           // transparent outer margin on each side
const radius = 160;          // corner radius of the blue badge

function sdRoundedBox(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - halfW + r;
  const qy = Math.abs(py) - halfH + r;
  return (
    Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
}

const cx = S / 2;
const cy = S / 2;
const halfBadge = S / 2 - INSET;  // 412px → badge is 824×824

// Paint the blue badge with anti-aliased edges; outside is transparent.
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const dist = sdRoundedBox(x - cx, y - cy, halfBadge, halfBadge, radius);
    const alpha = Math.max(0, Math.min(1, -dist + 0.5));
    if (alpha <= 0) { px(x, y, 0, 0, 0, 0); continue; }
    px(x, y, BG[0], BG[1], BG[2], Math.round(alpha * 255));
  }
}

// Motif geometry (git branch graph).
const TOP = [509, 232];
const HUB = [509, 476];
const RIGHT = [658, 604];
const ELBOW = [356, 654];
const BOTTOM = [356, 807];

const LW = 15; // half line width
const NR = 62; // node radius

function line(x0, y0, x1, y1, w) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    const col = orange(y);
    for (let dy = -w; dy <= w; dy++)
      for (let dx = -w; dx <= w; dx++)
        if (dx * dx + dy * dy <= w * w) px(x + dx, y + dy, col[0], col[1], col[2], 255);
  }
}

// Connections.
line(TOP[0], TOP[1], HUB[0], HUB[1], LW); // top -> hub
line(HUB[0], HUB[1], RIGHT[0], RIGHT[1], LW); // hub -> right
line(HUB[0], HUB[1], ELBOW[0], ELBOW[1], LW); // hub -> elbow
line(ELBOW[0], ELBOW[1], BOTTOM[0], BOTTOM[1], LW); // elbow -> bottom

// Nodes.
for (const [cx, cy] of [TOP, HUB, RIGHT, BOTTOM]) {
  for (let y = cy - NR; y <= cy + NR; y++)
    for (let x = cx - NR; x <= cx + NR; x++) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= NR * NR) {
        const col = orange(y);
        px(x, y, col[0], col[1], col[2], 255);
      }
    }
}

// Encode PNG.
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0; // filter none
  buf.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(new URL("../app-icon.png", import.meta.url), png);
console.log("wrote app-icon.png", png.length, "bytes");
