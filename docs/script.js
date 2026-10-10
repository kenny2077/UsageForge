// UsageForge, an Aurora Forge Lab product. Everything here enhances content that is already in the HTML.
// One motif, the lamp field: a low-res board of square lamps the cursor can warm.
document.documentElement.classList.add("js");

const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const NARROW = window.matchMedia("(max-width: 800px)");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const TINTS = {
  schedule: hex("#ffb14a"),
  watch: hex("#58f0a8"),
  private: hex("#6aa7ff"),
  codex: hex("#b48cff"),
};
const TEAL = hex("#4fe3d0");
const CYAN = hex("#4cc9f0");
const VIOLET = hex("#9b7dff");
const HEAT = [hex("#ff8a3d"), hex("#ffd28a")];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// ---------- One frame loop, run only while something is moving ----------

const fields = [];
let raf = 0;
let lastY = -1;
const kick = () => {
  if (!raf) raf = requestAnimationFrame(tick);
};

function tick(now) {
  raf = 0;
  let busy = false;
  if (window.scrollY !== lastY) {
    lastY = window.scrollY;
    onScroll();
  }
  for (const field of fields) busy = field.frame(now) || busy;
  if (busy) kick();
}

// ---------- Lamp field renderer ----------
// paint(buf, cols, rows) fills RGBA at lamp resolution (alpha 0..1); the canvas
// upscales it with nearest-neighbour and cuts seams between lamps.

function lampField(canvas, { layout, paint, seamColor = null, radius = 3, decay = 0.9, update }) {
  const ctx = canvas.getContext("2d");
  const low = document.createElement("canvas");
  const lctx = low.getContext("2d");
  if (!ctx || !lctx) return null;

  const field = { cols: 0, rows: 0, visible: true, dirty: true, heat: new Float32Array(0) };
  let cell = 1;
  let seam = 0;
  let ox = 0;
  let oy = 0;
  let img = null;
  let base = new Float32Array(0);
  let last = null;

  field.resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = layout(canvas.width, canvas.height, dpr);
    Object.assign(field, { cols: g.cols, rows: g.rows });
    cell = g.cell;
    seam = g.seam;
    ox = Math.round((canvas.width - g.cols * cell) / 2);
    oy = Math.round((canvas.height - g.rows * cell) / 2);
    low.width = g.cols;
    low.height = g.rows;
    img = lctx.createImageData(g.cols, g.rows);
    base = new Float32Array(g.cols * g.rows * 4);
    field.heat = new Float32Array(g.cols * g.rows);
    field.repaint();
  };

  field.repaint = () => {
    if (!img) return;
    paint(base, field.cols, field.rows);
    field.dirty = true;
    kick();
  };

  field.frame = (now) => {
    if (!img) return false;
    let busy = update ? update(now, field) : false;
    if (!field.visible) return busy;
    const H = field.heat;
    let hot = false;
    for (let i = 0; i < H.length; i += 1) {
      if (H[i] > 0) {
        H[i] = H[i] < 0.08 ? 0 : H[i] * decay;
        hot = true;
      }
    }
    if (!hot && !field.dirty) return busy;

    const d = img.data;
    for (let i = 0, p = 0; i < H.length; i += 1, p += 4) {
      let r = base[p];
      let g = base[p + 1];
      let b = base[p + 2];
      let a = base[p + 3];
      const h = H[i];
      if (h > 0.38) {
        const q = Math.ceil(h * 5) / 5; // five heat steps keep the trail pixelated
        const k = 0.55 + q * 0.4;
        r = mix(r, mix(HEAT[0][0], HEAT[1][0], q), k);
        g = mix(g, mix(HEAT[0][1], HEAT[1][1], q), k);
        b = mix(b, mix(HEAT[0][2], HEAT[1][2], q), k);
        a = Math.max(a, k);
      }
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
      d[p + 3] = a * 255;
    }
    lctx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, ox, oy, field.cols * cell, field.rows * cell);
    if (seam) {
      const cut = seamColor
        ? (x, y, w, h) => ctx.fillRect(x, y, w, h)
        : (x, y, w, h) => ctx.clearRect(x, y, w, h);
      if (seamColor) ctx.fillStyle = seamColor;
      for (let x = 1; x <= field.cols; x += 1) cut(ox + x * cell - seam, 0, seam, canvas.height);
      for (let y = 1; y <= field.rows; y += 1) cut(0, oy + y * cell - seam, canvas.width, seam);
    }
    field.dirty = false;
    return true;
  };

  const stamp = (cx, cy) => {
    const { cols, rows } = field;
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(rows - 1, Math.ceil(cy + radius)); y += 1) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(cols - 1, Math.ceil(cx + radius)); x += 1) {
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        if (dist >= 1) continue;
        const i = y * cols + x;
        field.heat[i] = Math.max(field.heat[i], 1 - dist * dist * 0.9);
      }
    }
  };

  field.pointer = (event) => {
    if (!field.visible || !img) return;
    const r = canvas.getBoundingClientRect();
    const scale = canvas.width / r.width;
    const x = ((event.clientX - r.left) * scale - ox) / cell;
    const y = ((event.clientY - r.top) * scale - oy) / cell;
    if (x < -radius || y < -radius || x > field.cols + radius || y > field.rows + radius) {
      last = null;
      return;
    }
    const p = last || [x, y];
    const steps = Math.max(1, Math.ceil(Math.hypot(x - p[0], y - p[1]) / 1.2));
    for (let s = 1; s <= steps; s += 1) stamp(p[0] + ((x - p[0]) * s) / steps, p[1] + ((y - p[1]) * s) / steps);
    last = [x, y];
    kick();
  };

  if ("ResizeObserver" in window) new ResizeObserver(() => field.resize()).observe(canvas);
  else window.addEventListener("resize", () => field.resize());
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      field.visible = entry.isIntersecting;
      field.dirty = true;
      kick();
    }).observe(canvas);
  }
  field.resize();
  fields.push(field);
  return field;
}

// ---------- Aurora sky on the lamp board (behind the modes) ----------

const skyCss = getComputedStyle(document.documentElement);

