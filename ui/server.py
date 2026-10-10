#!/usr/bin/env python3
"""UsageForge control panel: a tiny local web server around the `usageforge` script.

Binds 127.0.0.1 only. Every API call must carry this run's random token and a localhost
Host header, so other websites can't drive it (CSRF) or reach it by DNS rebinding.
Usage: python3 ui/server.py /path/to/usageforge [--port 4517] [--no-open]
"""
import errno
import filecmp
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import textwrap
import time
import webbrowser
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
CLI = sys.argv[1] if len(sys.argv) > 1 else str(HERE.parent / "usageforge")
PORT = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 4517
STATE = Path(os.environ.get("UF_STATE") or Path.home() / ".local/state/usageforge").resolve()
ASSETS = (HERE.parent / "docs" / "assets").resolve()
TOKEN = secrets.token_urlsafe(24)
sys.path.insert(0, str(HERE))
import dawn  # noqa: E402
TYPES = {".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png"}
# The tools' own app icons, read from the apps you have installed (nothing is bundled).
ICONS = {
    "claude": "/Applications/Claude.app/Contents/Resources/electron.icns",
    "codex": "/Applications/ChatGPT.app/Contents/Resources/icon-codex-dark-color.png",
}

TIME = re.compile(r"^([01]?\d|2[0-3]):[0-5]\d$")
MODEL = re.compile(r"^[A-Za-z0-9._-]{0,64}$")
TOOLS = ("claude", "codex")


def clean_prompt(p):
    p = str(p or "").strip()[:500]
    if p.startswith("-") or any(ord(c) < 32 and c != "\n" for c in p):
        raise ValueError("prompt can't start with '-' or contain control characters")
    return p


def clean_tool(c):
    """Validate one tool's settings from the browser."""
    if c.get("mode") not in ("off", "schedule", "watch"):
        raise ValueError("mode must be off, schedule or watch")
    times = sorted({"%02d:%02d" % tuple(map(int, t.split(":"))) for t in c.get("times", [])
                    if isinstance(t, str) and TIME.match(t)})[:12]
    days = sorted({d for d in c.get("days", []) if type(d) is int and 0 <= d <= 6}) or list(range(7))
    model = str(c.get("model") or "")
    if not MODEL.match(model):
        raise ValueError("model may only use letters, digits, '.', '_' and '-'")
    return {"mode": c["mode"], "times": times, "days": days, "prompt": clean_prompt(c.get("prompt")), "model": model}


def cli(*args, env=None, timeout=420):
    return subprocess.run([CLI, *args], capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "UF_STATE": str(STATE), **(env or {})})


def icon(tool):
    """PNG of the tool's app icon, converted once with macOS `sips` and cached; None if unavailable."""
    src = ICONS.get(tool)
    if not src or not Path(src).is_file():
        return None
    cache = STATE / "icons" / f"{tool}.png"
    if not cache.is_file():
        cache.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["sips", "-s", "format", "png", "-Z", "128", src, "--out", str(cache)], capture_output=True)
    return cache.read_bytes() if cache.is_file() else None


@lru_cache(maxsize=1)
def dawn_frames():
    return json.dumps({"frames": [dawn.markup(f) for f in range(len(dawn.frames()))]}).encode()


