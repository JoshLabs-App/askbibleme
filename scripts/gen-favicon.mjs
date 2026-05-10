/**
 * Writes app/favicon.ico (PNG-in-ICO, 32×32) — calm gold on transparent via padded canvas.
 * Run: node scripts/gen-favicon.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "app", "favicon.ico");

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(typeStr, data) {
  const t = Buffer.from(typeStr, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const w = 32;
const h = 32;
/** Parchment-ish center, muted gold ring — readable at favicon size */
const cx = 15.5;
const cy = 15.5;
const r0 = 9;
const r1 = 12;

function pixel(x, y) {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > r1) return [0xf4, 0xec, 0xd8, 0x00];
  if (d > r0) return [0xb8, 0x94, 0x42, 0xe6];
  return [0xf4, 0xec, 0xd8, 0xf2];
}

const raw = Buffer.alloc((w * 4 + 1) * h);
let p = 0;
for (let y = 0; y < h; y++) {
  raw[p++] = 0;
  for (let x = 0; x < w; x++) {
    const [r, g, b, a] = pixel(x, y);
    raw[p++] = r;
    raw[p++] = g;
    raw[p++] = b;
    raw[p++] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  sig,
  pngChunk("IHDR", ihdr),
  pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  pngChunk("IEND", Buffer.alloc(0)),
]);

const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0);
dir.writeUInt16LE(1, 2);
dir.writeUInt16LE(1, 4);

const entry = Buffer.alloc(16);
entry.writeUInt8(w, 0);
entry.writeUInt8(h, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);

fs.writeFileSync(out, Buffer.concat([dir, entry, png]));
console.log("Wrote", out, `(${fs.statSync(out).size} bytes)`);