function auroraSky(canvas, { strength = 1, ridge = true, ignite = true, phaseOf }) {
  const state = {
    phase: phaseOf(),
    glow: RM || !ignite ? 1 : 0,
    born: performance.now(),
    tint: [...TEAL],
    want: TEAL,
    tintK: 0,
    tintTarget: 0,
    stars: new Float32Array(0),
  };

  const paint = (buf, cols, rows) => {
    if (state.stars.length !== cols * rows) state.stars = Float32Array.from({ length: cols * rows }, Math.random);
    const { phase: ph, tint, tintK } = state;
    const glow = state.glow * strength;
    const top = rows > cols ? 0.26 : 0.4; // portrait screens keep the light above the copy
    for (let x = 0; x < cols; x += 1) {
      const edge = rows * (top + 0.07 * Math.sin(x * 0.045 + ph) + 0.04 * Math.sin(x * 0.13 - ph * 1.6));
      const edge2 = rows * (top * 0.5 + 0.05 * Math.sin(x * 0.06 - ph * 0.7 + 2));
      const fold = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(x * 0.09 + ph * 0.8)) * (0.6 + 0.4 * Math.sin(x * 0.027 - ph * 0.5 + 1.1));
      const fold2 = 0.5 * (0.5 + 0.5 * Math.sin(x * 0.05 + ph * 1.2 + 4)) ** 2;
      // Vertical rays give the curtain its folds.
      const ray = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(x * 0.55 + 2.2 * Math.sin(x * 0.11 + ph) + ph * 1.5)) ** 1.5;
      const hill = ridge ? rows * (0.74 + 0.05 * Math.sin(x * 0.06 + 0.7) + 0.025 * Math.sin(x * 0.17 + 2.1) + 0.012 * Math.sin(x * 0.5)) : rows * 2;
      for (let y = 0; y < rows; y += 1) {
        const i = y * cols + x;
        const p = i * 4;
        const t = y / rows;
        // Night sky, deepest at the top.
        let r = mix(3, 10, Math.min(1, t / 0.6));
        let g = mix(8, 23, Math.min(1, t / 0.6));
        let b = mix(20, 48, Math.min(1, t / 0.6));
        if (y > hill) {
          buf[p] = 3;
          buf[p + 1] = 8;
          buf[p + 2] = 17;
          buf[p + 3] = 1;
          continue;
        }
        const d = edge - y;
        const lit = ray * (d >= 0 ? fold * Math.exp(-d / (rows * (0.06 + 0.14 * ray))) : fold * Math.exp(d / (rows * 0.03)));
        const d2 = edge2 - y;
        const lit2 = d2 >= 0 ? fold2 * Math.exp(-d2 / (rows * 0.12)) : fold2 * Math.exp(d2 / (rows * 0.02));
        // Ordered dither into six bands: the retro lamp look.
        const level = Math.floor(clamp((lit + lit2) * glow * Math.min(1, t / 0.1), 0, 1) * 6 + BAYER[(y & 3) * 4 + (x & 3)]) / 6;
        if (level > 0) {
          const v = clamp(Math.max(d, d2 * 1.6) / (rows * 0.32), 0, 1);
          let cr = v < 0.5 ? mix(TEAL[0], CYAN[0], v * 2) : mix(CYAN[0], VIOLET[0], v * 2 - 1);
          let cg = v < 0.5 ? mix(TEAL[1], CYAN[1], v * 2) : mix(CYAN[1], VIOLET[1], v * 2 - 1);
          let cb = v < 0.5 ? mix(TEAL[2], CYAN[2], v * 2) : mix(CYAN[2], VIOLET[2], v * 2 - 1);
          cr = mix(cr, tint[0], tintK * 0.85);
          cg = mix(cg, tint[1], tintK * 0.85);
          cb = mix(cb, tint[2], tintK * 0.85);
          r += cr * level * 0.85;
          g += cg * level * 0.85;
          b += cb * level * 0.85;
        } else if (state.stars[i] > 0.986 && y < edge) {
          const s = 70 * glow * state.stars[i];
          r += s;
          g += s;
          b += s;
        }
        if (Math.floor(hill) === y) {
          r += 30 * glow;
          g += 60 * glow;
          b += 70 * glow;
        }
        buf[p] = Math.min(255, r);
        buf[p + 1] = Math.min(255, g);
        buf[p + 2] = Math.min(255, b);
        buf[p + 3] = 1;
      }
    }
  };

  const update = (now, field) => {
    let busy = false;
    let repaint = false;
    if (state.glow < 1) {
      const k = clamp((now - state.born) / 1400, 0, 1);
      state.glow = 1 - (1 - k) ** 3; // the aurora ignites once, on load
      repaint = true;
      busy = k < 1;
    }
    if (state.tintK !== state.tintTarget) {
      const step = RM ? 1 : 0.12;
      state.tintK += clamp(state.tintTarget - state.tintK, -step, step);
      if (Math.abs(state.tintK - state.tintTarget) < 0.01) state.tintK = state.tintTarget;
      repaint = true;
      busy = true;
    }
    // Moving between products blends one tint into the next instead of snapping.
    for (let k = 0; k < 3; k += 1) {
      const gap = state.want[k] - state.tint[k];
      if (!gap) continue;
      state.tint[k] = RM || Math.abs(gap) < 2 ? state.want[k] : state.tint[k] + gap * 0.16;
      repaint = true;
      busy = true;
    }
    const phase = RM ? state.phase : phaseOf();
    if (phase !== state.phase && field.visible) {
      state.phase = phase;
      repaint = true;
    }
    if (repaint) field.repaint();
    return busy;
  };

  const field = lampField(canvas, {
    layout: (w, h, dpr) => {
      const cell = Math.round((parseFloat(skyCss.getPropertyValue("--cell")) || 12) * dpr);
      const seam = Math.round((parseFloat(skyCss.getPropertyValue("--seam")) || 3) * dpr);
      return { cols: Math.ceil(w / cell), rows: Math.ceil(h / cell), cell, seam };
    },
    paint,
    seamColor: "#02060e",
    radius: 3,
    decay: 0.88,
    update,
  });
  if (!field) return null;

  return {
    tint(name) {
      const want = name ? TINTS[name] : null;
      if (want) state.want = want;
      state.tintTarget = want ? 1 : 0;
      kick();
    },
  };
}

// ---------- Hero: alpine dawn, in pixels ----------
// Adapted from "alpine dawn" by bas3line (github.com/bas3line/ascii, MIT License,
// Copyright (c) 2026 bas3line; full notice in third-party-notices.txt), drawn as square
// lamps instead of round dots. The range is raymarched once per size, so a frame only
// re-tints it; the lake looks up the picture along each cell's reflected ray. Time runs a
// slow dawn loop: rose first light warms to gold and back over three minutes.

