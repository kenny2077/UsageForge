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

// ---------- Aurora sky on the lamp board (hero and products) ----------

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

let productSky = null;

function setupSkies() {
  const heroCanvas = document.querySelector(".hero .hero-field");
  if (heroCanvas) {
    let heroPhase = 0.6;
    const hero = auroraSky(heroCanvas, {
      phaseOf: () => {
        if (window.scrollY < window.innerHeight * 1.3) heroPhase = 0.6 + window.scrollY * 0.0026;
        return heroPhase;
      },
    });
    // Pointing at a product in the lab index re-tints the sky, product by product.
    const index = document.querySelector(".lab-index");
    for (const link of document.querySelectorAll(".lab-index a[data-tint]")) {
      link.addEventListener("pointerenter", () => hero?.tint(link.dataset.tint));
      link.addEventListener("focus", () => hero?.tint(link.dataset.tint));
      link.addEventListener("blur", () => hero?.tint(null));
    }
    index?.addEventListener("pointerleave", () => hero?.tint(null));
  }

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
