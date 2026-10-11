---
name: UsageForge
description: The local control panel, drawn as a black hole in dots.
colors:
  void: "#06080d"
  hull: "#0b0f17"
  hull-2: "#10151f"
  hull-3: "#161c29"
  ink: "#e8ecf4"
  ink-2: "#b8c1d2"
  muted: "#8b95aa"
  faint: "#7a849a"
  line: "rgba(168, 186, 224, 0.11)"
  line-2: "rgba(168, 186, 224, 0.22)"
  ember: "#d27a5f"
  gold: "#f3b46a"
  gold-hover: "#ffc887"
  hot: "#ffe2b0"
  ring: "#bcd7ff"
  flare: "#ff7a6b"
  gold-ink: "#1b1308"
typography:
  display:
    fontFamily: "Jost, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Jost, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Jost, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.15
  body:
    fontFamily: "Jost, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Jost, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.55
  label-axis:
    fontFamily: "Jost, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.14em"
  mono:
    fontFamily: "ui-monospace, SF Mono, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  xs: "6px"
  sm: "7px"
  md: "10px"
  lg: "12px"
  pill: "999px"
spacing:
  gap-sm: "12px"
  gap-md: "14px"
  section: "22px"
  column: "44px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 15px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 15px"
    height: "36px"
  input-field:
    backgroundColor: "{colors.void}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 11px"
  mode-option:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  mode-option-selected:
    backgroundColor: "rgba(243, 180, 106, 0.1)"
    textColor: "{colors.hot}"
  filter-chip-selected:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  day-band:
    textColor: "{colors.gold-ink}"
    rounded: "{rounded.xs}"
    typography: "{typography.mono}"
  toast:
    backgroundColor: "{colors.hull-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
---

# Design System: UsageForge

