# LimitKiller

On the $20 Claude Pro / ChatGPT Plus plans, the 5-hour usage window starts with your first message.
LimitKiller sends that first message for you, so a fresh window is already running when you sit down to work.

One bash script. No daemon, no stored credentials, no new dependencies (needs `jq`).
It uses `launchd` on macOS and `cron` on Linux.

## Install

```bash
git clone <this repo> && cd LimitKiller
ln -s "$PWD/limitkiller" ~/.local/bin/limitkiller   # any directory on your PATH
```

You need `claude` (Claude Code) and/or `codex` (Codex CLI: `npm i -g @openai/codex`) installed and logged in.
LimitKiller pings whichever of the two it finds.

## Two modes (pick one; installing a mode replaces the other)

**1. Schedule: ping at fixed times you choose.**
```bash
limitkiller schedule 06:00            # window runs 6–11, so your 9am session gets a reset at 11
limitkiller schedule 06:00 11:00 16:00
```

**2. Watch: start the next window as soon as the last one resets.**
```bash
limitkiller watch     # checks every 5 min; it only sends a message after a window ends
```

```bash
limitkiller ping            # ping now (or: limitkiller ping codex)
limitkiller status          # when each window resets, and which mode is installed
limitkiller stop            # uninstall
```

Settings come from environment variables, which are captured when you install a mode:
`LK_TOOLS="claude"` (only ping Claude), `LK_MSG="hi"`, `LK_CLAUDE_MODEL=haiku`, `CODEX_BIN=/path/to/codex`.

## How it works

- **Ping.** Claude: `claude -p hi --model haiku --tools ""`, run from an empty directory with user settings off.
  That means no hooks, plugins, MCP or CLAUDE.md get loaded, so the ping uses very little quota.
  Codex: `codex exec --sandbox read-only hi`.
- **Reset detection (watch mode). It spends no quota and reads no tokens.**
  - Codex writes its own limits to `~/.codex/sessions/**/rollout-*.jsonl` (`payload.rate_limits.primary.resets_at`).
    LimitKiller reads them there, so it also sees windows that you started yourself.
  - Claude: the ping's `stream-json` output includes a `rate_limit_event` with `resetsAt`.
    LimitKiller saves that value. If the event is missing, it assumes the reset is 5 hours after the ping.
- If a ping fails (limit reached, logged out), LimitKiller waits 1 hour before trying again.
- Logs go to `~/.local/state/limitkiller/log`.

## Caveats

- **A sleeping laptop can't send anything.** launchd runs a missed job as soon as the Mac wakes.
  To wake the Mac for a 6:00 ping: `sudo pmset repeat wakeorpoweron MTWRFSU 05:58:00`.
- Each ping uses a small amount of your weekly (7-day) quota. Watch mode sends about 4–5 pings a day.
- This moves *when* your window starts. It doesn't give you more usage.

## Test

`./test.sh` uses fake `claude`/`codex` binaries. It spends no quota and installs nothing.
