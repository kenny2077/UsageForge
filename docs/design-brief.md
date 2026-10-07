# Design Brief: LimitKiller landing page

Sources, both fetched on 2026-10-07 with curl, including their CSS:
- **auroraforgelab.com**: static HTML plus `styles.css` and `script.js`. The values below are copied from the stylesheet.
- **hermes-agent.nousresearch.com**: Next.js, server-side rendered, so the full text was in the HTML. Values come from its 3 CSS chunks. Its fonts are commercial (Rules Gothic, Aeonik Fono), so we use the stand-ins listed below.

## 1. Vibe in one line
Aurora gives the brand: a dark night sky, aurora-teal light, amber "signal" accents, pixel/lamp-board textures, condensed heavy display type, and chamfered corners. Copy is calm and plain about privacy.
Hermes gives the product-page skeleton: hero, then a one-line install command, then platforms, then 6 numbered features, then FAQ, then pricing, then footer. It also gives the dev-tool habits: mono uppercase labels, hairline borders, and buttons that copy text.

## 2. Color tokens (dark only; Aurora sets `color-scheme: dark`, theme-color `#050c1a`)
```css
--deep:#02060e;    /* page/html bg, footer bg */
--night:#050c1a;   /* main content bg */
--night-2:#0a1426; /* card / surface */
--night-3:#111e36; /* raised surface (card gradient start) */
--ink:#eaf2f8;     /* primary text */
--ink-2:#c8d6e4;   /* secondary text, ledes */
--muted:#93a7bb;   /* sub copy, nav links */
--faint:#62778d;   /* labels, meta */
--line:rgba(150,205,245,.14);  --line-2:rgba(150,205,245,.28); /* borders (drawn as inset box-shadow) */
--aurora:#4fe3d0; --aurora-hi:#8cf2e6; /* PRIMARY accent: buttons, kickers, selection */
--cyan:#4cc9f0; --blue:#5b8cff; --violet:#9b7dff; /* sky glow only */
--amber:#ffb547; --amber-hot:#ff8a3d;  /* signal: status dots, focus ring, emphasis words, index numbers */
```
Per-product tints, used for a card's top edge and media glow: `#58f0a8`, `#ffb14a`, `#6aa7ff`, `#ff6fae`, `#b48cff`.
Hermes palette, for reference only, not to copy: page `#0000f2` (electric blue) with text `#f2f2f2`/`#f5f5f5`, accent yellow `#f2f200`, code block bg `#1a1a1a`. Treat Hermes's single-color confidence as a lesson, not a palette.

## 3. Typography
- **Display (h1–h3):** `Archivo` variable (Google Fonts has it with a `wdth` axis). Use weight 800, `font-stretch:72%` (62–85% depending on the element), `line-height:.9–.94`, `letter-spacing:-0.01em`, `text-wrap:balance`.
- **Body:** `Instrument Sans` (Google Fonts), `400 17px/1.6`, antialiased. Ledes 17–20px in `--ink-2`, sub copy 18px in `--muted`, `max-width:54ch`.
- **Mono:** `ui-monospace,"SF Mono",Menlo,Consolas,monospace`. Use it for kickers and labels: `500 12.5px`, `letter-spacing:.12–.14em`, uppercase. Also for status lines (`.06em`), fact chips, and index numbers (amber `600 13px`). Hermes does the same (mono, uppercase, `tracking .1em` on all buttons), so lean on it more: use mono for button labels and the install snippet too.
- **Sizes:** hero h1 `clamp(54px,8.2vw,132px)` at `max-width:13ch`; section h2 `clamp(46px,6.4vw,100px)`; card h3 `clamp(42px,4.8vw,76px)`; big statement `clamp(34px,5vw,84px)` with `font-stretch:74%`. Hermes scale for comparison: hero 108, heading 80, subheading 48, title 36, label 14, body 16, meta 12.

