# Prior art: auto-pinging to anchor the 5-hour window (checked 2026-10-07)

Only projects whose README/source I opened are listed. Stars via GitHub API, same day.

| Project | Stars / activity | Mechanism | Sends message | Detects reset | Agent | Safety notes | Verdict |
|---|---|---|---|---|---|---|---|
| https://github.com/aniketkarne/CCAutoRenew | 287 stars; last push 2026-09-10 | bash daemon loop; optional cron or `setup-claude-launchd.sh` (macOS login item) | `echo "<msg>" \| claude` (default model, full interactive startup, so hooks/plugins load) | polls `ccusage blocks` for "time remaining", or clock-only fallback (`--disableccusage`); schedules via `--at/--stop/--days` | Claude only | Uses the existing `claude` login, stores no tokens. `ccusage` may run through `npx ccusage@latest` (unpinned remote code). Git clone plus `chmod +x`, no curl-pipe-bash. The `ccusage` text parse is brittle. | Simple and the closest to what we want. Not minimal: the ping is heavy and the loop is polling. |
| https://pypi.org/project/cwarm/ (repo github.com/wonderbyte/cwarm) | 1 star; last push 2026-07-19 (v0.2.1) | Python daemon with per-account cron expressions in `~/.config/cwarm/config.json` | Runs `claude` with `--model haiku` and message "Hi" (default). Switches accounts through `claude-swap` first. | `skip_if_warm` checks window state (exact method not read); otherwise fixed cron times | Claude only (`agent` field exists, only `claude` supported) | Stores no tokens itself, but depends on `claude-swap`, which handles `sk-ant-oat01` tokens. No launchd unit; you keep the daemon alive yourself. Small and young. | Clean design, cheap Haiku ping. Fixed clock times, not chained to resets. Multi-account is out of scope for us. |
| https://github.com/vdsmon/claude-warmup | 174 stars; last push 2026-04-30 | GitHub Actions cron in your fork | One Haiku message through the CLI inside the runner | None. Fixed cron times only. | Claude only | You store a long-lived OAuth token (`claude setup-token`, about a year) as a repo secret, and it runs on GitHub's servers. The README also notes Claude Code Web scheduled tasks as a native alternative (2026-04-01). On 2026-04-30 it says the anchor is now the exact minute of the first message, not the clock hour. | Simple and needs no always-on machine. Credential exposure makes it poor for us. Cron times drift off the real reset. |

Not listed:
- `Migiht/autoqq` was described by a search snippet as a systemd one-token keep-alive for Claude, Codex and opencode. The repo returned 404 for both the page and the API, so **UNVERIFIED**.
- `Socialpranker/agentburn` (and `ccusage`) only analyze local logs and send nothing.
- Searches for Codex-specific pingers found none.

## Gaps (none of the verified tools do these)
1. **Codex support.** All three are Claude-only. cwarm has an `agent` field but ships only `claude`. Codex has a 5-hour window plus a weekly one (secondary sources, **UNVERIFIED** against OpenAI docs).
2. **Chained "ping when the window resets" mode.** All use fixed clock times or a polling loop. None computes `window_start + 5h` from the last ping or local logs and schedules exactly one wake-up (launchd `StartCalendarInterval` or a one-shot timer) with no polling.
3. **Native launchd.** Only CCAutoRenew has a launchd installer, and it wraps a long-running daemon. A per-ping LaunchAgent that runs in the user's GUI session can read the Keychain login. GitHub Actions needs an exported OAuth token instead.
4. **Minimal ping.** Only cwarm picks Haiku. None of them skip hooks, plugins, MCP servers or CLAUDE.md. Flags like `--model haiku`, a tiny prompt, no tools and `--no-session-persistence` are worth testing. I did not verify exact flag names.
5. **No stored credentials plus a skip-if-warm check** in the same tool. cwarm has both, but only for Claude and through `claude-swap`.
6. **Dual-agent state.** No shared "next reset" record covering Claude and Codex.

## ToS / billing note
- **Pings and windows:** I found nothing from Anthropic or OpenAI that explicitly allows or forbids scheduled keep-alive pings. **UNVERIFIED.** I did not read Anthropic's Usage Policy or Consumer Terms for automation clauses, so check them before shipping. One tiny message per window is ordinary use of your own subscription. Rotating accounts, as cwarm's `claude-swap` option does, may violate terms (**UNVERIFIED**) and we should avoid it.
- **Non-interactive billing:** Secondary sources report that Anthropic announced on 2026-05-13 that `claude -p`, the Agent SDK and GitHub Actions would move to a separate monthly credit on 2026-06-15, then paused that change on 2026-06-15. Non-interactive calls still draw from the subscription limits for now, and Anthropic says it will give notice before changing that. Sources: https://env.dev/updates/anthropic-agent-sdk-credits and https://techsy.io/en/blog/claude-agent-sdk-credit (secondary, not Anthropic). **Risk:** if this ships, a `claude -p` ping may stop opening the interactive window. Pinging through an interactive-style invocation would avoid that, and the design should keep that option.
