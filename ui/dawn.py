"""Alpine dawn in pixels: the product page's hero, small enough for a terminal.

One scene, three uses: the art `usageforge ui` prints, the picture in the panel's welcome
guide (/dawn.png) and the menu-bar app's icon. Colours snap to the product page's dawn palette
(from its adaptation of "alpine dawn" by bas3line, MIT; see docs/third-party-notices.txt).
t runs from night (0) to dawn (1).
"""
import math
import struct
import zlib

PALETTE = [
    "#0e1430", "#151d40", "#1d2752", "#263365", "#314179", "#3e508c", "#4f62a0", "#6577b3", "#8090c4", "#9eaad3", "#bec6e2",
    "#4b3e6c", "#6a5482", "#8c6a92", "#b0829c", "#cf96a4",
    "#e8a9a8", "#f5bcaa", "#ffd0b0", "#ffe2c2", "#fff1e0", "#fdfaf6",
    "#ffc887", "#f7a965", "#f2a08f", "#e58a87", "#f8b59d", "#d97b7e",
    "#7a4c4a", "#a5654f", "#523a4a",
    "#1b2034", "#262c45", "#363c59",
    "#0a1418", "#0f1f24", "#162a2f", "#203a3c",
    "#a3a7c6", "#c6c3d8", "#e0d4dc",
    "#5a4f7e", "#7b6c9c", "#9a8cb6", "#b8a8c8", "#d8bccb",
]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


PAL = [rgb(h) for h in PALETTE]
HORIZON = 0.62
SUN_U = 0.79
# (centre, height above the horizon, half-width), in fractions of the picture
FAR = [(0.10, 0.30, 0.17), (0.33, 0.44, 0.15), (0.53, 0.33, 0.12), (0.67, 0.22, 0.10), (0.97, 0.30, 0.15)]
NEAR = [(0.0, 0.19, 0.22), (0.24, 0.13, 0.15), (0.44, 0.08, 0.16), (0.92, 0.15, 0.18)]
SKY_DAWN = [rgb(h) for h in ("#0e1430", "#263365", "#6a5482", "#cf96a4", "#f5bcaa", "#ffd0b0")]
SKY_NIGHT = [rgb(h) for h in ("#0e1430", "#151d40", "#1d2752", "#263365", "#314179", "#3e508c")]


def mix(a, b, k):
    k = min(1.0, max(0.0, k))
    return tuple(a[i] + (b[i] - a[i]) * k for i in range(3))


def nearest(c):
    """The palette colour closest to c, weighting green the way the eye does."""
    r, g, b = c
    return min(PAL, key=lambda p: 2 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 3 * (p[2] - b) ** 2)


def hash2(x, y):
    h = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h ^ (h >> 16)) / 4294967296


def noise(x):
    i = math.floor(x)
    f = x - i
    f = f * f * (3 - 2 * f)
    return hash2(i, 7) * (1 - f) + hash2(i + 1, 7) * f


def ridge(peaks, u, seed):
    base = max(h * max(0.0, 1 - abs(u - c) / w) for c, h, w in peaks)
    return base + 0.022 * (noise(u * 26 + seed) - 0.5) + 0.01 * (noise(u * 70 + seed) - 0.5)


def gradient(stops, k):
    k = min(0.999, max(0.0, k)) * (len(stops) - 1)
    i = int(k)
    return mix(stops[i], stops[i + 1], k - i)