Scope: this system covers the local control panel (`ui/index.html`, also shown in the author's menu-bar app). The public website under `docs/` keeps its alpine dawn look on purpose and is not governed by this file.

## Overview

**Creative North Star: "The Watched Black Hole"**

The background check is a black hole you can watch. Across the top is the author's own black hole (`docs/assets/black-hole.gif`, the "gargantua" piece from their GitHub profile): a looping image the browser plays, so nothing is computed in the page. It turns while UsageForge runs; when it's off, or the reader asks for reduced motion, a still frame (`black-hole-still.webp`) hangs dimmed instead. Everything below sits on the same night ground and speaks the same grammar: dots. Usage meters are rows of lit dots, the day bar's track is a dot grid, mode choices carry little dot glyphs, status is one dot.

Light comes from the disk. Its ember, gold and hot cream carry active state, selection and primary actions; the photon ring's ice blue carries focus, links and "now". Everything else is cool star dust on near-black navy. The panel is calm and dense enough to read at a glance, with no cards: parts sit directly on the ground, opened by hairlines.

It refuses the default dark dashboard: no neon accent, no glowing edges, no card grid, no glass.

**Key Characteristics:**
- Near-black navy ground with a faint 14px dot field that runs the whole page.
- Disk light (ember, gold, hot cream) means "active / chosen"; ring ice means "focus / now / link".
- Dots as the unit of every indicator.
- Hairline borders and tonal fills only; no cards, no glass.
- Jost for words, system mono for times and numbers.
- Soft 10px corners on containers, 7px on controls.

## Colors

A deep-space palette: navy void and star-dust neutrals, lit only by the warm disk and the cold ring.

### Primary
- **Disk Gold**: the main light. Primary buttons, lit meter dots, selected weekdays, the selected filter chip, active status dots, switches when on, the selected mode's underline, the caret.
- **Hot Cream**: the hottest part of the disk. Selected mode label, the leading edge of a day band, meter dots past the two-thirds mark.
- **Ember**: the cooler outer disk. The trailing edge of a day band and meters running high.

### Secondary
- **Photon-Ring Ice**: focus rings, the "now" line and its tag, inline action links ("Add an exact time"), the live indicator, the day bar's hover edge and ghost hour.

### Tertiary
- **Flare**: the one alarm color. Full meters, invalid inputs and bands, the health banner border and tint, failing log lines, error toasts.

### Neutral
- **Void**: page ground, input fields, the day bar's track.
- **Hull / Hull 2 / Hull 3**: tonal steps up from the void. Hull 2 is the guide card, Hull 3 the toast and scrollbar thumb.
- **Star Ink**: primary text.
- **Ink 2**: secondary text, links at rest, meter names, log text.
- **Muted**: descriptions and small print.
- **Faint**: axis labels, tick times, timestamps, placeholders, idle status dots.
- **Line / Line 2**: hairlines. Line between sections inside a panel; Line 2 for panel tops, control outlines and inputs.
- **Gold Ink**: dark brown text on any gold fill.

### Named Rules
**The Disk Light Rule.** Warm color means "this is on or chosen", nothing else. Disk gold, cream and ember never decorate idle surfaces, headings or borders at rest.

**The Ring Rule.** Ice blue is reserved for focus, "now" and inline links. It never fills a button or marks a selection.

**The One Alarm Rule.** Flare is the only error color and appears only when something is actually wrong.

The page ground `#04060c` is the GIF's own ground, so the image has no visible edge.

## Typography

**Display Font:** Jost (variable 300-700, self-hosted from `/assets/fonts`), with the system UI stack as fallback
**Body Font:** Jost
**Label/Mono Font:** system monospace (`ui-monospace`, SF Mono, Menlo, Consolas) with tabular numerals

**Character:** Jost is geometric and quiet, like the labels on a star atlas; the mono gives every time and number a fixed, instrument-like width.

### Hierarchy
- **Display**: the engine line over the sky ("Running"), one per page; 28px on phones.
- **Headline**: tool names and the Sleep and wake heading; the guide card heading runs a step larger (24px).
- **Title**: secondary section heads (Activity).
- **Body**: default copy; questions above controls run at 15.5px/500. Long explanations cap at 64-72ch.
- **Body small** (13-14px): descriptions, meter values, tips, field labels.
- **Axis label**: the day bar's zone names (Night / Morning / Afternoon / Evening), uppercase and tracked, because they label a chart axis.
- **Mono**: times inside day bands (600), tick times (500, 11px), time inputs, the model field, and the activity log (12.5px/1.8).

### Named Rules
**The Instrument Numbers Rule.** Any clock time, log line or model id is set in mono with tabular numerals; prose stays in Jost.

**The Axis-Only Caps Rule.** Uppercase tracked text is for chart axis labels only. It never sits above a heading as a label.

## Layout

A full-width sky (400px desktop; on phones the image runs full width and the engine line drops below it) carries the brand top-left, Guide top-right, and the engine line and next event over its lower left. The image fades out at its edges through a radial mask.

Below, a centered column with a fluid gutter (16px to 44px, centering at 1320px max width). The two tool panels sit side by side with a 44px column gap, collapsing to one column under 1080px. Sleep and wake, then Activity, run full width beneath.

Rhythm: sections pad 20px x 22px (16px sides on phones); groups inside step by 12-14px; major blocks separate by 26px. Under 640px: modes stack vertically, the message/model pair stacks, day bands drop their "to" line and use short times, every other tick hides.

## Elevation & Depth

Flat by default. Depth comes from the dot field, tonal hull steps and hairlines, not shadows. Shadows appear only on things that float above the page.

### Shadow Vocabulary
- **Status glow** (`box-shadow: 0 0 0 4px rgba(243, 180, 106, 0.14)`): the halo on an active status dot.
- **Toast lift** (`box-shadow: 0 18px 40px -18px #000`): toasts.
- **Guide lift** (`box-shadow: 0 30px 60px -24px #000`): the guide card.
- **Guide spotlight** (`box-shadow: 0 0 0 200vmax rgba(3, 4, 8, 0.72), inset 0 0 0 2px #bcd7ff`): dims the page around the guided element.
- **Inset hairline** (`box-shadow: inset 0 0 0 1px`): borders on the day bar and ghost bands.

### Named Rules
**The No-Card Rule.** Panels have no background, border box or shadow. A panel is opened by a top hairline (Line 2) and divided by section hairlines (Line).

## Shapes

Soft and round. Containers (mode group, health banner) take 10px corners, controls 7px, day bands and small buttons 6px, floating cards 12px. Status indicators, meter dots, weekday buttons, the close mark on a band and switch knobs are circles; the state pill, filter group and switch track are full pills. Tool icons are 42px tiles with 10px corners. Borders are always 1px hairlines.

## Components

### Buttons
Warm and plain: light from the disk, no gloss.
- **Shape:** gently rounded (7px), at least 36px tall.
- **Primary:** gold fill with gold-ink text, 14px/500.
- **Hover / Focus:** lightens to a paler gold on hover, presses down 1px on active; focus is the global 2px ice ring offset 3px.
- **Ghost:** transparent with a Line 2 outline and ink text; hover adds a faint star-dust tint and a stronger outline. Used for secondary actions (Send a test, Stop waking, Add).
- **Text link:** Ink 2, brightening to ink on hover; inline actions use ring ice.

### Chips
- **Filter group:** a pill outlined in Line holding pill buttons; the pressed one fills gold with gold-ink text.
- **Weekday toggles:** 32px circles outlined in Line 2; pressed fills gold.
- **Presets:** borderless text buttons with a faint tint on hover.

### Cards / Containers
- **Corner Style:** none for panels; 10px for the mode group and health banner; 12px for the guide card.
- **Background:** the void for panels; Hull 2 for the guide card; a faint flare tint for the health banner.
- **Shadow Strategy:** see Elevation; only floating elements lift.
- **Border:** top hairline for panels.
- **Internal Padding:** 20px x 22px sections.

### Inputs / Fields
- **Style:** void fill, Line 2 outline, 7px corners, gold caret; time and model fields in mono.
- **Focus:** the outline turns ring ice with a 3px soft ice halo.
- **Error / Disabled:** flare outline; disabled at half opacity.

### Navigation
One quiet text link in the sky's top-right (Guide), Ink 2 at rest, ink on hover.

### Dot Meter (signature)
A row of 20 dots per meter. Unlit dots are faint star dust; lit dots run gold, then paler gold past the eighth, then hot cream past the fourteenth. A meter running high turns ember, a full meter flare. A name and value sit on one baseline above the row.

### Mode Control (signature)
Three options in one 10px-cornered group divided by hairlines, each with a five-dot glyph, a label and a one-line description. The selected option takes a faint gold tint, a 2px gold underline and a hot-cream label.

### Day Bar (signature)
A 76px track over a 48-column dot grid on the void, with the night hours shaded darker at both ends, axis labels above and mono tick times below. Windows are bands filled with a hot-cream to gold to ember gradient, set in mono, draggable, with a small round close mark. Upcoming automatic windows show as ghost bands: faint gold tint, inset gold hairline, cream text. The current time is a 2px ice line with a small ice tag.

### Switch
A 38x22px pill track in star dust with a muted knob; when on the track tints gold and the knob turns gold and slides right.

## Do's and Don'ts

### Do:
- **Do** build every indicator from dots: meters, tracks, status and mode glyphs.
- **Do** use disk gold for what is on or chosen and ring ice for focus, "now" and links.
- **Do** set times and numbers in mono with tabular numerals.
- **Do** separate parts with 1px hairlines on the void instead of cards.
- **Do** stop the sky when the page is hidden, the tool is off, or the reader asks for reduced motion, and paint one still frame instead.
- **Do** keep the page ground the same as the sky image's own ground.

### Don't:
- **Don't** use neon accents, glowing edges or a grid of cards.
- **Don't** use glass, blur or translucent frosted panels.
- **Don't** use warm disk colors on idle elements or as decoration.
- **Don't** use flare for anything that is not an error.
- **Don't** use chamfered corners; that was the old aurora look this system replaced.
- **Don't** apply this system to the public website under `docs/`; it keeps its alpine dawn.
