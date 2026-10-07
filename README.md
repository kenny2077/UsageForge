# LimitKiller

On the $20 Claude Pro / ChatGPT Plus plans, the 5-hour usage window starts with your first message.
LimitKiller sends that first message for you, so a fresh window is already running when you sit down to work.

One bash script. No daemon, no stored credentials. It needs `bash` and `jq`; macOS 15+ ships `jq`, otherwise run `brew install jq` or `apt install jq`.
It uses `launchd` on macOS and `cron` on Linux. Windows isn't supported. WSL may work through cron, but it hasn't been tested.

**Product page:** https://kenny2077.github.io/LimitKiller/

## Install

```bash
git clone https://github.com/kenny2077/LimitKiller && cd LimitKiller
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
limitkiller status          # when each window resets, which mode is installed, and the recent log
limitkiller stop            # remove the job (state stays in ~/.local/state/limitkiller)
```

Settings come from environment variables, which are captured when you install a mode:
`LK_TOOLS="claude"` (only ping Claude), `LK_CLAUDE_MODEL=haiku`, `LK_STATE=~/.local/state/limitkiller`.
Installing copies the script into the state directory and runs it from there. macOS doesn't let launchd jobs read `~/Desktop` or `~/Documents`, and the copy also keeps working if you move or delete the repo.

## How it works

- **Ping.** Claude: `claude -p hi --model haiku --tools ""`, run from an empty directory with user settings off.
  That means no hooks, plugins, MCP or CLAUDE.md get loaded, so the ping uses very little quota.
  Codex: `codex exec --sandbox read-only -c model_reasoning_effort=low hi`.
  It still loads your `~/.codex/config.toml`, including any MCP servers listed there.
- **Reset detection (watch mode). It spends no quota and reads no tokens.**
  - Codex writes its own limits to `~/.codex/sessions/**/rollout-*.jsonl` (`payload.rate_limits.primary.resets_at`).
    LimitKiller reads them there, so it also sees windows that you started yourself.
  - Claude: the ping's `stream-json` output includes a `rate_limit_event` with `resetsAt`.
    LimitKiller saves that value. If the event is missing, it assumes the reset is 5 hours after the ping.
- **When a ping fails:**
  - **Rate-limited** (5-hour or weekly cap): LimitKiller waits until the reset time the server reports. For Codex it reads the weekly figure from the logs, so it doesn't send pings that can't succeed.
  - **Anything else** (still offline after a wake-up, logged out): it retries 3 times, one minute apart, then backs off for 15 minutes.
  - **Hung ping:** each one is killed after 2 minutes.
- Logs go to `~/.local/state/limitkiller/log`.

## Caveats

- **A sleeping laptop can't send anything.** launchd runs a missed job as soon as the Mac wakes.
  To wake the Mac for a 6:00 ping: `sudo pmset repeat wakeorpoweron MTWRFSU 05:58:00`.
  Linux cron skips jobs missed during sleep. Watch mode catches up on its next 5-minute check.
- **`claude -p` billing may change.** If Anthropic starts billing it separately (announced, then paused, in 2026), a `claude -p` ping might stop opening the interactive window. See `docs/research.md`.
- Each ping uses a small amount of your weekly (7-day) quota. Watch mode sends about 4–5 pings a day.
- This moves *when* your window starts. It doesn't give you more usage.

## Uninstall

```bash
limitkiller stop && rm -rf ~/.local/state/limitkiller
```

## Test

`./test.sh` uses fake `claude`/`codex` binaries. It spends no quota and installs nothing.
It covers watch-mode ticks, rejected pings, retry and backoff, the Codex weekly cap, and escaping in the generated plist.

## Prior art

[CCAutoRenew](https://github.com/aniketkarne/CCAutoRenew), [cwarm](https://pypi.org/project/cwarm/) and [claude-warmup](https://github.com/vdsmon/claude-warmup) are all Claude-only. `docs/research.md` compares them.

## License

MIT. Not affiliated with Anthropic or OpenAI.