def land(u, v, t, aspect, px):
    """Colour of the scene above the waterline at (u, v)."""
    near, far = HORIZON - ridge(NEAR, u, 40), HORIZON - ridge(FAR, u, 0)
    if v >= near:
        rim = v - near < px and (u - SUN_U) * (ridge(NEAR, u + 0.01, 40) - ridge(NEAR, u - 0.01, 40)) > 0
        return mix(rgb("#1b2034"), rgb("#7a4c4a"), t * 0.8) if rim else rgb("#1b2034")
    if v >= far:
        # Flanks that face the sun catch the light; the top of each peak holds snow.
        lit = (u - SUN_U) * (ridge(FAR, u + 0.01, 0) - ridge(FAR, u - 0.01, 0)) > 0
        depth = (v - far) / max(0.02, HORIZON - far)
        if ridge(FAR, u, 0) > 0.17 and depth < 0.28:
            snow = mix(rgb("#c6c3d8"), rgb("#ffd0b0"), t) if lit else mix(rgb("#4f62a0"), rgb("#9a8cb6"), t)
            return snow
        rock = mix(rgb("#363c59"), rgb("#7b6c9c"), t) if lit else mix(rgb("#262c45"), rgb("#4b3e6c"), t)
        return mix(rock, rgb("#1b2034"), depth * 0.9)
    k = v / HORIZON
    sky = mix(gradient(SKY_NIGHT, k), gradient(SKY_DAWN, k), t)
    sun_v = HORIZON + 0.05 - 0.16 * t
    d = math.hypot((u - SUN_U) * aspect, v - sun_v)
    if d < 0.055 and t > 0.15:
        return rgb("#fff1e0")
    sky = mix(sky, rgb("#ffe2c2"), t * math.exp(-d * 9) * 0.9)
    return sky


def pixels(w, h, t=1.0):
    """Rows of (r, g, b): the scene at w by h pixels."""
    aspect, px = w / h, 1.5 / h
    rows = []
    for y in range(h):
        v = (y + 0.5) / h
        row = []
        for x in range(w):
            u = (x + 0.5) / w
            if v < HORIZON:
                c = land(u, v, t, aspect, px)
                k = v / HORIZON
                if hash2(x, y) > 0.975 and k < 0.6 and math.hypot((u - SUN_U) * aspect, v - HORIZON) > 0.35 * t + 0.1:
                    c = mix(c, rgb("#bec6e2"), 1 - 0.75 * t)  # stars, fading as it gets light
            else:
                # The lake: the scene mirrored, a little wavy, darker with distance from the shore.
                depth = (v - HORIZON) / (1 - HORIZON)
                wave = math.sin(y * 2.3) * (0.004 + 0.01 * depth)
                c = land(u + wave, 2 * HORIZON - v, t, aspect, px)
                c = mix(c, rgb("#151d40"), 0.3 + 0.5 * depth)
                if abs(u - SUN_U) * aspect < 0.025 + 0.06 * depth and hash2(x, y) > 0.6 and t > 0.3:
                    c = mix(c, rgb("#ffc887"), 0.8 * t)  # glitter under the sun
                if y == math.ceil(HORIZON * h):
                    c = rgb("#0a1418")  # the shoreline
            row.append(nearest(c))
        rows.append(row)
    return rows


def _cube(c):
    lv = [0, 95, 135, 175, 215, 255]
    return 16 + sum(36 // 6 ** i * min(range(6), key=lambda j: abs(lv[j] - c[i])) for i in range(3))


def ansi(w, h, t=1.0, truecolor=True, indent="  "):
    """The scene as terminal text: each cell is two pixels (upper half block). h must be even."""
    px = pixels(w, h, t)

    def fg(c):
        return f"38;2;{c[0]};{c[1]};{c[2]}" if truecolor else f"38;5;{_cube(c)}"

    lines = []
    for y in range(0, h, 2):
        cells = "".join(f"\x1b[{fg(a)};{fg(b).replace('38;', '48;', 1)}m▀" for a, b in zip(px[y], px[y + 1]))
        lines.append(f"{indent}{cells}\x1b[0m")
    return "\n".join(lines) + "\n"


def png(w, h, t=1.0, scale=1):
    """The scene as a PNG, each pixel a scale by scale square."""
    raw = b"".join(
        b"\0" + bytes(v for c in row for _ in range(scale) for v in c)
        for row in pixels(w, h, t) for _ in range(scale))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w * scale, h * scale, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    import sys
    if sys.argv[1:2] == ["png"]:  # python3 ui/dawn.py png W H SCALE > out.png
        w, h, s = map(int, sys.argv[2:5])
        sys.stdout.buffer.write(png(w, h, 1.0, s))
    else:
        sys.stdout.write(ansi(64, 28))