## 4. Layout
- **Gutter / max width:** `--gutter: max(clamp(16px,5vw,72px), calc((100% - 1240px)/2))`. Content is about 1240px wide, and sections pad with the gutter rather than a container div. Hermes measure: copy column 680px max, outer gutters 40px (24px on small screens).
- **Section rhythm:** vertical padding `clamp(88px,14vh,160px)`; section-head margin-bottom `clamp(48px,8vh,88px)`; kicker→h2 20px; h2→sub 22px. Hermes features section uses `padding-block:180px 80px`.
- **Nav:** fixed, 68px tall (60px on mobile), grid `1fr auto 1fr`. Brand sits left: a 44×24 pixel mark plus the name in Archivo 700/85%. Links sit centered: 14.5px, `--muted`, chamfered hover bg `rgba(79,227,208,.1)`. The nav is transparent at the top. Once scrolled it gets `rgba(5,12,26,.8)` + `backdrop-filter:blur(14px) saturate(1.2)` + a bottom `--line` border. Hermes puts an "Install" CTA on the right; we should too.
- **Hero:** `min-height:100svh` with content pinned to the bottom (`justify-content:flex-end`). Grid is `1fr 360px`, gap 48: copy on the left, a glassy "Lab index" panel on the right (`rgba(5,12,26,.72)` + blur 14, mono header, numbered list). Below 1100px it collapses to one column. Hermes hero is a 2-column grid, 1fr/1fr, gap 30, min-h 520, padding 80px.
- **Grids:** features are 3 columns (Hermes `repeat(3,1fr)`, gap `80px 40px`). Product cards are 2 columns `1.08fr .92fr` (copy | media) and stack below 960px. Footer is `repeat(auto-fit,minmax(190px,1fr))`.
- **Footer:** `--deep` bg, sticky `bottom:0`. The page lifts off it on scroll (`.page` has `box-shadow:0 30px 60px -20px rgba(0,0,0,.7)`). Mono uppercase column headers, a giant dot-matrix wordmark, then a meta row. ↗ marks external links.

## 5. Visual motifs (in order of importance)
1. **Lamp board (the signature).** A grid of square pixel lamps separated by dark seams, laid over aurora radial glows:
   ```css
   --cell:12px; --seam:3px;
   --lamps: repeating-linear-gradient(90deg,transparent 0 calc(var(--cell) - var(--seam)),var(--seam-color) 0 var(--cell)),
            repeating-linear-gradient(0deg,transparent 0 calc(var(--cell) - var(--seam)),var(--seam-color) 0 var(--cell));
   background: var(--lamps),
     radial-gradient(70% 45% at 72% 26%,rgba(76,201,240,.34),transparent 70%),
     radial-gradient(55% 40% at 30% 18%,rgba(79,227,208,.28),transparent 70%),
     radial-gradient(40% 30% at 88% 10%,rgba(155,125,255,.22),transparent 70%),
     linear-gradient(180deg,#030814,#0a1730 60%,var(--night));
   ```
   On Aurora, JS swaps this for a canvas: an animated aurora curtain, dithered into 6 bands and drawn with nearest-neighbour scaling, which the cursor warms. The CSS version above is the no-JS fallback and is good enough on its own.
2. **Chamfered corners instead of border-radius.** `clip-path: polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px)` for buttons and chips. For large cards, cut only two opposite corners at 18px. The only rounded radius is device screenshots (34px). Hermes is square too (`rounded-none`, at most 4–6px).
3. **Borders as inset shadows:** `box-shadow: inset 0 0 0 1px var(--line)`. Hermes uses 0.5px hairlines and dotted top borders on FAQ rows.
4. **Card top edge:** a 2px gradient `linear-gradient(90deg,transparent,var(--tint) 30%,var(--aurora) 70%,transparent)` at opacity .8. Card bg is `linear-gradient(160deg,var(--night-3),var(--night-2) 55%)`.
5. **Cursor flashlight:** `radial-gradient(260px circle at var(--mx) var(--my),rgba(79,227,208,.08),transparent 70%)` on hover.
6. **Status dot:** an 8px amber square with `box-shadow:0 0 12px rgba(255,181,71,.7)`, next to mono text such as "Free and open source".
7. **Kicker:** an 8px teal square, plus a ghost square 12px to its right at 35% opacity, then the uppercase mono label.
8. **Noise:** Hermes overlays a tiled noise texture with `mix-blend-mode:color-burn; opacity:.2` on art. Optional for us.
9. **Motion:** easing `cubic-bezier(.16,1,.3,1)`. Big statement paragraphs light up word by word while pinned (words go from `rgba(234,242,248,.18)` to `--ink`, emphasis words go amber). Product cards are sticky and stack, each offset 18px from the last. Dialogs use a "rise" entrance (`translateY(24px)`, .45s). The scroll cue is a pixel drip, `steps(3)`. Hermes adds a blinking cursor (`blink`), marching-ants borders (`march`), and a hover sweep on buttons. Respect `prefers-reduced-motion`; Aurora turns every animation off under it.
10. **Buttons:** primary has a `--aurora` bg, `--night` text, `600 15px`, min-h 48, padding `14px 22px`, chamfered, and goes to `--aurora-hi` on hover. Ghost has `rgba(234,242,248,.06)` + `inset 0 0 0 1px var(--line-2)`. Press is `translateY(1px) scale(.99)`. Focus is a 2px amber outline at offset 3, and the chamfer is dropped while focused.

