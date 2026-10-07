#!/usr/bin/env bash
# Mock test: fake `claude`/`codex` on PATH, fake HOME. Spends no quota, installs nothing.
set -eu
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/home/.codex/sessions/2026/01/01"
FUTURE=$(( $(date +%s) + 9999 ))

# Fake claude: counts calls, emits a rate_limit_event like `claude -p --output-format stream-json`.
cat >"$T/bin/claude" <<EOF
#!/bin/sh
echo x >>"$T/claude.calls"
echo '{"type":"system","subtype":"init"}'
echo '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","rateLimitType":"five_hour","resetsAt":$FUTURE}}'
EOF
# Fake codex: counts calls, writes a session log with a fresh 5h window like real Codex does.
cat >"$T/bin/codex" <<EOF
#!/bin/sh
echo x >>"$T/codex.calls"
echo '{"payload":{"rate_limits":{"primary":{"resets_at":$FUTURE}}}}' >"$T/home/.codex/sessions/2026/01/01/rollout-new.jsonl"
EOF
chmod +x "$T/bin/"*
# Old Codex window that already ended.
echo '{"payload":{"rate_limits":{"primary":{"resets_at":1}}}}' >"$T/home/.codex/sessions/2026/01/01/rollout-old.jsonl"

lk() { HOME="$T/home" PATH="$T/bin:$PATH" LK_STATE="$T/state" ./limitkiller "$@" >/dev/null; }
calls() { wc -l <"$T/$1.calls" 2>/dev/null | tr -d ' ' || echo 0; }

lk tick                                        # both windows ended -> ping both
[ "$(calls claude)" = 1 ] && [ "$(calls codex)" = 1 ] || { echo "FAIL: first tick should ping both"; exit 1; }
[ "$(cat "$T/state/claude.reset")" = "$FUTURE" ] || { echo "FAIL: claude reset not parsed"; exit 1; }
lk tick                                        # windows running -> no-op
[ "$(calls claude)" = 1 ] && [ "$(calls codex)" = 1 ] || { echo "FAIL: second tick should be a no-op"; exit 1; }
echo 1 >"$T/state/claude.reset"; lk tick       # claude window ended -> ping claude only
[ "$(calls claude)" = 2 ] && [ "$(calls codex)" = 1 ] || { echo "FAIL: should re-ping claude only"; exit 1; }
! lk schedule 25:00 || { echo "FAIL: bad time accepted"; exit 1; }
echo PASS