const DAWN_PALETTE = [
  "#0e1430", "#151d40", "#1d2752", "#263365", "#314179", "#3e508c", "#4f62a0", "#6577b3", "#8090c4", "#9eaad3", "#bec6e2",
  "#4b3e6c", "#6a5482", "#8c6a92", "#b0829c", "#cf96a4",
  "#e8a9a8", "#f5bcaa", "#ffd0b0", "#ffe2c2", "#fff1e0", "#fdfaf6",
  "#ffc887", "#f7a965", "#f2a08f", "#e58a87", "#f8b59d", "#d97b7e",
  "#7a4c4a", "#a5654f", "#523a4a",
  "#1b2034", "#262c45", "#363c59",
  "#0a1418", "#0f1f24", "#162a2f", "#203a3c",
  "#a3a7c6", "#c6c3d8", "#e0d4dc",
  "#5a4f7e", "#7b6c9c", "#9a8cb6", "#b8a8c8", "#d8bccb",
].map(hex);
const DAWN_GROUND = hex("#050c1a"); // unlit cells are the page's own night, so the hero meets the page without a seam
const smooth = (a, b, v) => {
  const k = clamp((v - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const hash2 = (x, y) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const noise2 = (x, y, period = 0) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  let x0 = xi;
  let x1 = xi + 1;
  if (period) {
    x0 = ((xi % period) + period) % period;
    x1 = (x0 + 1) % period;
  }
  const a = hash2(x0, yi);
  const b = hash2(x1, yi);
  const c = hash2(x0, yi + 1);
  const d = hash2(x1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm2 = (x, y, octaves, period = 0) => {
  let s = 0;
  let n = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i += 1) {
    s += amp * noise2(x * f, y * f, period * f);
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / n;
};
// Sharp crests where plain noise crosses its middle: rock ribs and couloirs.
const ridged = (x, y, octaves) => {
  let s = 0;
  let n = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i += 1) {
    const v = 1 - Math.abs(2 * noise2(x * f + i * 17.3, y * f) - 1);
    s += amp * v * v;
    n += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return s / n;
};

// The scene lives in the reference's 200 by 100 frame; the hero shows it from further back.
const K = 0.62; // tangent of half the field of view, across 200 columns
const HZ = 56.5; // eye level, in rows
const CAM = 1.5; // camera height above the water
const SHORE_Z = 46; // distance to the far shore
const SHORE = 62; // first row of open water
// Peaks as pyramids, each turned a little, placed by where their summits land on screen:
// [column, row, distance, spread, turn], as the original composes them. The sun sits
// low in the gap between them, clear of every slope.
const SUN = [151, 50];
const PEAKS = [
  [66, 11, 140, 0.95, 0.3],
  [38, 26, 115, 1.1, -0.15],
  [116, 22, 175, 0.9, 0.2],
  [92, 33, 150, 1.0, 0.1],
  [96, 25, 340, 1.1, 0.4],
  [180, 38, 200, 1.5, -0.1],
  [8, 30, 160, 1.2, 0.25],
  // beyond the original frame, so the wider view closes on ridges instead of open sky
  [-26, 34, 160, 1.2, 0.1],
  [224, 36, 190, 1.4, -0.2],
].map(([sx, row, z, f, a]) => {
  const h = CAM + ((HZ - row) / 100) * K * z - 1.5;
  return [((sx - 100) / 100) * K * z, z, h, h * f, Math.cos(a), Math.sin(a)];
});
const HMAX = Math.max(...PEAKS.map(([, , ph]) => ph)) + 5; // nothing stands taller, crags included

function terrain(x, z) {
  let h = 0;
  for (const [px, pz, ph, pr, c, s] of PEAKS) {
    const dx = x - px;
    const dz = z - pz;
    const rx = dx * c - dz * s;
    const rz = dx * s + dz * c;
    const v = ph * (1 - (Math.abs(rx) + Math.abs(rz)) / pr);
    if (v > h) h = v;
  }
  const hills = (1 + 3 * fbm2(x * 0.04, z * 0.04, 3)) * smooth(SHORE_Z, SHORE_Z + 15, z);
  if (hills > h) h = hills;
  // crags, deeper on the high ground
  h += ((ridged(x * 0.06, z * 0.06, 3) - 0.45) * 6 + (ridged(x * 0.2, z * 0.2, 2) - 0.45) * 1.6) * smooth(4, 22, h);
  return h;
}

// Distance along a ray to the terrain beyond the shore, or 0 when it reaches the sky.
function march(u, v, oy) {
  let z = SHORE_Z;
  let prev = z;
  for (let i = 0; i < 260 && z < 520; i += 1) {
    if (v >= 0 && oy + v * z > HMAX) return 0; // climbing past every summit: open sky
    const gap = oy + v * z - terrain(u * z, z);
    if (gap < 0) {
      let a = prev;
      let b = z;
      for (let j = 0; j < 7; j += 1) {
        const m = (a + b) / 2;
        if (oy + v * m - terrain(u * m, m) < 0) b = m;
        else a = m;
      }
      return b;
    }
    prev = z;
    z += Math.max(0.35, gap * 0.45) + z * 0.002;
  }
  return 0;
}

const SUN_DIR = (() => {
  const v = [0.9, 0.3, 0.14];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

function dawnScene(canvas) {
  if (!canvas) return null;

  // Snap a light value to the nearest palette colour, weighting green the way the eye does.
  const lut = new Uint8Array(32768).fill(255);
  const nearest = (r, g, b) => {
    const k = (Math.min(31, (r * 31.99) | 0) << 10) | (Math.min(31, (g * 31.99) | 0) << 5) | Math.min(31, (b * 31.99) | 0);
    if (lut[k] !== 255) return lut[k];
    let best = 0;
    let bd = Infinity;
    DAWN_PALETTE.forEach(([pr, pg, pb], i) => {
      const dr = pr / 255 - r;
      const dg = pg / 255 - g;
      const db = pb / 255 - b;
      const d = 0.3 * dr * dr + 0.5 * dg * dg + 0.2 * db * db;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    lut[k] = best;
    return best;
  };
  // Palette as packed RGBA words for the lamp writer (little-endian: ABGR).
  const pack = ([r, g, b]) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const INK = Uint32Array.from(DAWN_PALETTE, pack);
  const GROUND = pack(DAWN_GROUND);
  const POW = Float32Array.from({ length: 2049 }, (_, i) => (i / 1024) ** 1.1);
  const DITHER = BAYER.map((v) => v - 0.5 / 16 - 0.47); // the original's threshold map, -0.47..0.47

  let W = 0; // the view, in reference cells: one lamp per cell, as the original draws one dot per cell
  let H = 0;
  let X0 = 0; // reference column at the view's left edge
  let Y0 = 0; // reference row at the view's top edge
  let SR = 0; // view rows above the open water
  let lamp = 5; // CSS px per lamp
  let veil = null; // per cell: how far the lamps step back behind the copy
  let depth;
  let alt;
  let sun;
  let snow;
  let up;
  let rim;
  let treeTop;
  let src;
  let fg;
  let fgShade;
  let fgRim;
  let hz;
  let skyR;
  let skyG;
  let skyB;
  let glowA;
  let starAt;
  let FR;
  let FG;
  let FB;
  let floor;
  let fade;
  let wisp;
  const MW = 480;
  const M0 = 36;
  const MR = SHORE + 2 - M0;
  const CW = 640;
  const CR = 34;
  let mist = null;
  let cloud = null;

  let last = 0;
  let t = RM ? 95 : 0;
  let born = performance.now();

  const refX = (x) => X0 + x + 0.5;
  const refY = (r) => Y0 + r + 0.5;

  function* build(cols, rows, sunAt) {
    W = cols;
    H = rows;
    // The whole original frame stands at the bottom of the hero with open sky above it, and
    // the view reaches past its sides: the valley seen from further back. The sun is placed
    // where the copy and the index leave the sky open.
    X0 = Math.round(SUN[0] - sunAt);
    Y0 = 100 - H;
    SR = SHORE - Y0;
    const N = W * H;
    depth = new Float32Array(SR * W);
    alt = new Float32Array(SR * W);
    sun = new Float32Array(SR * W);
    snow = new Float32Array(SR * W);
    up = new Float32Array(SR * W);
    rim = new Uint8Array(SR * W);
    treeTop = new Float32Array(W);
    src = new Float32Array((H - SR) * W);
    fg = new Uint8Array(N);
    fgShade = new Float32Array(N);
    fgRim = new Float32Array(N);
    hz = new Float32Array(N);
    skyR = new Float32Array(SR * W);
    skyG = new Float32Array(SR * W);
    skyB = new Float32Array(SR * W);
    glowA = new Float32Array(SR * W);
    starAt = new Float32Array(SR * W);
    FR = new Float32Array(N);
    FG = new Float32Array(N);
    FB = new Float32Array(N);
    floor = new Float32Array(N);
    fade = new Float32Array(N).fill(1);
    wisp = new Float32Array(W);

    // --- the range, raymarched once ---
    for (let r = Math.max(0, -Y0); r < SR; r += 1) {
      const v = ((HZ - refY(r)) / 100) * K;
      for (let x = 0; x < W; x += 1) {
        const u = ((refX(x) - 100) / 100) * K;
        const z = march(u, v, CAM);
        if (!z) continue;
        const k = r * W + x;
        const px = u * z;
        const py = CAM + v * z;
        const e = 0.35;
        const hx = (terrain(px + e, z) - terrain(px - e, z)) / (2 * e);
        const hzz = (terrain(px, z + e) - terrain(px, z - e)) / (2 * e);
        const nl = Math.hypot(hx, 1, hzz);
        let lit = Math.max(0, (-hx * SUN_DIR[0] + SUN_DIR[1] - hzz * SUN_DIR[2]) / nl);
        if (lit > 0) {
          // cast shadow: walk toward the sun
          for (let s = 0.8; s < 160; s += 0.6 + s * 0.04) {
            const qz = z + SUN_DIR[2] * s;
            if (qz < SHORE_Z) break;
            if (py + SUN_DIR[1] * s + 0.15 < terrain(px + SUN_DIR[0] * s, qz)) {
              lit = 0;
              break;
            }
          }
        }
        depth[k] = z;
        alt[k] = py;
        sun[k] = lit;
        up[k] = 1 / nl;
        const grain = fbm2(px * 0.4, py * 0.25, 2);
        // rock shows through in couloirs running down the fall line
        const gully = ridged(px * 0.22 + z * 0.05, py * 0.045, 2);
        snow[k] = smooth(0.36, 0.52, 1 / nl + 0.3 * (grain - 0.5)) * smooth(5, 11, py + 5 * grain) * (1 - 0.75 * smooth(0.62, 0.85, gully));
      }
      yield;
    }
    // sunlit terrain with open sky directly above: the crest line
    for (let k = W; k < SR * W; k += 1) rim[k] = depth[k] && !depth[k - W] && sun[k] > 0 ? 1 : 0;

    // --- the far shore's treeline ---
    for (let x = 0; x < W; x += 1) treeTop[x] = SHORE - 0.6 - 1.2 * fbm2(refX(x) * 0.06, 2.3, 2);
    for (let tx = X0 - 8; tx < X0 + W + 8; tx += 1.6 + hash2(Math.floor(tx * 9), 7) * 2.2) {
      const tip = SHORE - 2.6 - hash2(Math.floor(tx * 3), 8) * 4 - 1.5 * smooth(60, 0, tx);
      const slope = 1.1 + hash2(Math.floor(tx * 5), 9) * 0.5;
      for (let x = Math.max(0, Math.floor(tx - X0 - 6)); x < Math.min(W, tx - X0 + 6); x += 1) {
        treeTop[x] = Math.min(treeTop[x], tip + Math.abs(refX(x) - tx) * slope);
      }
    }

    // --- the lake: where each cell's reflected ray lands in the picture above ---
    for (let r = SR; r < H; r += 1) {
      const v = ((HZ - refY(r)) / 100) * K;
      for (let x = 0; x < W; x += 1) {
        const u = ((refX(x) - 100) / 100) * K;
        const z = march(u, -v, -CAM);
        const vs = -v - (z ? (2 * CAM) / z : 0);
        let row = HZ - (vs * 100) / K - Y0 - 0.5;
        const mirror = 2 * SR - 1 - r; // the treeline stands on the shore
        if (refY(mirror) >= treeTop[x]) row = mirror;
        src[(r - SR) * W + x] = row;
      }
      yield;
    }

    // --- the near pines and the bank they stand on ---
    const PINES = [[9, 5, 1.15], [20, 38, 0.85], [32, 66, 0.5], [192, 10, 1.15], [181, 40, 0.75], [204, 26, 1]];
    for (let r = 0; r < H; r += 1) {
      const y = refY(r);
      for (let x = 0; x < W; x += 1) {
        const k = r * W + x;
        const xr = refX(x);
        const bankL = 88 + 14 * smooth(0, 52, xr) + 2 * fbm2(xr * 0.2, 1, 2);
        const bankR = 90 + 12 * smooth(200, 160, xr) + 2 * fbm2(xr * 0.2, 4, 2);
        if (y > bankL || y > bankR) {
          fg[k] = 1;
          fgShade[k] = 0.15 * hash2(x, r);
        }
        for (const [px, tip, s] of PINES) {
          const d = y - tip;
          if (d < 0) continue;
          const tier = 3.4 * s;
          const f = d / tier - Math.floor(d / tier);
          const hw = (0.4 + d * 0.2) * (0.5 + 0.5 * f) * (1 + 0.6 * (hash2(Math.floor(y), Math.floor(px) * 7) - 0.5) * smooth(0, 8, d));
          const dx = xr - px;
          if (Math.abs(dx) <= hw) {
            fg[k] = 2;
            // the outline catches the dawn sky: warm on the side facing the sun, cool on the other
            const edge = hw - Math.abs(dx) < 1;
            const sunward = px < SUN[0] ? dx > 0 : dx < 0;
            fgShade[k] = edge ? (sunward ? 1 : 0.5) : 0.3 * hash2(x * 3, r * 5);
            fgRim[k] = edge ? smooth(70, 44, y) * (0.75 + 0.25 * hash2(x, r * 7)) : 0;
          }
        }
      }
      if (r % 16 === 15) yield;
    }

    // --- mist, a wrapping sheet that drifts along the valley; thin high cloud (size-free, made once) ---
    if (!mist) {
      const m = new Float32Array(MW * MR);
      for (let r = 0; r < MR; r += 1) {
        for (let x = 0; x < MW; x += 1) {
          const y = r + M0;
          const q = fbm2(x * 0.0125, y * 0.1, 2, MW * 0.0125);
          m[r * MW + x] = fbm2(x * 0.025 + q * 1.4, y * 0.22 + q, 4, MW * 0.025);
        }
        yield;
      }
      const c = new Float32Array(CW * CR);
      for (let r = 0; r < CR; r += 1) {
        for (let x = 0; x < CW; x += 1) {
          const y = r + 0.5;
          const q = fbm2(x * 0.0125, y * 0.12, 2, 8);
          const v = fbm2(x * 0.025 + q * 2, y * 0.2 + q * 0.8, 4, 16);
          c[r * CW + x] = smooth(0.52, 0.7, v - (0.06 * Math.abs(y - 18)) / 10) * smooth(5, 13, y) * smooth(33, 24, y);
        }
        yield;
      }
      mist = m;
      cloud = c;
    }

    // a faint large-scale unevenness, so the open sky and the deep water never read flat
    for (let r = 0; r < H; r += 1) {
      for (let x = 0; x < W; x += 1) hz[r * W + x] = fbm2(refX(x) * 0.03, refY(r) * 0.06, 3);
      if (r % 32 === 31) yield;
    }

    // the sky's colour at a point, for the sky itself and as haze on the peaks
    for (let r = 0; r < SR; r += 1) {
      const y = refY(r);
      const v = clamp(y / 52, 0, 1);
      for (let x = 0; x < W; x += 1) {
        const k = r * W + x;
        const xr = refX(x);
        const east = smooth(20, 190, xr);
        const ds = Math.hypot(xr - SUN[0], (y - SUN[1]) * 2.2);
        const low = v ** 1.9;
        // indigo overhead, then a pale lilac and rose band behind the range;
        // above the original frame the night is even, so no contours appear
        const veil = (hz[k] - 0.5) * 0.1 * (1 - v) * smooth(-12, 8, y);
        skyR[k] = 0.03 + veil + low * (0.56 + 0.2 * east);
        skyG[k] = 0.04 + veil + low * (0.48 + 0.02 * east);
        skyB[k] = 0.13 + veil * 1.6 + low * (0.62 - 0.12 * east);
        glowA[k] = Math.exp(-ds / 6) * 0.65 + Math.exp(-ds / 15) * 0.2 + Math.exp(-ds / 50) * 0.1;
        // stars, thinning toward the sun and gone where the dawn is bright
        const sy = Math.floor(y);
        if (y < 34 && hash2(Math.floor(xr), sy * 3 + 11) > 0.985) starAt[k] = 1.5 + hash2(Math.floor(xr), sy) * 3 + hash2(sy, Math.floor(xr)) * 100;
      }
    }
  }

  const shade = () => {
    const glow = RM ? 1 : 1 - (1 - clamp((performance.now() - born) / 2000, 0, 1)) ** 3;
    // The dawn loop: rose first light warming to gold and back, never a jump.
    const phase = 0.5 - 0.5 * Math.cos((t / 180) * Math.PI * 2);
    const warm = 0.25 + 0.5 * phase;
    const line = 10 - 4 * phase; // the sunlit line creeps down the slopes
    const drift = t * 1.1;
    const pulse = 1 + 0.06 * Math.sin((t / 8) * Math.PI * 2); // the sun's glow breathes
    for (let x = 0; x < W; x += 1) wisp[x] = noise2((refX(x) + drift * 0.6) * 0.06, 3.7);
    const lg = mix(0.6, 0.8, warm);
    const lb = mix(0.55, 0.4, warm);

    for (let r = 0; r < SR; r += 1) {
      const y = refY(r);
      for (let x = 0; x < W; x += 1) {
        const k = r * W + x;
        const xr = refX(x);
        const gl = glowA[k] * pulse * glow;
        const gg = 0.62 + 0.28 * smooth(0.15, 0.7, gl); // gold at the core, rose further out
        let cr = skyR[k] + gl;
        let cg = skyG[k] + gl * gg;
        let cb = skyB[k] + gl * (gg - 0.22);
        let fl = 0.21 * smooth(-40, 0, y); // the high sky thins out to the page's night
        const z = depth[k];
        if (z) {
          const sn = snow[k];
          const lit = sun[k] * smooth(line, line + 7, alt[k]) * glow;
          const amb = (0.55 + 0.45 * up[k]) * (0.55 + 0.5 * smooth(4, 34, alt[k]));
          // snow: deep blue in shadow, rose to gold in the sun, ending sharply
          const sl = smooth(0.08, 0.24, lit);
          const gold = clamp(0.6 * smooth(0.25, 0.8, lit) + 0.5 * smooth(14, 36, alt[k]), 0, 1);
          const br = 0.78 + 0.3 * lit;
          const sr = mix(0.13 * amb, br, sl);
          const sg = mix(0.17 * amb, mix(lg - 0.12, lg + 0.14, gold) * br, sl);
          const sb = mix(0.36 * amb, mix(lb + 0.02, lb + 0.12, gold) * br, sl);
          // rock: slate in shadow, warm umber in the sun
          cr = mix(mix(0.06, 0.4, sl), sr, sn);
          cg = mix(mix(0.07, 0.2, sl), sg, sn);
          cb = mix(mix(0.14, 0.2, sl), sb, sn);
          // forested foothills
          const wood = smooth(9, 4, alt[k]) * smooth(110, 75, z);
          cr = mix(cr, 0.07, wood);
          cg = mix(cg, 0.09, wood);
          cb = mix(cb, 0.18, wood);
          // distance hazes toward the sky behind; haze settles in the far valleys
          const fog = smooth(16, 3, alt[k]) * smooth(70, 150, z) * 0.6;
          const haze = Math.max(fog, clamp(1 - Math.exp(-(z - SHORE_Z) / 260), 0, 1) * 0.45);
          cr = mix(cr, skyR[k] + gl, haze);
          cg = mix(cg, skyG[k] + gl * gg, haze);
          cb = mix(cb, skyB[k] + gl * (gg - 0.22), haze);
          // the first light catches the crest itself in a bright line
          if (rim[k] && sl > 0.3) {
            cr = mix(cr, 1, sl);
            cg = mix(cg, mix(0.89, 0.95, warm), sl);
            cb = mix(cb, mix(0.76, 0.88, warm), sl);
          }
          // the shadowed range still carries a dim blue screen; the woods drop to near black
          fl = mix(mix(0.42, 0.3, wood), 0.04, sl);
        } else {
          const st = starAt[k];
          if (st) {
            const tw = 0.6 + 0.4 * Math.sin(t * (st % 5) + st);
            const s = tw * smooth(150, 40, xr) * smooth(34, 6, y) * 0.75 * glow;
            cr = Math.max(cr, s * 0.9);
            cg = Math.max(cg, s * 0.92);
            cb = Math.max(cb, s);
          }
          // high cloud, rose-gold toward the sun and mauve away from it
          if (y >= 0 && y < CR) {
            const cy = Math.floor(y);
            const sx = xr + t * 0.8;
            const ix = Math.floor(sx);
            const fx = sx - ix;
            const c0 = cloud[cy * CW + (((ix % CW) + CW) % CW)];
            const c1 = cloud[cy * CW + ((((ix + 1) % CW) + CW) % CW)];
            const c = (c0 + (c1 - c0) * fx) * (0.35 + 0.65 * smooth(40, 150, xr));
            if (c > 0.01) {
              const g = Math.exp(-Math.hypot(xr - SUN[0], (y - SUN[1]) * 1.6) / 55);
              const bb = clamp(0.25 + 0.9 * g, 0, 1);
              cr = mix(cr, mix(0.32, 1, bb), c * 0.75);
              cg = mix(cg, mix(0.24, mix(0.62, 0.74, warm), bb), c * 0.75);
              cb = mix(cb, mix(0.4, 0.5, bb), c * 0.75);
            }
          }
          // the sun, just clearing the ridge
          const ds = Math.hypot(xr - SUN[0], y - SUN[1]);
          if (ds < 4.5) {
            const a = smooth(4.5, 3.3, ds) * glow;
            cr = mix(cr, 1, a);
            cg = mix(cg, 0.96, a);
            cb = mix(cb, 0.86, a);
          }
        }
        // mist pooled in the valley behind the shore, lit rose toward the sun
        const e = smooth(20, 170, xr) * (0.6 + 0.4 * warm);
        const near = Math.exp(-Math.abs(xr - SUN[0]) / 22) * 0.3;
        const mr = mix(0.48, 0.9, e) + near;
        const mg = mix(0.46, 0.7, e) + near * 0.75;
        const mb = 0.7 + near * 0.5;
        if (y >= M0) {
          const m = mist[Math.min(MR - 1, Math.floor(y - M0)) * MW + (((Math.floor(xr + drift) % MW) + MW) % MW)];
          // a ragged top edge: the sheet heaves in long swells and small tufts
          const edge = 5 * (m - 0.5) + 4 * (wisp[x] - 0.5);
          const a = (0.3 + 0.7 * smooth(0.32, 0.64, m)) * smooth(M0 + 14, SHORE - 3, y + edge) * 0.6;
          cr = mix(cr, mr, a);
          cg = mix(cg, mg, a);
          cb = mix(cb, mb, a);
          if (a > 0.05) fl = Math.max(fl, 0.2);
        }
        if (y >= treeTop[x]) {
          // the far shore's pines, dark against the mist, low wisps at their feet
          const s = 0.4 + 0.6 * hash2(x * 7, r * 3);
          cr = 0.04 + 0.03 * s;
          cg = 0.06 + 0.04 * s;
          cb = 0.1 + 0.05 * s;
          fl = 0;
          const m = mist[clamp(Math.floor(y - M0), 0, MR - 1) * MW + (((Math.floor(xr * 0.7 + drift * 1.9 + 211) % MW) + MW) % MW)];
          const a = smooth(0.45, 0.72, m) * smooth(treeTop[x] + 1, SHORE, y) * 0.6;
          cr = mix(cr, mr, a);
          cg = mix(cg, mg, a);
          cb = mix(cb, mb, a);
        }
        FR[k] = cr;
        FG[k] = cg;
        FB[k] = cb;
        floor[k] = fl;
      }
    }

    // the lake: the picture above, shaken a little by slow ripples
    const LR = H - SR;
    for (let r = SR; r < H; r += 1) {
      const y = refY(r);
      const d = (r - SR) / LR;
      for (let x = 0; x < W; x += 1) {
        const k = r * W + x;
        const xr = refX(x);
        const w1 = noise2(xr * 0.045 + t * 0.06, y * 0.5 - t * 0.35);
        const w2 = noise2(xr * 0.12 - t * 0.1, y * 1.1 - t * 0.7);
        const sway = (w1 - 0.5) * (0.4 + 1.4 * d) + (w2 - 0.5) * 0.5;
        const sx = clamp(Math.round(x + sway), 0, W - 1);
        const sr = clamp(Math.round(src[(r - SR) * W + x] + (w2 - 0.5) * 0.6 * d), 0, SR - 1);
        const sk = sr * W + sx;
        const refl = 0.68 - 0.32 * d;
        const w3 = noise2(xr * 0.03 + t * 0.04, y * 1.9 - t * 0.45);
        const lift = 1 + (w3 - 0.5) * (0.4 + 0.5 * d); // long, faint ripple lines
        // the water gives back a little less colour than it was sent
        const ar = FR[sk];
        const ag = FG[sk];
        const ab = FB[sk];
        const grey = (ar + ag + ab) / 3;
        const deep = (hz[k] - 0.5) * 0.1 * d;
        let cr = 0.02 + deep + mix(grey, ar, 0.75) * refl * lift;
        let cg = 0.035 + deep + mix(grey, ag, 0.75) * refl * lift;
        let cb = 0.07 + deep * 1.6 + mix(grey, ab, 0.75) * refl * lift;
        // the sun's road
        const roadW = 1.5 + (y - SHORE) * 0.45;
        const glint = smooth(0.55, 0.85, w2) * Math.exp(-(((xr - SUN[0]) / roadW) ** 2)) * (0.5 + 0.5 * warm) * glow;
        cr += glint;
        cg += glint * 0.8;
        cb += glint * 0.6;
        FR[k] = cr;
        FG[k] = cg;
        FB[k] = cb;
        floor[k] = 0.26;
        fade[k] = smooth(H + 2, H - 22, r);
        if (r === SR) {
          // a dark seam where the shore meets the water
          FR[k] = 0.06;
          FG[k] = 0.12;
          FB[k] = 0.14;
          floor[k] = 0;
        }
      }
    }

    // the near pines and the bank, black against it all, rimmed on the sun side
    for (let k = 0; k < W * H; k += 1) {
      if (!fg[k]) continue;
      const s = fgShade[k];
      FR[k] = 0.02 + 0.05 * s;
      FG[k] = 0.04 + 0.06 * s;
      FB[k] = 0.05 + 0.06 * s;
      floor[k] = 0;
      const e = fgRim[k];
      if (e > 0 && s === 1) {
        FR[k] = mix(FR[k], 0.62, e);
        FG[k] = mix(FG[k], 0.4, e);
        FB[k] = mix(FB[k], 0.38, e);
        floor[k] = 0.12 * e;
      } else if (e > 0 && s === 0.5) {
        FR[k] = mix(FR[k], 0.2, e);
        FG[k] = mix(FG[k], 0.22, e);
        FB[k] = mix(FB[k], 0.36, e);
        floor[k] = 0.22 * e;
      }
      fade[k] = 1;
    }
  };

  // Every cell becomes a square lamp: its size is its brightness in four ordered-dither
  // steps, its colour the palette entry nearest its hue. This is the original's halftone,
  // drawn as pixels: dark ground between the lamps is what makes the light read as light.
  const SIZES = [0, 0, 0, 0]; // lamp edge per step, set from the lamp pitch
  const COVER = [0, 0.3, 0.6, 1];
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const hero = canvas.parentElement;
  let img = null;
  let px32 = null;

  const lampsOut = () => {
    const pitch = lamp;
    const rowStride = W * pitch;
    px32.fill(GROUND);
    for (let r = 0; r < H; r += 1) {
      for (let x = 0; x < W; x += 1) {
        const k = r * W + x;
        const cr = FR[k];
        const cg = FG[k];
        const cb = FB[k];
        const fl = floor[k];
        const peak = Math.max(cr, cg, cb, 1e-4);
        const level = clamp(fl + (1 - fl) * POW[Math.min(2048, (peak * 1024) | 0)], 0, 1) * fade[k] * veil[k];
        const step = clamp(Math.round(level * 3 + DITHER[(r & 3) * 4 + (x & 3)]), 0, 3);
        if (!step) continue;
        const want = Math.min(1, (level + 0.06) / COVER[step]);
        // dim cells keep some darkness in the colour too, so shadows sit back in deep blues
        const s = ((0.3 + 0.7 * want) * mix(0.5, 1, smooth(0.08, 0.5, peak))) / peak;
        const ink = INK[nearest(clamp(cr * s, 0, 1), clamp(cg * s, 0, 1), clamp(cb * s, 0, 1))];
        const size = SIZES[step];
        const o = (pitch - 1 - size) >> 1; // centred, with a one-pixel seam on the right and bottom
        let p = (r * pitch + o) * rowStride + x * pitch + o;
        for (let j = 0; j < size; j += 1, p += rowStride) px32.fill(ink, p, p + size);
      }
    }
  };

  let size = "";
  let building = null;
  let pending = null;
  const field = { visible: true, dirty: true, pointer() {} };

  field.resize = () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    if (!w || !h) return;
    const portrait = h > w;
    lamp = w >= 1000 ? 5 : 4;
    SIZES[1] = lamp - 3;
    SIZES[2] = lamp - 2;
    SIZES[3] = lamp - 1;
    const cols = Math.ceil(w / lamp);
    const rows = Math.ceil(h / lamp);
    // The sun rises in the open sky between the copy and the index (or right of centre on phones).
    const box = hero.getBoundingClientRect();
    const copy = hero.querySelector(".hero-copy");
    const panel = hero.querySelector(".lab-index");
    let at = w * (portrait ? 0.66 : 0.68);
    if (!portrait && copy) {
      const range = document.createRange();
      const inkRight = (el) => {
        range.selectNodeContents(el);
        return range.getBoundingClientRect().right;
      };
      const right = Math.max(...[...copy.querySelectorAll("h1, .lede, .actions > *, .command")].map(inkRight)) - box.left;
      const left = panel?.offsetParent ? panel.getBoundingClientRect().left - box.left : w;
      if (left - right > 60) at = right + (left - right) * 0.55;
    }
    const sunAt = Math.round(at / lamp);
    // Behind the smaller copy the lamps step back: fewer and smaller, never greyed, so the text reads
    // over the scene while the colours stay pure.
    const top = h - rows * lamp;
    // [box, how far the lamps step back]: nearly clear night behind the copy, a lighter
    // thinning behind the index so the valley still shows through it.
    const boxes = [
      ...(copy ? [...copy.querySelectorAll(".lede, .actions, .command")].map((el) => [el.getBoundingClientRect(), 0.7]) : []),
      ...(panel?.offsetParent ? [[panel.getBoundingClientRect(), 0.4]] : []),
    ];
    const key = `${cols}x${rows}:${sunAt}:${boxes.map(([b]) => [b.left, b.top, b.right, b.bottom].map(Math.round)).join("/")}`;
    if (key === size) return;
    size = key;
    Object.assign(canvas.style, {
      width: `${cols * lamp}px`,
      height: `${rows * lamp}px`,
      left: `${Math.floor((w - cols * lamp) / 2)}px`,
      top: `${h - rows * lamp}px`,
    });
    // The raymarch runs a slice per frame, so the page never stalls; the finished scene fades in.
    veil = new Float32Array(cols * rows).fill(1);
    const soft = 9; // cells of falloff around each text block
    for (const [b, depthOf] of boxes) {
      const x0 = (b.left - box.left) / lamp;
      const x1 = (b.right - box.left) / lamp;
      const y0 = (b.top - box.top - top) / lamp;
      const y1 = (b.bottom - box.top - top) / lamp;
      for (let r = Math.max(0, Math.floor(y0 - soft)); r < Math.min(rows, Math.ceil(y1 + soft)); r += 1) {
        for (let x = Math.max(0, Math.floor(x0 - soft)); x < Math.min(cols, Math.ceil(x1 + soft)); x += 1) {
          const dx = Math.max(x0 - x, 0, x - x1);
          const dy = Math.max(y0 - r, 0, r - y1);
          const k = r * cols + x;
          veil[k] = Math.min(veil[k], 1 - depthOf * smooth(soft, 0, Math.hypot(dx, dy)));
        }
      }
    }
    building = build(cols, rows, sunAt);
    img = null;
    canvas.classList.remove("is-ready");
    pending = [cols, rows];
    kick();
  };

  const advance = (now) => {
    if (RM || !field.visible) return false;
    if (now - last < 15) return true; // at most ~60 fps, even on fast displays
    last = now;
    t = (now - born) / 1000;
    field.dirty = true;
    return true;
  };

  field.frame = (now) => {
    if (building) {
      const stop = performance.now() + 10;
      while (performance.now() < stop) {
        if (building.next().done) {
          building = null;
          const [cols, rows] = pending;
          canvas.width = cols * lamp;
          canvas.height = rows * lamp;
          img = ctx.createImageData(canvas.width, canvas.height);
          px32 = new Uint32Array(img.data.buffer);
          born = performance.now() - (RM ? 0 : t * 1000);
          field.dirty = true;
          requestAnimationFrame(() => canvas.classList.add("is-ready"));
          break;
        }
      }
      if (building) return true;
    }
    const busy = advance(now);
    if (field.visible && field.dirty && img) {
      shade();
      lampsOut();
      ctx.putImageData(img, 0, 0);
      field.dirty = false;
    }
    return busy;
  };

  // Rebuilding raymarches the range, so a window being dragged waits until it settles.
  let resizeTimer = 0;
  const later = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(field.resize, 150);
  };
  if ("ResizeObserver" in window) new ResizeObserver(later).observe(hero);
  else window.addEventListener("resize", later);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      field.visible = entry.isIntersecting;
      kick();
    }).observe(hero);
  }
  fields.push(field);
  // Measure the copy once its web fonts have landed, so the range is built only once.
  (document.fonts?.ready ?? Promise.resolve()).then(field.resize);
  return field;
}

let productSky = null;

function setupSkies() {
  dawnScene(document.querySelector(".hero .hero-field"));

  // Behind the product stack, a dimmer sky takes the colour of the product in view.
  const productCanvas = document.querySelector(".products-field");
  if (productCanvas) {
    productSky = auroraSky(productCanvas, {
      strength: 1.15,
      ridge: false,
      ignite: false,
      phaseOf: () => 2.4 + window.scrollY * 0.0012,
    });
  }
}

// ---------- Lamp glyphs: numerals and the footer wordmark ----------

const FONT = {
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12], A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15],
  L: [16, 16, 16, 16, 16, 16, 31], O: [14, 17, 17, 17, 17, 17, 14], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  U: [17, 17, 17, 17, 17, 17, 14], " ": [0, 0, 0, 0, 0, 0, 0],
};

function setupGlyphs() {
  for (const el of document.querySelectorAll(".glyph[data-glyph]")) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    el.append(canvas);
    const pad = el.classList.contains("glyph-index") ? 0 : 1;
    const tint = TINTS[el.dataset.tint];
    let lines = [];
    let on = new Uint8Array(0);

    const field = lampField(canvas, {
      layout: (w, h) => {
        const text = el.dataset.glyph.toUpperCase();
        lines = NARROW.matches && el.classList.contains("glyph-wordmark") ? text.split(" ") : [text];
        const cols = Math.max(...lines.map((l) => l.length)) * 6 - 1 + pad * 2;
        const rows = lines.length * 8 - 1 + pad * 2;
        const cell = Math.max(2, Math.floor(Math.min(w / cols, h / rows)));
        on = new Uint8Array(cols * rows);
        lines.forEach((line, li) => {
          [...line].forEach((ch, ci) => {
            (FONT[ch] ?? FONT[" "]).forEach((bits, ry) => {
              for (let bx = 0; bx < 5; bx += 1) {
                if (bits & (16 >> bx)) on[(pad + li * 8 + ry) * cols + pad + ci * 6 + bx] = 1;
              }
            });
          });
        });
        return { cols, rows, cell, seam: Math.max(1, Math.round(cell * 0.16)) };
      },
      paint: (buf, cols, rows) => {
        for (let y = 0; y < rows; y += 1) {
          for (let x = 0; x < cols; x += 1) {
            const i = y * cols + x;
            const v = x / Math.max(1, cols - 1);
            const c = tint ?? (v < 0.5 ? TEAL.map((t, k) => mix(t, CYAN[k], v * 2)) : CYAN.map((t, k) => mix(t, VIOLET[k], v * 2 - 1)));
            buf[i * 4] = c[0];
            buf[i * 4 + 1] = c[1];
            buf[i * 4 + 2] = c[2];
            buf[i * 4 + 3] = on[i] ? 1 : 0.08;
          }
        }
      },
      radius: 2.2,
      decay: 0.9,
    });
    if (field) el.classList.add("is-drawn");
  }
}

