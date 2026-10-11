---
version: 1
slug: "ui-index-html"
primary_target: "ui/index.html"
related_targets: []
---

# Control panel (ui/index.html)

Scope: the local control panel served by `usageforge ui`, also shown inside the author's menu-bar app. Mode: Operate.

Audience and job: mainly the author. Set when each tool's 5-hour window starts, glance at usage, set night hours, see what happened. Every control saves on its own.

Constraints: one static HTML file, no external scripts, fonts from /assets/fonts, phone width works, reduced motion respected, page must stay fast (the sky canvas pauses when hidden or idle).

Pinned direction (user): a universe / black-hole vibe like the author's GitHub profile black hole and ascii.rest's dot scenes. Replaces the old teal "aurora" look and its chamfered corners.

## Direction contract

THESIS: The background check is a black hole you can watch: a dot-drawn, ray-traced disk turns across the top while UsageForge runs and hangs still when it's off. Refuses the default dark dashboard (neon accent, glowing edges, card grid).

OWN-WORLD: Near-black navy ground (#06080d) with a faint dot field; cool star-dust neutrals; disk light (ember #d27a5f, gold #f3b46a, hot cream #ffe2b0) carries active state, selection and primary actions; photon-ring ice (#bcd7ff) carries focus, links and "now". Dots are the grammar: usage meters are rows of lit dots, the day bar's track is a dot grid, status uses one dot. Jost (geometric, star-atlas labels) for UI, system mono for times and numbers. Soft 10px corners, hairline borders, no glass.

STORY: You open it and see at once whether it's running (the disk turns), when the next window starts, and how much is used; you change a time by clicking the day; at night it tells you the Mac will sleep once your agents finish.

FIRST VIEWPORT: Top: a full-width sky, about 280px, canvas black hole right of centre; brand mark and name top-left; Guide and Help top-right; the sky carries no caption (the turning disk says it runs; each tool shows its next time), except "Reconnecting…" when the panel loses its server. Below: Claude Code and Codex side by side, each: header with icon and next time, two dot meters, a three-way mode control, the 24-hour day bar. Then Sleep and wake (the two switches side by side), Activity.

FORM: Pinned by the user (universe / black hole), no roll; concept-seed not run. Seed key: none (pinned).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