## 6. Voice & copy
- **Aurora:** calm, concrete, privacy-first. Short declarative headlines end with a period, and there is no hype. Sentence case throughout.
  - H1: "Private AI that works offline." Section: "Five products. One private standard." Contact: "Get in touch."
  - Statement: "Most AI lives on someone else's server. Ours is built to run on yours." Emphasis: "*Your device does the work, and your data never has to leave it.*"
  - CTAs: "Explore the products", "Read the source ↗", "Open the demo ↗", "Try the live demo ↗", "Copy address".
  - Fact chips are 2–4 word nouns: "On-device LLM", "No sign-up", "No backend", "No AI calls".
- **Hermes:** bolder, in title case: "The Agent That Grows With You". Each feature has a mono label (`#1 Connect`, `#2 Remember`, …) over a 2-word title ("Lives Everywhere", "Persistent Memory", "Tasks Multiplied") and one concrete sentence. Pricing CTAs are playful ("Release Hermes", "Liberate Hermes", "Unleash Hermes").
- **Blend:** Aurora's restraint for headlines and body, plus Hermes's `#N Verb` labels and concrete feature sentences.

## 7. Hermes section order (the template)
1. **Nav:** brand, Docs, Community, then an **Install** CTA on the right.
2. **Hero:** H1 plus two CTAs ("Download desktop app" / "Install via terminal"), OS tabs (macOS / Linux / Windows), and **one copyable command** (`curl -fsSL …/install.sh | bash`) with a copy button. Hero art on the right.
3. **Platforms:** three cards (macOS 12+ / Windows 10/11 / Any distro), each with its own download or install link.
4. **Features:** 3×2 grid, each item `#N Verb`, a title, and one sentence.
5. **FAQs:** accordion with dotted dividers and a "View Docs" link. Questions cover pricing, getting started, data persistence, and what happens when you stop it.
6. **Pricing:** tiers (Free / Plus / Super / Ultra) with one tag marked "// most popular".
7. **Footer:** product footer (tagline, ©, Terms, Privacy, "MIT License"), then the larger org footer with link columns: Research, Products, Resources, Platform.

## 8. How to blend for LimitKiller
- **Take from Aurora:** every token above, both fonts, the lamp-board hero sky, chamfers, mono kickers, amber status dots, the gradient card edge, the sticky reveal footer with the dot-matrix wordmark, and the calm copy voice.
- **Take from Hermes:** the section order in §7, an install command block in the hero (`--night-2` bg, mono 14px, `$ ` prompt in `--faint`, chamfered copy button with "Copied" feedback in amber), a 3-column numbered feature grid, and the FAQ accordion. Skip pricing unless LimitKiller has paid tiers. Add an "Install" CTA to the nav.
- **Suggested page:** Nav → Hero (h1 + lede + CTAs, install snippet with OS tabs, and a "Lab index"-style glass panel on the right repurposed as a live stats/terminal readout) → optional pinned statement paragraph → 6 features → "How it works", a numbered 01–03 sequence (GUESSED: neither site has one, but it fits the pattern) → FAQ → final CTA reusing the contact block style → footer.
- **Do not copy:** Hermes's blue background, its commercial fonts, or its rounded-xs chips. Keep everything dark, teal, and amber.
