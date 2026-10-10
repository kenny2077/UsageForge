"""Alpine dawn in text: the product page's hero, for the terminal and the panel's guide.

The frames come from "alpine dawn" by bas3line (ascii.rest, MIT License; notice in
docs/third-party-notices.txt), baked by bake-dawn.mjs: each cell of its 200 by 100 picture is
a palette colour and a dot, drawn as the original draws it, with " ·•●". A terminal character
is twice as tall as it is wide, so one character holds two cells, stacked: the bigger dot wins.
"""
import sys
import zlib
from functools import lru_cache
from pathlib import Path

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
GROUND = "#090c18"
W, H = 200, 100
DOTS = " ·•●"
RIGHT = 165  # a narrow view ends just past the sun
TOP, HORIZON = 6, 56  # where the peaks start, and the far shore


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


@lru_cache(maxsize=1)
def frames():
    raw = zlib.decompress((Path(__file__).parent / "dawn.bin").read_bytes())
    return [raw[i:i + W * H] for i in range(0, len(raw), W * H)]


def view(cols, lines):
    """The part of the picture that fits: x from, and source rows from/to, two per line."""
    cols, lines = min(cols, W), min(lines, H // 2)
    x0 = max(0, min(W - cols, RIGHT - cols))
    # From the peaks down, cut at the bottom where the lake fades; short views drop the summits instead.
    y0 = min(H - 2 * lines, max(TOP, HORIZON + 10 - 2 * lines))
    return x0, cols, y0, lines


@lru_cache(maxsize=None)
def cells(cols, lines, f=0):
    """Frame f, cropped to cols by lines: rows of (dot, palette index or None)."""
    data = frames()[f]
    x0, cols, y0, lines = view(cols, lines)
    out = []
    for r in range(lines):
        top, bottom = (y0 + 2 * r) * W, (y0 + 2 * r + 1) * W
        row = []
        for x in range(x0, x0 + cols):
            v = max(data[top + x], data[bottom + x], key=lambda v: v & 3)
            row.append((DOTS[v & 3], v >> 2 if v & 3 else None))
        out.append(row)
    return out


def sgr(hexc, bg=False, truecolor=True):
    """The escape-code parameters for a colour: 24-bit, or the nearest of the 256-colour cube."""
    c = rgb(hexc)
    if truecolor:
        return f"{48 if bg else 38};2;{c[0]};{c[1]};{c[2]}"
    lv = [0, 95, 135, 175, 215, 255]
    i = 16 + sum(m * min(range(6), key=lambda j: abs(lv[j] - c[k])) for k, m in enumerate((36, 6, 1)))
    return f"{48 if bg else 38};5;{i}"


def ansi(cols, lines, f=0, truecolor=True, indent="  "):
    """Frame f as terminal text on the scene's own night ground."""
    inks = [sgr(h, truecolor=truecolor) for h in PALETTE]
    out = []
    for row in cells(cols, lines, f):
        line, last = [f"{indent}\x1b[{sgr(GROUND, True, truecolor)}m"], None
        for dot, ink in row:
            if ink is not None and ink != last:
                line.append(f"\x1b[{inks[ink]}m")
                last = ink
            line.append(dot)
        out.append("".join(line) + "\x1b[0m")
    return "\n".join(out) + "\n"


def markup(f=0, lines=36):
    """Frame f, full width, as HTML for a <pre>: each run of one colour is one span."""
    out = []
    for row in cells(W, lines, f):
        line, run, last = [], "", None
        for dot, ink in row:
            if ink is not None and ink != last:
                line.append(f'<i style="color:{PALETTE[last]}">{run}</i>' if last is not None else run)
                run, last = "", ink
            run += dot
        line.append(f'<i style="color:{PALETTE[last]}">{run}</i>' if last is not None else run)
        out.append("".join(line))
    return "\n".join(out)  # only spaces and dots: nothing to escape


if __name__ == "__main__":  # python3 ui/dawn.py [cols] [lines] [frame]
    a = [int(v) for v in sys.argv[1:4]]
    sys.stdout.write(ansi(*(a + [200, 50][len(a):2])))
