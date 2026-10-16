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
[ "\$2" = /usage ] && { echo x >>"$T/usage.calls"; exit 0; }
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
[ "\$1" = app-server ] && exit 1   # no live limits: read the logs
echo x >>"$T/codex.calls"
mode=\$(cat "$T/codex.mode" 2>/dev/null)
[ "\$mode" = fail ] && exit 1
[ "\$mode" = nolog ] && exit 0
mkdir -p "$S"
echo '{"payload":{"rate_limits":{"primary":{"resets_at":$FUTURE},"secondary":{"used_percent":10,"resets_at":$WEEK}}}}' >"$S/rollout-new.jsonl"
EOF
printf '#!/bin/sh\necho "$@" >>"%s/notes"\n' "$T" >"$T/bin/osascript"   # never pop real notifications
printf '#!/bin/sh\nexit 1\n' >"$T/bin/sudo"   # never schedule real wakes
printf '#!/bin/sh\necho "caffeinate $*" >>"%s/power"\n' "$T" >"$T/bin/caffeinate"   # never hold the real Mac up
chmod +x "$T/bin/"*

lk() { HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" UF_TOOLS="claude codex" UF_RETRY_DELAY=0 UF_JITTER=0 ./usageforge "$@" >/dev/null; }
calls() { cat "$T/$1.calls" 2>/dev/null | wc -l | tr -d ' '; }
check() { [ "$(calls claude) $(calls codex)" = "$1" ] || { echo "FAIL: $2 (calls: $(calls claude) $(calls codex), want $1)"; exit 1; }; }

mkdir -p "$T/state"; echo null >"$T/state/claude.reset"   # garbage state + empty Codex sessions dir
# Saved a day ago, so slots count as set before their time (see the "just added" test).
cfg() { echo "$1" >"$T/state/config.json"; touch -t "$(date -v-1d +%Y%m%d%H%M 2>/dev/null || date -d '-1 day' +%Y%m%d%H%M)" "$T/state/config.json"; }
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

# Switched Codex accounts: the newest event wins, even when an older account's window ends later.
lim() { echo '{"timestamp":"'$1'","payload":{"rate_limits":{"primary":{"used_percent":'$2',"resets_at":'$3'},"secondary":{"used_percent":5,"resets_at":'$WEEK'}}}}'; }
{ lim 2026-10-10T19:10:00Z 93 $((FUTURE + 3600)); } >"$S/rollout-old.jsonl"; sleep 1
{ lim 2026-10-10T19:23:00Z 86 $FUTURE; echo '{"timestamp":"2026-10-10T19:24:00Z","payload":{"rate_limits":{"primary":null}}}'; } >"$S/rollout-new.jsonl"
echo $((FUTURE + 3600)) >"$T/state/codex.reset"
HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e --argjson f $FUTURE '.tools.codex.five_hour == 86 and .tools.codex.reset == $f' >/dev/null ||
  { echo "FAIL: stale Codex account shown"; exit 1; }
rm -f "$S/rollout-old.jsonl"; echo 1 >"$T/state/codex.reset"

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
rm -f "$T/state/claude.limits" "$T/usage.calls"
lk tick;  check "3 5" "future slot should not fire"
[ ! -f "$T/usage.calls" ] || { echo "FAIL: no time due, so no /usage call"; exit 1; }
if [ "$past" != 23:59 ]; then
  cfg '{"claude":{"mode":"schedule","times":["'$past'"],"days":['$(( ($(date +%w) + 1) % 7 ))']},"codex":{"mode":"off"}}'
  lk tick;  check "3 5" "slot on another weekday should not fire"
  cfg '{"claude":{"mode":"schedule","times":["'$past'","'$future'"],"days":['$(date +%w)'],"prompt":"Hello forge"},"codex":{"mode":"off"}}'
  echo $(( $(date +%s) + 600 )) >"$T/state/claude.reset"
  lk tick;  check "3 5" "slot should wait while a window is still open"
  echo 1 >"$T/state/claude.reset"
  rm -f "$T/state/claude.added"; touch "$T/state/config.json"
  lk tick;  check "3 5" "slot just added after its time should wait for tomorrow"
  printf '%s 1\n' "$past" "$future" >"$T/state/claude.added"; touch "$T/state/config.json"
  lk tick;  check "4 5" "past slot today should fire once, even after a later save"
  [ "$(cat "$T/claude.prompt")" = "Hello forge" ] || { echo "FAIL: saved prompt not used"; exit 1; }
  lk tick;  check "4 5" "slot should not fire twice"
  grep -q "claude: .* goes out when the open window ends" "$T/state/log" || { echo "FAIL: a slot held by an open window should say so"; exit 1; }
  # Held by an open window: it goes out once the window ends, even past the 3 h, and the Mac wakes for it.
  n=$(date +%s); rm -f "$T/state/claude.last"; echo 1 >"$T/state/claude.reset"
  cfg '{"claude":{"mode":"schedule","times":["'$future'"]},"codex":{"mode":"off"}}'
  echo "$(( n - 14400 )) $(( n + 1000 ))" >"$T/state/claude.waits"
  HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e --argjson w $(( n + 1000 )) '.wake.next == $w and .tools.claude.next == $w' >/dev/null ||
    { echo "FAIL: the Mac should wake when a held time's window ends"; exit 1; }
  lk tick;  check "4 5" "held time should wait for its window to end"
  # Next, as the panel and menu bar show it: a set time inside an open window waits for the window.
  echo $(( n + 99999 )) >"$T/state/claude.reset"
  HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e --argjson r $(( n + 99999 )) '.tools.claude.next == $r' >/dev/null ||
    { echo "FAIL: next should wait for the open window"; exit 1; }
  echo 1 >"$T/state/claude.reset"
  echo "$(( n - 14400 )) $(( n - 60 ))" >"$T/state/claude.waits"
  lk tick;  check "5 5" "held time should go out once its window ends"
  lk tick;  check "5 5" "held time should go out once"
  # Not past its own 5 hours: a window that ends later than that skips it, and the Mac doesn't wake for it.
  rm -f "$T/state/claude.last"
  echo "$(( n - 14400 )) $(( n + 7200 ))" >"$T/state/claude.waits"
  HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e --argjson w $(( n + 7200 )) '.wake.next != $w' >/dev/null ||
    { echo "FAIL: no wake for a held time past its 5 hours"; exit 1; }
  echo "$(( n - 20000 )) $(( n - 60 ))" >"$T/state/claude.waits"
  lk tick;  check "5 5" "held time whose window ended after its 5 hours should be skipped"
  # Codex at 0% still reports a reset time; that is no open window, so the slot fires.
  cat >"$T/bin/codex" <<EOF2
#!/bin/sh
[ "\$2" = --help ] && exit 0
[ "\$1" = app-server ] && exit 1
echo x >>"$T/codex.calls"
EOF2
  mkdir -p "$S"; lim 2026-10-11T11:00:00Z 0 $FUTURE >"$S/rollout-new.jsonl"; echo 1 >"$T/state/codex.reset"; rm -f "$T/state/codex.last"
  cfg '{"claude":{"mode":"schedule","times":["'$future'"]},"codex":{"mode":"schedule","times":["'$past'"]}}'
  lk tick;  check "5 6" "codex at 0% with a reset time should still fire its slot"
  if [ "$(uname)" = Darwin ]; then
    grep -q "caffeinate -i -s -w" "$T/power" 2>/dev/null && { echo "FAIL: hold the Mac only after a wake we scheduled"; exit 1; }
    W=$(( $(date +%s) - 30 )); echo "$W" >"$T/woke"; echo "$W" >"$T/state/wakes"
    printf '#!/bin/sh\necho "{ sec = $(cat "%s/woke"), usec = 0 }"\n' "$T" >"$T/bin/sysctl"; chmod +x "$T/bin/sysctl"
    lk tick; sleep 1; rm -f "$T/bin/sysctl" "$T/state/wakes"   # caffeinate starts in the background
    grep -q "caffeinate -i -s -w" "$T/power" || { echo "FAIL: after a wake we scheduled, a tick should hold the Mac awake while it runs"; exit 1; }
  fi
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
HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e '.tools.claude.installed and (.config.claude.mode == "schedule")' >/dev/null ||
  { echo "FAIL: status --json"; exit 1; }

# Notifications: problems only, once per 6 h, never for manual pings; switching them off works.
if [ "$(uname)" = Darwin ]; then
  rm -f "$T/notes"
  notes() { cat "$T/notes" 2>/dev/null | wc -l | tr -d ' '; }
  printf '#!/bin/sh\nexit 1\n' >"$T/bin/claude"
  UF_WHY=watch lk ping claude || true; UF_WHY=watch lk ping claude || true
  [ "$(notes)" = 1 ] || { echo "FAIL: failure should notify exactly once (got $(notes))"; exit 1; }
  cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$1" = --help ] && exit 0
[ "\$2" = /usage ] && exit 0
[ "\$1" = auth ] && { echo '{"loggedIn":true}'; exit 0; }
echo '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","unifiedWindows":{"five_hour":{"resetsAt":$FUTURE},"seven_day":{"utilization":0.95}}}}'
EOF
  rm -f "$T/state/claude.backoff"; echo 1 >"$T/state/claude.reset"
  cfg '{"claude":{"mode":"watch"},"codex":{"mode":"off"}}'
  before=$(notes); lk tick
  [ "$(notes)" = "$before" ] || { echo "FAIL: a window starting should not notify"; exit 1; }
  rm -f "$T/state/"*.note; printf '#!/bin/sh\nexit 1\n' >"$T/bin/claude"
  cfg '{"claude":{"mode":"watch"},"codex":{"mode":"off"},"notify":{"problems":false}}'; echo 1 >"$T/state/claude.reset"
  UF_WHY=watch lk ping claude || true
  [ "$(notes)" = "$before" ] || { echo "FAIL: problems switched off should not notify"; exit 1; }
  cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$1" = --help ] && exit 0
[ "\$1" = auth ] && { echo '{"loggedIn":true}'; exit 0; }
exit 0
EOF
  before=$(notes); lk ping claude
  [ "$(notes)" = "$before" ] || { echo "FAIL: manual ping should not notify"; exit 1; }
  HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge doctor | grep -q "signed in" || { echo "FAIL: doctor"; exit 1; }
  cfg '{"claude":{"mode":"schedule","times":[]}}'
  ! HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge doctor >/dev/null || { echo "FAIL: doctor should flag no times"; exit 1; }
fi

# Sleep: once switched on, sleep once agents are done and nobody is at the Mac (then switch off); stay up while one works.
# Wake: one wake a minute after each set time, kept in step with the schedule.
if [ "$(uname)" = Darwin ]; then
  printf '#!/bin/sh\necho "pmset $*" >>"%s/power"\n' "$T" >"$T/bin/pmset"
  printf '#!/bin/sh\necho "  |   \\"HIDIdleTime\\" = $(cat "%s/idle")000000000"\n' "$T" >"$T/bin/ioreg"
  chmod +x "$T/bin/pmset" "$T/bin/ioreg"
  power() { cat "$T/power" 2>/dev/null | grep -c "$1"; }
  find "$T/home" -name '*.jsonl' -exec touch -t 202001010000 {} +
  night='"night":{"sleep":true,"wake":false}'
  cfg '{"claude":{"mode":"off"},"codex":{"mode":"off"},'"$night"'}'
  echo 100 >"$T/idle"; lk tick
  [ "$(power sleepnow)" = 0 ] || { echo "FAIL: sleep while someone uses the Mac"; exit 1; }
  echo 700 >"$T/idle"; lk tick
  [ "$(power sleepnow)" = 1 ] || { echo "FAIL: should sleep once agents are done"; exit 1; }
  jq -e '.night.sleep == false' "$T/state/config.json" >/dev/null || { echo "FAIL: sleep should switch off once it has slept the Mac"; exit 1; }
  cfg '{"claude":{"mode":"off"},"codex":{"mode":"off"},'"$night"'}'
  mkdir -p "$T/home/.claude/projects/p"; touch "$T/home/.claude/projects/p/s.jsonl"; lk tick; sleep 1   # caffeinate starts in the background
  [ "$(power sleepnow)" = 1 ] && [ "$(power 'caffeinate -i -t')" = 1 ] || { echo "FAIL: should keep the Mac up while an agent works"; exit 1; }
  rm -rf "$T/home/.claude/projects"
  cfg '{"claude":{"mode":"off"},"codex":{"mode":"off"},"night":{"sleep":false,"wake":false}}'; lk tick
  [ "$(power sleepnow)" = 1 ] || { echo "FAIL: sleep off should never sleep the Mac"; exit 1; }
  lk sleep on >/dev/null && jq -e '.night.sleep' "$T/state/config.json" >/dev/null || { echo "FAIL: sleep on"; exit 1; }
  ! lk sleep 23:30 08:00 2>/dev/null || { echo "FAIL: sleep takes on or off"; exit 1; }

  # Wake. sudo is faked: it logs and says yes.
  printf '#!/bin/sh\n[ "$2" = -l ] && exit 0\necho "$*" >>"%s/sudo"\n' "$T" >"$T/bin/sudo"; chmod +x "$T/bin/sudo"
  wakes() { cat "$T/sudo" 2>/dev/null | grep -c "$1"; }
  t1=$(date -v+2H +%H:%M); ts1=$(date -j -f '%Y-%m-%d %H:%M:%S' "$(date +%F) $t1:00" +%s)
  [ "$ts1" -gt "$(date +%s)" ] || ts1=$(( ts1 + 86400 ))   # two hours on may be tomorrow
  w1=$(date -r $(( ts1 + 60 )) '+%m/%d/%y %H:%M:%S')
  cfg '{"claude":{"mode":"schedule","times":["'$t1'"]},"codex":{"mode":"off"}}'   # wake is on by default
  lk tick; lk tick
  [ "$(wakes "schedule wake $w1")" = 1 ] || { echo "FAIL: one wake a minute after the set time ($(cat "$T/sudo" 2>/dev/null))"; exit 1; }
  lk wake off
  [ "$(wakes "schedule cancel wake $w1")" = 1 ] || { echo "FAIL: wake off should cancel the scheduled wake"; exit 1; }
  HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e '.wake.allowed and .config.night.wake == false' >/dev/null ||
    { echo "FAIL: status should show wake"; exit 1; }
  lk wake allow
  grep -q "visudo -cf" "$T/notes" && grep -q "/etc/sudoers.d/usageforge" "$T/notes" || { echo "FAIL: wake allow should install a checked sudoers rule"; exit 1; }

  # After a wake we scheduled, back to sleep once nobody has used the Mac since; never after another wake.
  W=$(( $(date +%s) - 240 ))
  printf '#!/bin/sh\necho "{ sec = $(cat "%s/woke"), usec = 0 }"\n' "$T" >"$T/bin/sysctl"; chmod +x "$T/bin/sysctl"
  cfg '{"claude":{"mode":"off"},"codex":{"mode":"off"}}'; : >"$T/power"
  echo $(( W + 100 )) >"$T/woke"; echo "$W" >"$T/state/wakes"; echo 600 >"$T/idle"; lk tick
  [ "$(power sleepnow)" = 0 ] || { echo "FAIL: back to sleep after a wake that wasn't ours"; exit 1; }
  echo "$W" >"$T/woke"; echo 30 >"$T/idle"; lk tick
  [ "$(power sleepnow)" = 0 ] || { echo "FAIL: back to sleep although someone used the Mac after the wake"; exit 1; }
  echo 230 >"$T/idle"; lk tick
  [ "$(power sleepnow)" = 1 ] || { echo "FAIL: should go back to sleep after a wake we scheduled"; exit 1; }
  : >"$T/power"; lk tick
  [ "$(power sleepnow)" = 0 ] && [ "$(power 'caffeinate -i -s')" = 0 ] || { echo "FAIL: once back asleep, that wake is done: no hold, no second sleep"; exit 1; }
  rm -f "$T/state/slept"; : >"$T/power"
  printf '#!/bin/sh\nexit 1\n' >"$T/bin/claude"; chmod +x "$T/bin/claude"; rm -f "$T/state/claude.limits"
  cfg '{"claude":{"mode":"schedule","times":["'$(date -v+3H +%H:%M)'"]},"codex":{"mode":"off"}}'; lk tick
  [ "$(power sleepnow)" = 0 ] || { echo "FAIL: should stay up until the usage is read"; exit 1; }
  grep -qx "$W" "$T/state/wakes" || { echo "FAIL: past wakes should be kept for a day"; exit 1; }
  rm -f "$T/bin/sysctl"
  rm -f "$T/bin/pmset" "$T/bin/ioreg"
fi
printf '#!/bin/sh\nexit 1\n' >"$T/bin/sudo"

# Live Claude usage from `claude -p /usage` (sends no message): numbers and the real reset time.
# Real reports say is_active:false even while the 5h window is open, so it must not be trusted.
R=$(( $(date +%s) + 3000 ))
cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$2" = /usage ] || exit 1
echo '{"type":"assistant","usage_report":{"rate_limits":{"limits":[{"kind":"session","percent":40,"resets_at":"$(date -u -r $R +%Y-%m-%dT%H:%M:%S.123456+00:00 2>/dev/null || date -u -d @$R +%Y-%m-%dT%H:%M:%S.123456+00:00)","is_active":false},{"kind":"weekly_all","percent":70,"resets_at":"2030-01-01T00:00:00+00:00"}]}}}'
EOF
rm -f "$T/state/claude.limits" "$T/state/claude.asked"
HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e '.tools.claude.five_hour == 40 and .tools.claude.weekly == 70' >/dev/null ||
  { echo "FAIL: /usage numbers"; exit 1; }
[ "$(cat "$T/state/claude.reset")" = "$R" ] || { echo "FAIL: /usage reset time ($(cat "$T/state/claude.reset") vs $R)"; exit 1; }
# Right after a ping /usage says 0% and gives a made-up reset (now + 5h): keep the reset the ping saved.
cat >"$T/bin/claude" <<EOF
#!/bin/sh
echo '{"type":"assistant","usage_report":{"rate_limits":{"limits":[{"kind":"session","percent":0,"resets_at":"2030-01-01T00:00:00+00:00","is_active":false},{"kind":"weekly_all","percent":70,"resets_at":"2030-01-01T00:00:00+00:00"}]}}}'
EOF
rm -f "$T/state/claude.limits" "$T/state/claude.asked"; echo "$R" >"$T/state/claude.reset"
HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json >/dev/null
[ "$(cat "$T/state/claude.reset")" = "$R" ] || { echo "FAIL: 0% /usage dropped the ping's reset ($(cat "$T/state/claude.reset") vs $R)"; exit 1; }
# Claude Code 2.1.299 prints /usage as text only; the numbers are in its saved copy (~/.claude.json).
# That copy is read without asking; asking again waits 15 min, since the endpoint answers 429 when asked often.
R2=$(( $(date +%s) + 3000 )); A2=$(( $(date +%s) - 60 ))
cat >"$T/bin/claude" <<EOF
#!/bin/sh
[ "\$2" = /usage ] || exit 0
echo x >>"$T/usage.calls"
printf '%s\n' '{"cachedUsageUtilization":{"fetchedAtMs":${A2}000,"utilization":{"limits":[{"kind":"session","percent":12,"resets_at":"$(date -u -r $R2 +%Y-%m-%dT%H:%M:%S.5+00:00 2>/dev/null || date -u -d @$R2 +%Y-%m-%dT%H:%M:%S.5+00:00)","is_active":false},{"kind":"weekly_all","percent":4,"resets_at":"2030-01-01T00:00:00+00:00"}]}}}' >"$T/home/.claude.json"
printf '%s\n' '{"type":"result","result":"Current session: 12% used"}'
EOF
rm -f "$T/state/claude.limits" "$T/state/claude.asked" "$T/home/.claude.json" "$T/usage.calls"; echo 1 >"$T/state/claude.reset"
st() { HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" "$@" ./usageforge status --json; }
st | jq -e --argjson a $A2 '.tools.claude.five_hour == 12 and .tools.claude.weekly == 4 and .tools.claude.updated == $a' >/dev/null ||
  { echo "FAIL: /usage numbers from Claude Code's saved copy"; exit 1; }
[ "$(cat "$T/state/claude.reset")" = "$R2" ] || { echo "FAIL: /usage reset from the saved copy ($(cat "$T/state/claude.reset") vs $R2)"; exit 1; }
st >/dev/null; st env UF_LIVE_AGE=0 >/dev/null
[ "$(wc -l <"$T/usage.calls")" -eq 1 ] || { echo "FAIL: ask /usage at most every 15 min, 1 for Refresh ($(wc -l <"$T/usage.calls") asks)"; exit 1; }
touch -t "$(date -v-2M +%Y%m%d%H%M 2>/dev/null || date -d '-2 min' +%Y%m%d%H%M)" "$T/state/claude.asked"; st env UF_LIVE_AGE=0 >/dev/null
[ "$(wc -l <"$T/usage.calls")" -eq 2 ] || { echo "FAIL: Refresh should ask again after a minute"; exit 1; }
rm -f "$T/home/.claude.json"

# Codex out of usage: the turn logs an error, not new numbers. Don't retry; show the window as full.
lim 2026-10-10T19:23:00Z 92 $FUTURE >"$S/rollout-new.jsonl"; : >"$T/codex.calls"
cat >"$T/bin/codex" <<EOF
#!/bin/sh
[ "\$2" = --help ] && exit 0
[ "\$1" = app-server ] && exit 1   # no live limits: read the logs
echo x >>"$T/codex.calls"
echo '{"timestamp":"2026-10-10T21:07:06.672Z","payload":{"type":"task_complete","error":{"message":"limit","codex_error_info":"usage_limit_exceeded"}}}' >"$S/rollout-limit.jsonl"
echo "ERROR: You've hit your usage limit. Try again at 5:17 PM." >&2; exit 1
EOF
! lk ping codex || { echo "FAIL: out-of-usage ping should exit non-zero"; exit 1; }
[ "$(calls codex)" = 1 ] || { echo "FAIL: out-of-usage ping should not retry"; exit 1; }
HOME="$T/home" PATH="$T/bin:$PATH" UF_STATE="$T/state" ./usageforge status --json | jq -e --argjson f $FUTURE '.tools.codex.five_hour == 100 and .tools.codex.reset == $f' >/dev/null ||
  { echo "FAIL: Codex out of usage should show 100%"; exit 1; }

! lk schedule 25:00 || { echo "FAIL: bad time accepted"; exit 1; }
for bad in "foo" "ping gemini" "status --jsno"; do
  ! lk $bad 2>/dev/null || { echo "FAIL: 'usageforge $bad' should fail"; exit 1; }
done
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
# Upgraded under a running panel (Homebrew deletes the old files): say so and free the port.
cp -R ui "$T/ui"; python3 -B "$T/ui/server.py" ./usageforge --no-open --port 4597 >/dev/null 2>&1 & P=$!; sleep 1
rm "$T/ui/index.html"
[ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4597/)" = 503 ] || { kill $P; echo "FAIL: panel with its files gone"; exit 1; }
sleep 1; ! kill -0 $P 2>/dev/null || { kill $P; echo "FAIL: panel should exit once its files are gone"; exit 1; }
echo PASS