def hello(url):
    """What `usageforge ui` prints: the dawn coming up, then the setup check, in the panel's colours."""
    if not sys.stdout.isatty() or os.environ.get("NO_COLOR") or os.environ.get("TERM") == "dumb":
        return print(f"UsageForge control panel: {url}  (Ctrl+C to quit)")
    true = os.environ.get("COLORTERM") in ("truecolor", "24bit")

    # The terminal's own named colours, so the text reads on light and dark themes alike.
    def ink(code, text):
        return f"\x1b[{code}m{text}\x1b[0m"
    TITLE, ACCENT, OK, WARN, BAD, MUTED = "1", "1;33", "36", "33", "31", "2"

    # As much of the picture as fits. With room it stays on screen above the setup check;
    # in a short window the check scrolls it up, after it has played.
    size = shutil.get_terminal_size()
    room = size.lines - 24
    cols, lines = min(dawn.W, size.columns - 4), min(dawn.H // 2 - 3, room if room >= 18 else size.lines - 2)
    if cols >= 60 and lines >= 12:
        # About a second of the lake moving, then it holds still.
        shots = [dawn.ansi(cols, lines, f, true) for f in range(len(dawn.frames()))]
        for i, shot in enumerate(shots):
            if i:
                sys.stdout.write(f"\x1b[{lines}A")
            sys.stdout.write(shot)
            sys.stdout.flush()
            time.sleep(1 / 15)
    print()
    print("  " + ink(TITLE, "UsageForge") + ink(MUTED, "  starts your 5-hour window on your schedule"))
    print()
    print("  " + ink(ACCENT, "Setup"))
    for line in cli("doctor", timeout=60).stdout.splitlines()[1:]:
        mark = line.strip()[:1]
        if line.startswith("  "):
            print("    " + ink({"✓": OK, "!": WARN, "✗": BAD}.get(mark, "0"), mark) + line.strip()[1:])
        elif line.startswith(("All good", "Fix the")):
            print("  " + ink("1;" + (OK if line.startswith("All") else BAD), line))
        elif line.startswith("Tip"):
            print(ink(MUTED, textwrap.fill(line, size.columns - 2, initial_indent="  ", subsequent_indent="  ")))
        else:
            print("  " + ink(TITLE, line))
    print()
    print("  " + ink(ACCENT, "Panel") + "  " + ink("1;" + OK, url) + ink(MUTED, "  opening in your browser"))
    print("  " + ink(MUTED, "New here? The panel starts with a short guide. Ctrl+C closes the panel;"))
    print("  " + ink(MUTED, "the background check keeps running without it."))
    print()


def status():
    return json.loads(cli("status", "--json", timeout=60).stdout)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # keep the terminal quiet
        pass

    def reply(self, code, body=b"", ctype="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; "
                         "img-src 'self' data:; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def local(self):
        return self.headers.get("Host") in (f"127.0.0.1:{PORT}", f"localhost:{PORT}")

    def authed(self):
        return self.local() and secrets.compare_digest(self.headers.get("X-UF-Token", ""), TOKEN)

    def do_GET(self):
        path = self.path.split("?")[0]
        if not self.local():
            return self.reply(403)
        if path == "/":
            html = (HERE / "index.html").read_text().replace("__UF_TOKEN__", TOKEN)
            return self.reply(200, html.encode(), "text/html; charset=utf-8")
        if path.startswith("/assets/"):
            f = (ASSETS / path[len("/assets/"):]).resolve()
            if ASSETS in f.parents and f.is_file() and f.suffix in TYPES:
                return self.reply(200, f.read_bytes(), TYPES[f.suffix])
        if path == "/dawn.json":
            return self.reply(200, dawn_frames())
        if path.startswith("/icons/") and path.endswith(".png"):
            png = icon(path[len("/icons/"):-len(".png")])
            if png:
                return self.reply(200, png, "image/png")
        if path == "/api/status" and self.authed():
            return self.reply(200, status())
        if path == "/api/doctor" and self.authed():
            out = cli("doctor", timeout=60).stdout
            return self.reply(200, {"problems": [l.strip()[2:] for l in out.splitlines() if l.strip().startswith("✗")]})
        self.reply(404)

    def do_POST(self):
        if not self.authed():
            return self.reply(403, {"error": "forbidden"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 65536:
                raise ValueError("request too large")
            body = json.loads(self.rfile.read(length) or b"{}")
            if self.path == "/api/config":
                config = {t: clean_tool(body[t]) for t in TOOLS if t in body}
                notes = body.get("notify") or {}
                config["notify"] = {k: notes[k] for k in ("started", "problems", "weekly") if type(notes.get(k)) is bool}
                STATE.mkdir(parents=True, exist_ok=True)
                tmp = STATE / "config.json.tmp"
                tmp.write_text(json.dumps(config, indent=2))
                tmp.chmod(0o600)
                tmp.replace(STATE / "config.json")
                # The 5-minute check runs while any tool has a mode; it stops when both are off.
                on = any(config[t]["mode"] != "off" for t in TOOLS if t in config)
                installed = STATE / "usageforge"
                stale = on and not (installed.is_file() and filecmp.cmp(CLI, installed, shallow=False))
                if on != status()["running"] or stale:
                    r = cli("start" if on else "stop", timeout=60)
                    if r.returncode:
                        raise ValueError(r.stderr.strip() or "couldn't change the background check")
                return self.reply(200, status())
            if self.path == "/api/notify-test":
                cli("notify-test", timeout=30)
                return self.reply(200, {"ok": True})
            if self.path == "/api/ping":
                tool = body.get("tool")
                if tool not in TOOLS:
                    raise ValueError("tool must be claude or codex")
                env = {"UF_RETRY_DELAY": "0"}
                if body.get("prompt"):
                    env["UF_PROMPT"] = clean_prompt(body["prompt"])
                r = cli("ping", tool, env=env)
                return self.reply(200, {"ok": r.returncode == 0, "output": r.stdout.strip(), "status": status()})
            self.reply(404, {"error": "not found"})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError, subprocess.TimeoutExpired) as e:
            self.reply(400, {"error": str(e) or e.__class__.__name__})


if __name__ == "__main__":
    url = f"http://127.0.0.1:{PORT}/"
    try:
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        if e.errno != errno.EADDRINUSE:
            raise
        # A panel is already running (another terminal, or one left open): just show it.
        print(f"UsageForge control panel is already running: {url}")
        if "--no-open" not in sys.argv:
            webbrowser.open(url)
        sys.exit(0)
    hello(url)
    if "--no-open" not in sys.argv:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
