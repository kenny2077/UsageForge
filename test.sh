#!/usr/bin/env bash
# Mock test: fake `claude`/`codex` on PATH, fake HOME. Spends no quota, installs nothing.
set -eu
ROOT=$(mktemp -d); trap 'rm -rf "$ROOT"' EXIT
T="$ROOT/with space"   # every path has a space in it
S="$T/home/.codex/sessions/2026/01/01"
mkdir -p "$T/bin" "$T/home/.codex/sessions"
FUTURE=$(( $(date +%s) + 9999 )); WEEK=$(( $(date +%s) + 99999 ))

# Fake claude: emits a rate_limit_event like `claude -p --output-format stream-json`.
# $T/claude.mode = ok | rejected
cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$1" = --help ] && { echo "  --safe-mode"; exit 0; }
echo x >>"$T/claude.calls"
echo '{"type":"system","subtype":"init"}'
if [ "\$(cat "$T/claude.mode" 2>/dev/null)" = rejected ]; then
  echo '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","rateLimitType":"seven_day","resetsAt":$WEEK}}'; exit 1
fi
echo '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","rateLimitType":"five_hour","resetsAt":$FUTURE}}'
EOF
# Fake codex: writes a session log with a fresh 5h window like real Codex does.
# $T/codex.mode = ok | fail | nolog
cat >"$T/bin/codex" <<EOF
#!/bin/sh
[ "\$2" = --help ] && exit 0
echo x >>"$T/codex.calls"
mode=\$(cat "$T/codex.mode" 2>/dev/null)
[ "\$mode" = fail ] && exit 1
[ "\$mode" = nolog ] && exit 0
mkdir -p "$S"
echo '{"payload":{"rate_limits":{"primary":{"resets_at":$FUTURE},"secondary":{"used_percent":10,"resets_at":$WEEK}}}}' >"$S/rollout-new.jsonl"
EOF
chmod +x "$T/bin/"*

lk() { HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" UF_TOOLS="claude codex" UF_RETRY_DELAY=0 UF_JITTER=0 ./usageforge "$@" >/dev/null; }
calls() { cat "$T/$1.calls" 2>/dev/null | wc -l | tr -d ' '; }
check() { [ "$(calls claude) $(calls codex)" = "$1" ] || { echo "FAIL: $2 (calls: $(calls claude) $(calls codex), want $1)"; exit 1; }; }

mkdir -p "$T/state"; echo null >"$T/state/claude.reset"   # garbage state + empty Codex sessions dir
lk tick;  check "1 1" "first tick should ping both"
[ "$(cat "$T/state/claude.reset")" = "$FUTURE" ] || { echo "FAIL: claude reset not parsed"; exit 1; }
lk tick;  check "1 1" "second tick should be a no-op"
echo 1 >"$T/state/claude.reset"
lk tick;  check "2 1" "should re-ping claude only"

echo rejected >"$T/claude.mode"; echo 1 >"$T/state/claude.reset"
lk tick;  check "3 1" "rejected ping should not retry"
[ "$(cat "$T/state/claude.reset")" = "$WEEK" ] || { echo "FAIL: rejected ping should wait for resetsAt"; exit 1; }
lk tick;  check "3 1" "should wait for weekly reset"

echo fail >"$T/codex.mode"; echo 1 >"$T/state/codex.reset"
echo '{"payload":{"rate_limits":{"primary":{"resets_at":1}}}}' >"$S/rollout-new.jsonl"
lk tick;  check "3 4" "failed codex ping should retry 3x"
lk tick;  check "3 4" "failed codex ping should back off"

echo '{"payload":{"rate_limits":{"primary":{"resets_at":1},"secondary":{"used_percent":100,"resets_at":'$WEEK'}}}}' >"$S/rollout-new.jsonl"
rm "$T/state/codex.backoff"
lk tick;  check "3 4" "codex weekly cap hit should not ping"

# Unreadable Codex logs must not mean "ping every tick": our own last ping is the floor.
echo nolog >"$T/codex.mode"; rm -rf "$T/home/.codex/sessions"; mkdir -p "$T/home/.codex/sessions"
lk tick;  check "3 5" "codex with no logs should ping once"
lk tick;  check "3 5" "codex with no logs should not ping again"

# A run already in progress (lock held) makes the next one a no-op.
echo 1 >"$T/state/codex.reset"; mkdir "$T/state/lock"
lk tick;  check "3 5" "locked tick should do nothing"
rmdir "$T/state/lock"

! lk schedule 25:00 || { echo "FAIL: bad time accepted"; exit 1; }
if [ "$(uname)" = Darwin ]; then   # plist must stay valid even with XML-special chars in paths
  printf '#!/bin/sh\nexit 0\n' >"$T/bin/launchctl"; chmod +x "$T/bin/launchctl"
  HOME="$T/home" PATH="$T/bin:$PATH" UF_TOOLS=claude UF_STATE="$T/a&b<c" CODEX_HOME="$T/x&y" ./usageforge schedule 06:00 7:30 >/dev/null
  plutil -lint -s "$T/home/Library/LaunchAgents/dev.usageforge.plist" || { echo "FAIL: bad plist"; exit 1; }
  grep -q CODEX_HOME "$T/home/Library/LaunchAgents/dev.usageforge.plist" || { echo "FAIL: CODEX_HOME not kept"; exit 1; }
  [ -x "$T/a&b<c/usageforge" ] || { echo "FAIL: script not copied"; exit 1; }
  ! HOME="$T/home" PATH="$T/bin:$PATH" UF_TOOLS=" " ./usageforge watch >/dev/null 2>&1 || { echo "FAIL: installed with no tools"; exit 1; }
fi
echo PASS
