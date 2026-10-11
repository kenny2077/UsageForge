#!/bin/bash
# Bakes the terminal's black hole (ui/hole.bin) from the panel's: 12 frames of
# docs/assets/black-hole.gif, cropped to the hole, as 64x36 RGB. Needs ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/.."
ffmpeg -loglevel error -i docs/assets/black-hole.gif \
  -vf "select='lt(n,12)',crop=1120:630:240:133,scale=64:36:flags=area,eq=contrast=1.3:gamma=1.5:saturation=1.25" \
  -fps_mode passthrough -f rawvideo -pix_fmt rgb24 - |
  python3 -c "import sys, zlib; sys.stdout.buffer.write(zlib.compress(sys.stdin.buffer.read(), 9))" >ui/hole.bin