// ---------- Forge art: a smith's hammer swinging onto the anvil ----------
// Watch mode as repetition: every reset, one strike. The hammer arcs down around the grip,
// strikes, throws sparks and swings back up while the card is on screen.

function setupForgeArt() {
  const el = document.querySelector('.glyph[data-art="forge"]');
  if (!el) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  el.append(canvas);
  const tint = TINTS[el.dataset.tint] ?? TEAL;
  const STEEL = hex("#a9bfd0");
  const GRIP = hex("#5f7488");
  const SPARK = hex("#ffe2a8");
  const cols = 40;
  const rows = 31;
  const PIVOT = [36, 16]; // the smith's grip
  const RAISED = 52; // degrees above the strike
  const SPARKS = [[15, 19], [13, 17], [11, 19], [14, 14], [9, 16], [26, 19], [28, 16], [30, 19], [27, 13]];
  let angle = RM ? 0 : RAISED;
  let sparks = RM;

  const draw = () => {
    const on = new Uint8Array(cols * rows); // 0 off, 1 anvil, 2 head, 3 spark, 4 handle
    const row = (y, x0, x1) => {
      for (let x = x0; x <= x1; x += 1) on[y * cols + x] = 1;
    };
    // Anvil: horn to the left, face, waist and foot.
    row(21, 1, 31);
    row(22, 5, 31);
    row(23, 8, 30);
    row(24, 13, 25);
    row(25, 13, 25);
    row(26, 11, 27);
    row(27, 11, 27);
    row(28, 9, 29);
    row(29, 9, 29);
    // Hammer: rasterise the handle and head rotated about the grip.
    const a = (angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const dx = x + 0.5 - PIVOT[0];
        const dy = y + 0.5 - PIVOT[1];
        const u = dx * cos + dy * sin; // along the handle (negative = toward the head)
        const v = -dx * sin + dy * cos; // across the handle (positive = striking face)
        if (u >= -17.6 && u <= -12.4 && v >= -2.4 && v <= 4.9) on[y * cols + x] = 2;
        else if (u >= -12.4 && u <= 1 && Math.abs(v) <= 0.85) on[y * cols + x] = 4;
      }
    }
    if (sparks) for (const [x, y] of SPARKS) if (!on[y * cols + x]) on[y * cols + x] = 3;
    return on;
  };

  const field = lampField(canvas, {
    layout: (w, h) => {
      const cell = Math.max(2, Math.floor(Math.min(w / cols, h / rows)));
      return { cols, rows, cell, seam: Math.max(1, Math.round(cell * 0.16)) };
    },
    paint: (buf) => {
      const on = draw();
      for (let i = 0; i < on.length; i += 1) {
        const c = [null, tint, STEEL, SPARK, GRIP][on[i]] ?? tint;
        buf[i * 4] = c[0];
        buf[i * 4 + 1] = c[1];
        buf[i * 4 + 2] = c[2];
        buf[i * 4 + 3] = on[i] ? 1 : 0; // off lamps stay clear so the art sits on the panel's own lamp board
      }
    },
    radius: 2.4,
    decay: 0.9,
    update: (now, f) => {
      if (RM || !f.visible) return false;
      // 2.2 s cycle: hold high, accelerate down the arc, ring on impact, ease back up.
      const t = (now % 2200) / 2200;
      let next = RAISED;
      if (t >= 0.4 && t < 0.55) next = RAISED * (1 - ((t - 0.4) / 0.15) ** 2);
      else if (t >= 0.55 && t < 0.68) next = 0;
      else if (t >= 0.68) next = RAISED * (1 - (1 - (t - 0.68) / 0.32) ** 3);
      next = Math.round(next);
      const spark = t >= 0.55 && t < 0.64;
      if (next !== angle || spark !== sparks) {
        angle = next;
        sparks = spark;
        f.repaint();
      }
      return true;
    },
  });
  if (field) el.classList.add("is-drawn");
}

