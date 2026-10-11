"""The black hole in pixels, for the terminal: what `usageforge ui` shows while the panel starts.

The same piece as the panel's sky (docs/assets/black-hole.gif, the author's "gargantua"),
baked by bake-hole.sh into 12 frames of 64 by 36 pixels. Each terminal cell is two pixels
(upper half block), so pixels are square.
"""
import sys
import zlib
from functools import lru_cache
from pathlib import Path

W, H = 64, 36


@lru_cache(maxsize=1)
def frames():
    raw = zlib.decompress((Path(__file__).parent / "hole.bin").read_bytes())
    size = W * H * 3
    return [raw[i:i + size] for i in range(0, len(raw), size)]


def pixels(f=0):
    """Rows of (r, g, b) for frame f."""
    d = frames()[f % len(frames())]
    return [[tuple(d[(y * W + x) * 3:(y * W + x) * 3 + 3]) for x in range(W)] for y in range(H)]


def _cube(c):
    lv = [0, 95, 135, 175, 215, 255]
    return 16 + sum(36 // 6 ** i * min(range(6), key=lambda j: abs(lv[j] - c[i])) for i in range(3))


def sgr(c, truecolor=True, bg=False):
    return f"{48 if bg else 38};" + (f"2;{c[0]};{c[1]};{c[2]}" if truecolor else f"5;{_cube(c)}")


def ansi(f=0, truecolor=True, indent="  "):
    """Frame f as terminal text: H // 2 lines of W cells."""
    px = pixels(f)
    lines = []
    for y in range(0, H, 2):
        cells = "".join(f"\x1b[{sgr(a, truecolor)};{sgr(b, truecolor, True)}m▀" for a, b in zip(px[y], px[y + 1]))
        lines.append(f"{indent}{cells}\x1b[0m")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":  # python3 ui/hole.py [frame]
    sys.stdout.write(ansi(int(sys.argv[1]) if sys.argv[1:] else 0))
