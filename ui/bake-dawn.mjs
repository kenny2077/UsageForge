// Bakes "alpine dawn" from ascii.rest by bas3line (MIT; notice in docs/third-party-notices.txt)
// into dawn.bin for dawn.py: one byte a cell, palette index * 4 + dot size, 200 by 100 a frame.
//   npm install ascii.rest@0.4.0 && node ui/bake-dawn.mjs [start seconds] [frames] [step seconds]
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import * as piece from "ascii.rest/pieces/alpine-dawn";

const [t0, n, dt] = [Number(process.argv[2] ?? 50), Number(process.argv[3] ?? 16), Number(process.argv[4] ?? 0.1)];
const { cols: W, rows: H } = piece.meta;
const frame = piece.default();
const color = new Uint8Array(W * H);
const out = new Uint8Array(n * W * H);
for (let f = 0; f < n; f++) {
  const text = frame(t0 + f * dt, { color }).replace(/\n/g, "");
  for (let k = 0; k < W * H; k++) out[f * W * H + k] = color[k] * 4 + " ·•●".indexOf(text[k]);
}
writeFileSync(process.env.OUT || new URL("dawn.bin", import.meta.url), deflateSync(out, { level: 9 }));