// ---------- Scroll story ----------

const nav = document.querySelector(".site-header");
const navLinks = [...document.querySelectorAll(".nav-links a[data-section]")];
const sections = navLinks.map((a) => document.getElementById(a.dataset.section));
const heroInner = document.querySelector(".hero-inner");
const cards = [...document.querySelectorAll(".stack .card")];
const page = document.querySelector(".page");
const footer = document.querySelector(".site-footer");
const mark = document.querySelector(".wordmark-wrap");

// The statement lights word by word as it scrolls through its pinned stage.
const statements = [...document.querySelectorAll(".statement")].map((section) => {
  const words = [];
  const walk = (node, hot) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1) {
        walk(child, hot || child.tagName === "EM");
        continue;
      }
      if (child.nodeType !== 3) continue;
      const frag = document.createDocumentFragment();
      for (const part of child.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.append(part);
          continue;
        }
        const w = document.createElement("span");
        w.className = hot ? "w hot" : "w";
        w.textContent = part;
        words.push(w);
        frag.append(w);
      }
      child.replaceWith(frag);
    }
  };
  const p = section.querySelector("p");
  if (p) walk(p, false);
  return { section, words, lit: -1 };
});

function onScroll() {
  const y = window.scrollY;
  const vh = window.innerHeight;

  if (nav) {
    nav.classList.toggle("is-scrolled", y > 24);
    const probe = nav.offsetHeight + 8;
    navLinks.forEach((link, i) => {
      const r = sections[i]?.getBoundingClientRect();
      link.classList.toggle("is-current", Boolean(r && r.top <= probe && r.bottom > probe));
    });
  }

  if (heroInner && !RM) {
    const k = clamp(y / (vh * 0.6), 0, 1);
    heroInner.style.transform = k < 1 ? `translate3d(0, ${(y * 0.32).toFixed(1)}px, 0)` : "";
    heroInner.style.opacity = (1 - k).toFixed(3);
  }

  for (const st of statements) {
    const r = st.section.getBoundingClientRect();
    const progress = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
    const lit = RM ? st.words.length : Math.floor(progress * 1.12 * st.words.length);
    if (lit !== st.lit) {
      st.words.forEach((w, i) => w.classList.toggle("lit", i < lit));
      st.lit = lit;
    }
  }

  // The product sky follows whichever card is in view.
  if (productSky && cards.length) {
    let active = null;
    for (const card of cards) if (card.getBoundingClientRect().top < vh * 0.55) active = card;
    const r = cards[0].parentElement.getBoundingClientRect();
    productSky.tint(active && r.bottom > vh * 0.3 ? active.dataset.tint : null);
  }

  // Each product card recedes as the next one slides over it.
  const stacking = !RM && !NARROW.matches;
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    let cover = 0;
    if (stacking && next) {
      const a = card.getBoundingClientRect();
      cover = clamp((a.bottom - next.getBoundingClientRect().top) / a.height, 0, 1);
    }
    card.style.transform = cover ? `scale(${(1 - cover * 0.05).toFixed(4)})` : "";
    card.style.filter = cover ? `brightness(${(1 - cover * 0.3).toFixed(3)})` : "";
  });

  // The page lifts off the footer; the wordmark rises into place.
  if (page && footer && mark) {
    const t = clamp((vh - page.getBoundingClientRect().bottom) / footer.offsetHeight, 0, 1);
    const k = RM || NARROW.matches ? 1 : clamp((t - 0.3) / 0.5, 0, 1);
    mark.style.opacity = k.toFixed(3);
    mark.style.transform = k < 1 ? `translate3d(0, ${((1 - k) * 40).toFixed(1)}px, 0)` : "";
  }
}

