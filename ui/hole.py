"""A black hole in pixels, for the terminal: what `usageforge ui` shows while the panel starts.

The same light paths as the panel's sky, which adapts "black hole" by ascii.rest (MIT; see
docs/third-party-notices.txt): rays bent round a Schwarzschild hole cross a turning disk of gas.
Each terminal cell is two pixels (upper half block), so pixels are square. Distances are in
Schwarzschild radii.
"""
import math
import sys
from functools import lru_cache

D, IN, OUT, TILT, LOOP, BANDS, SPIN = 30, 3, 12, 0.16, 60, 10, 7
BMAX, NB, H = OUT + 4, 320, 0.03
CRIT = 1.5 * math.sqrt(3)
SPAN = 0.2  # half the picture's height, as a tangent
VOID = (6, 8, 13)
DISK = [(91, 48, 54), (134, 70, 63), (180, 95, 77), (214, 131, 92), (238, 165, 102), (247, 194, 127), (255, 220, 168), (255, 242, 218)]
ICE, STAR = (207, 226, 255), (96, 108, 140)


def rand(seed=17):
    a = seed
    while True:
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((a ^ (a >> 15)) * (1 | a)) & 0xFFFFFFFF
        t = (t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF)) & 0xFFFFFFFF ^ t
        yield ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


@lru_cache(maxsize=1)
def paths():
    """u = 1/r along each ray's path, by impact parameter: u'' = 1.5u^2 - u, stepped with RK4."""
    f = lambda u: 1.5 * u * u - u  # noqa: E731
    table = []
    for n in range(NB):
        b = (n + 0.5) / NB * BMAX
        u, w = 1 / D, math.sqrt(max(0.0, 1 - (b / D) ** 2)) / b
        us = [u]
        while u < 1 and (u > 1 / (OUT + 1) or w > 0) and len(us) < 1500:
            k1, l1 = w, f(u)
            k2, l2 = w + H / 2 * l1, f(u + H / 2 * k1)
            k3, l3 = w + H / 2 * l2, f(u + H / 2 * k2)
            k4, l4 = w + H * l3, f(u + H * k3)
            u += H / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
            w += H / 6 * (l1 + 2 * l2 + 2 * l3 + l4)
            us.append(u)
        table.append(us)
    return table


@lru_cache(maxsize=4)
def scene(w, h):
    """Per pixel: the disk crossings (band, fraction, angle, weight), the photon ring, and a star."""
    table, r = paths(), rand()
    bands = []
    for b in range(BANDS):
        rad = IN + (OUT - IN) * b / (BANDS - 1)
        turns = max(1, round(SPIN * (IN / rad) ** 1.5))
        waves = [(k, next(r) * 6.283, (0.5 + next(r)) / math.sqrt(k)) for k in (2, 3, 5, 8, 13)]
        tab = [sum(a * math.sin(k * 2 * math.pi * i / 256 + p) for k, p, a in waves) for i in range(256)]
        lo, hi = min(tab), max(tab)
        bands.append(([0.4 + 0.6 * (v - lo) / (hi - lo) for v in tab], turns))
    cw, s, c = 2 * SPAN / h, math.sin(TILT), math.cos(TILT)
    px = []
    for j in range(h):
        y = (h * 0.5 - j - 0.5) * cw
        for i in range(w):
            x = (i + 0.5 - w * 0.5) * cw
            n = math.hypot(x, y, 1)
            d = (x / n, (y * c - s) / n, (y * s + c) / n)
            o = d[1] * s - d[2] * c
            side = math.sqrt(1 - o * o)
            e2 = (d[0] / side, (d[1] - o * s) / side, (d[2] + o * c) / side)
            b = D * side
            hits, falls = [], False
            if b < BMAX:
                us = table[min(NB - 1, int(b * NB / BMAX))]
                falls = us[-1] >= 1
                end, light = min((len(us) - 1) * H, 5.6), 1.0
                a = (math.atan2(-s, e2[1]) + 2 * math.pi) % math.pi
                while a < end:
                    p = a / H
                    q = int(p)
                    rr = 1 / (us[q] + (us[q + 1] - us[q]) * (p - q))
                    if IN < rr < OUT:
                        phi = math.atan2(math.sin(a) * e2[2] - math.cos(a) * c, math.sin(a) * e2[0])
                        edge = min(1, (rr - IN) / 0.7) * (1 - ((rr - IN) / (OUT - IN)) ** 2)
                        pos = (rr - IN) / (OUT - IN) * (BANDS - 1)
                        b0 = min(BANDS - 2, int(pos))
                        hits.append((b0, pos - b0, phi, light * edge * (1 - 0.55 * math.cos(phi)) * (IN / rr) ** 1.2))
                        light *= 0.45
                    a += math.pi
            star = not hits and not falls and next(r) < 0.04
            px.append((hits, abs(b - CRIT) < 0.5 * cw * D, star))  # the photon ring, one pixel wide
    return bands, px


def pixels(w, h, t=0.0):
    """Rows of (r, g, b) at t seconds."""
    bands, px = scene(w, h)
    turn = 2 * math.pi * (t % LOOP) / LOOP

    def gas(b, a):
        tab, turns = bands[b]
        return tab[int((a - turns * turn) / (2 * math.pi) * 256) % 256]

    out = []
    for hits, ring, star in px:
        v = sum(wt * (gas(b, phi) + (gas(b + 1, phi) - gas(b, phi)) * fr) for b, fr, phi, wt in hits)
        v = min(1.0, max(0.0, v * 1.7 - 0.03) / 0.97) ** 0.7
        out.append(ICE if ring and v < 0.6 else DISK[min(7, int(v * 8))] if v > 0.06 else STAR if star else VOID)
    return [out[y * w:(y + 1) * w] for y in range(h)]


def _cube(c):
    lv = [0, 95, 135, 175, 215, 255]
    return 16 + sum(36 // 6 ** i * min(range(6), key=lambda j: abs(lv[j] - c[i])) for i in range(3))


def sgr(c, truecolor=True, bg=False):
    return f"{48 if bg else 38};" + (f"2;{c[0]};{c[1]};{c[2]}" if truecolor else f"5;{_cube(c)}")


def ansi(w, h, t=0.0, truecolor=True, indent="  "):
    """The picture as terminal text: each cell is two pixels (upper half block). h must be even."""
    px = pixels(w, h, t)
    lines = []
    for y in range(0, h, 2):
        cells = "".join(f"\x1b[{sgr(a, truecolor)};{sgr(b, truecolor, True)}m▀" for a, b in zip(px[y], px[y + 1]))
        lines.append(f"{indent}{cells}\x1b[0m")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":  # python3 ui/hole.py [w] [h]
    a = [int(v) for v in sys.argv[1:3]]
    sys.stdout.write(ansi(*(a + [64, 28][len(a):])))
