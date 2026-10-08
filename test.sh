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
[ "\$2" = /usage ] && exit 0
echo x >>"$T/claude.calls"
printf '%s' "\$2" >"$T/claude.prompt"
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
printf '#!/bin/sh\necho "$@" >>"%s/notes"\n' "$T" >"$T/bin/osascript"   # never pop real notifications
chmod +x "$T/bin/"*

lk() { HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" UF_TOOLS="claude codex" UF_RETRY_DELAY=0 UF_JITTER=0 ./usageforge "$@" >/dev/null; }
calls() { cat "$T/$1.calls" 2>/dev/null | wc -l | tr -d ' '; }
check() { [ "$(calls claude) $(calls codex)" = "$1" ] || { echo "FAIL: $2 (calls: $(calls claude) $(calls codex), want $1)"; exit 1; }; }

mkdir -p "$T/state"; echo null >"$T/state/claude.reset"   # garbage state + empty Codex sessions dir
cfg() { echo "$1" >"$T/state/config.json"; }
cfg '{"claude":{"mode":"watch"},"codex":{"mode":"watch"}}'
lk tick;  check "1 1" "first tick should ping both"
[ "$(cat "$T/state/claude.reset")" = "$FUTURE" ] || { echo "FAIL: claude reset not parsed"; exit 1; }
[ "$(cat "$T/state/codex.reset")" = "$FUTURE" ] || { echo "FAIL: codex reset should come from its log, not now+5h"; exit 1; }
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

# Schedule mode: fire once per slot, only on the chosen days, with the saved prompt.
echo ok >"$T/codex.mode"; rm -f "$T/claude.mode" "$T/state/claude.last"
echo 1 >"$T/state/claude.reset"   # no window open
past=$(date -v-1M +%H:%M 2>/dev/null || date -d '-1 min' +%H:%M)
future=$(date -v+2H +%H:%M 2>/dev/null || date -d '+2 hour' +%H:%M)
cfg '{"claude":{"mode":"schedule","times":["'$future'"]},"codex":{"mode":"off"}}'
lk tick;  check "3 5" "future slot should not fire"
if [ "$past" != 23:59 ]; then
  cfg '{"claude":{"mode":"schedule","times":["'$past'"],"days":['$(( ($(date +%w) + 1) % 7 ))']},"codex":{"mode":"off"}}'
  lk tick;  check "3 5" "slot on another weekday should not fire"
  cfg '{"claude":{"mode":"schedule","times":["'$past'","'$future'"],"days":['$(date +%w)'],"prompt":"Hello forge"},"codex":{"mode":"off"}}'
  echo $(( $(date +%s) + 600 )) >"$T/state/claude.reset"
  lk tick;  check "3 5" "slot should wait while a window is still open"
  echo 1 >"$T/state/claude.reset"
  lk tick;  check "4 5" "past slot today should fire once"
  [ "$(cat "$T/claude.prompt")" = "Hello forge" ] || { echo "FAIL: saved prompt not used"; exit 1; }
  lk tick;  check "4 5" "slot should not fire twice"
fi
# A rejection without a reset time must not mean "ping every tick".
cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$1" = --help ] && exit 0
echo '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected"}}'; exit 1
EOF
! lk ping claude || { echo "FAIL: rejected ping should exit non-zero"; exit 1; }
[ "$(cat "$T/state/claude.reset")" -gt "$(date +%s)" ] || { echo "FAIL: rejected ping without resetsAt"; exit 1; }
cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$1" = --help ] && exit 0
printf '%s' "\$2" >"$T/claude.prompt"
EOF
UF_PROMPT="One-off" lk ping claude
[ "$(cat "$T/claude.prompt")" = "One-off" ] || { echo "FAIL: UF_PROMPT not used"; exit 1; }
HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e '.tools.claude.installed and (.config.claude.mode == "schedule")' >/dev/null ||
  { echo "FAIL: status --json"; exit 1; }

# Notifications: problems once per 6 h, "window started" only when switched on, never for manual pings.
if [ "$(uname)" = Darwin ]; then
  rm -f "$T/notes"
  notes() { cat "$T/notes" 2>/dev/null | wc -l | tr -d ' '; }
  printf '#!/bin/sh\nexit 1\n' >"$T/bin/claude"
  lk ping claude || true; lk ping claude || true
  [ "$(notes)" = 1 ] || { echo "FAIL: failure should notify exactly once (got $(notes))"; exit 1; }
  cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$1" = --help ] && exit 0
[ "\$2" = /usage ] && exit 0
[ "\$1" = auth ] && { echo '{"loggedIn":true}'; exit 0; }
echo '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","unifiedWindows":{"five_hour":{"resetsAt":$FUTURE},"seven_day":{"utilization":0.95}}}}'
EOF
  rm -f "$T/state/claude.backoff"; echo 1 >"$T/state/claude.reset"
  cfg '{"claude":{"mode":"watch"},"codex":{"mode":"off"},"notify":{"started":true}}'
  lk tick
  grep -q "new window" "$T/notes" || { echo "FAIL: started notification missing"; exit 1; }
  grep -q "95% of this week" "$T/notes" || { echo "FAIL: weekly notification missing"; exit 1; }
  before=$(notes); lk ping claude
  [ "$(notes)" = "$before" ] || { echo "FAIL: manual ping should not notify"; exit 1; }
  HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge doctor | grep -q "signed in" || { echo "FAIL: doctor"; exit 1; }
  cfg '{"claude":{"mode":"schedule","times":[]}}'
  ! HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge doctor >/dev/null || { echo "FAIL: doctor should flag no times"; exit 1; }
fi

# Live Claude usage from `claude -p /usage` (sends no message): numbers and the real reset time.
# Real reports say is_active:false even while the 5h window is open, so it must not be trusted.
R=$(( $(date +%s) + 3000 ))
cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$2" = /usage ] || exit 1
echo '{"type":"assistant","usage_report":{"rate_limits":{"limits":[{"kind":"session","percent":40,"resets_at":"$(date -u -r $R +%Y-%m-%dT%H:%M:%S.123456+00:00 2>/dev/null || date -u -d @$R +%Y-%m-%dT%H:%M:%S.123456+00:00)","is_active":false},{"kind":"weekly_all","percent":70,"resets_at":"2030-01-01T00:00:00+00:00"}]}}}'
EOF
rm -f "$T/state/claude.limits"
HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e '.tools.claude.five_hour == 40 and .tools.claude.weekly == 70' >/dev/null ||
  { echo "FAIL: /usage numbers"; exit 1; }
[ "$(cat "$T/state/claude.reset")" = "$R" ] || { echo "FAIL: /usage reset time ($(cat "$T/state/claude.reset") vs $R)"; exit 1; }

! lk schedule 25:00 || { echo "FAIL: bad time accepted"; exit 1; }
if [ "$(uname)" = Darwin ]; then   # plist must stay valid even with XML-special chars in paths
  printf '#!/bin/sh\nexit 0\n' >"$T/bin/launchctl"; chmod +x "$T/bin/launchctl"
  HOME="$T/home" PATH="$T/bin:$PATH" UF_TOOLS=claude UF_STATE="$T/a&b<c" CODEX_HOME="$T/x&y" ./usageforge schedule 06:00 7:30 >/dev/null
  plutil -lint -s "$T/home/Library/LaunchAgents/dev.usageforge.plist" || { echo "FAIL: bad plist"; exit 1; }
  jq -e '.claude.mode == "schedule" and .claude.times == ["06:00","7:30"]' "$T/a&b<c/config.json" >/dev/null || { echo "FAIL: schedule not saved"; exit 1; }
  grep -q CODEX_HOME "$T/home/Library/LaunchAgents/dev.usageforge.plist" || { echo "FAIL: CODEX_HOME not kept"; exit 1; }
  [ -x "$T/a&b<c/usageforge" ] || { echo "FAIL: script not copied"; exit 1; }
  ! HOME="$T/home" PATH="$T/bin:$PATH" UF_TOOLS=" " ./usageforge watch >/dev/null 2>&1 || { echo "FAIL: installed with no tools"; exit 1; }
fi
# A second `usageforge ui` must open the running panel, not crash on the busy port.
python3 ui/server.py ./usageforge --no-open --port 4598 >/dev/null 2>&1 & P=$!; sleep 1
python3 ui/server.py ./usageforge --no-open --port 4598 2>&1 | grep -q "already running" || { kill $P; echo "FAIL: second ui"; exit 1; }
kill $P; wait $P 2>/dev/null || true
echo PASS
