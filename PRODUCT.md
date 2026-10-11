# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Mainly the author: a developer who codes with Claude Code and Codex on subscription plans and wants each 5-hour usage window to start on their schedule, not at their first message. They open the control panel a few times to set things up, then glance at usage now and then, in the browser or in their own menu-bar app that shows the same page. Other people install it with Homebrew and get the same panel; they are welcome but secondary.

## Product Purpose
UsageForge sends one tiny message to Claude Code and/or Codex at times the user picks (or as soon as each window ends), so a fresh 5-hour window is already running when they sit down. Success: the windows start when planned, the user can see at a glance how much of the window and week is used, and nothing needs attention unless something goes wrong.

## Positioning
It reads the tools' own numbers (Claude Code's `/usage`, Codex's session logs), costs almost no quota, runs as a 5-minute background check with no account or server, and plans windows on a 24-hour day bar.

## Operating Context
- `usageforge ui` serves the panel on 127.0.0.1:4517 from a small Python server; every API call carries a per-run token.
- The background check is a launchd job (cron elsewhere); the panel only edits `config.json` and shows `status --json`.
- The terminal prints a small pixel scene and the setup check when the panel starts.
- The Mac must be awake for messages to go out.

## Capabilities and Constraints
- Per tool: mode (Off / At set times / Back to back), set times on chosen weekdays, message and model; 5-hour and weekly meters; activity log; one notification kind (when something goes wrong); a first-run guide.
- Single static HTML file, no build step, no external scripts; fonts and images served from `docs/assets`. Must work at phone width.
- Night hours (macOS): during set hours the Mac stays awake while an agent works, sleeps once they finish and nobody is using it, and can wake one minute after the first set time inside those hours (one password prompt, `pmset repeat`).

## Brand Commitments
- Name UsageForge and the pixel anvil mark (`docs/assets/usageforge-mark.svg`).
- The panel and the terminal art take a universe / black-hole look, in the spirit of the author's GitHub profile black hole (dot-drawn accretion disk, lensed ring, starfield) and ascii.rest's dot scenes. The public website keeps its alpine dawn for now.

## Evidence on Hand
- The author's profile black hole: github.com/kenny2077 (`assets/black-hole.gif`).
- ascii.rest pieces (MIT), including `black-hole`, `starfield`, `galaxy`; credits go in `docs/third-party-notices.txt`.
- No testimonials, user counts or benchmarks exist; none may be invented.

## Product Principles
- Quiet by default: show state at a glance, speak up only when something is wrong.
- The tools' own numbers, never estimates.
- Every control saves on its own; nothing to submit.
- Local only: nothing leaves the machine except the messages the user scheduled.