// ---------- Pointer: lamp heat and the card flashlight ----------

function setupPointer() {
  if (!FINE || RM) return;
  document.addEventListener(
    "pointermove",
    (event) => {
      for (const field of fields) field.pointer(event);
      const surface = event.target.closest?.(".glow");
      if (!surface) return;
      const r = surface.getBoundingClientRect();
      surface.style.setProperty("--mx", `${event.clientX - r.left}px`);
      surface.style.setProperty("--my", `${event.clientY - r.top}px`);
    },
    { passive: true },
  );
}

// ---------- Schedule timeline: one lamp per hour ----------

function setupTimeline() {
  for (const row of document.querySelectorAll(".tl-row[data-hours]")) {
    row.innerHTML = [...row.dataset.hours].map((c) => `<i class="${c === "." ? "" : c}"></i>`).join("");
  }
}

// ---------- Copy buttons ----------

function setupCopy() {
  const buttons = [...document.querySelectorAll(".copy[data-copy-from]")];
  const status = document.querySelector(".copy-status");
  if (!navigator.clipboard) {
    for (const button of buttons) button.remove();
    return;
  }
  for (const button of buttons) {
    const label = button.textContent;
    let resetTimer = 0;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(document.getElementById(button.dataset.copyFrom).textContent.trim());
        button.textContent = "Copied";
        button.dataset.copied = "";
        if (status) status.textContent = "Command copied.";
      } catch {
        button.textContent = "Copy failed";
        if (status) status.textContent = "Couldn't copy. Select the command and copy it manually.";
      }
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        button.textContent = label;
        delete button.dataset.copied;
        if (status) status.textContent = "";
      }, 2200);
    });
  }
}

setupSkies();
setupGlyphs();
setupForgeArt();
setupPointer();
setupTimeline();
setupCopy();
window.addEventListener("scroll", kick, { passive: true });
window.addEventListener("resize", () => {
  lastY = -1;
  kick();
});
NARROW.addEventListener?.("change", () => {
  for (const field of fields) field.resize();
});
kick();
