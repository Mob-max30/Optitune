# Earth Jukebox (EJB) — UI Design Plan & Token Architecture
**Specification Reference:** Amendment B ("The Listening Disc") — Gate B1  
**Date:** November 15, 2026  
**Authors:** Pranav K & Ujwal A  

---

## 1. Design Philosophy & Core Job

**Subject:** Hearing NASA Earth observation data.  
**Audience:** Hackathon judges (2 minutes evaluation window), the general public, and blind/low-vision listeners.  
**Primary Job:** In 5 seconds, a new viewer can answer three questions:
1. *What is playing?* (Identified by human-readable source title and provenance chip).
2. *Where does the sound come from?* (Radial spatial rings and columns of the Listening Disc).
3. *Is the picture actually driving it?* (Live dynamic reactivity between picture bands and sound streams).

**Atmospheric Feel:** Night-side Earth observed from orbit. Instrument-panel restraint, quiet, disciplined, and legible. The single moment of boldness is **The Disc**; every other element is quiet and functional.

---

## 2. Design Tokens

### 2.1 Color Tokens
All token pairs must satisfy WCAG AA contrast (≥ 4.5:1 for body text, ≥ 3.0:1 for large text/icons/focus rings).

| Token Name | Value | Role / Usage |
| :--- | :--- | :--- |
| `--ejb-color-night` | `#0B1020` | Base background (deep orbital void) |
| `--ejb-color-dusk` | `#151C36` | Raised surfaces, cards, dock bar |
| `--ejb-color-dusk-border`| `rgba(143, 211, 232, 0.12)` | Hairline structural borders (0.5px - 1px) |
| `--ejb-color-horizon` | `#F2C9A0` | Warm terminator light (sparingly: alerts, highlights) |
| `--ejb-color-limb` | `#8FD3E8` | Thin atmosphere-blue line: focus rings, default rim, accents |
| `--ejb-color-text` | `#F1ECE4` | High-contrast body & header text on dark backgrounds |
| `--ejb-color-muted` | `#AEB6CC` | Secondary labels, descriptions, captions |

### 2.2 Dynamic Phenomenon Tints
Applied dynamically to `--ejb-color-tint` according to the active sound palette class:
* **Fire / Thermal**: `#FF6A3D`
* **Ocean / SST**: `#3CC8C0`
* **Air Quality / Aerosols**: `#B6A6FF`
* **Ice / Cryosphere**: `#BFE8FF`
* **Canopy / Biosphere**: `#8BD66B`
* **Night Lights**: `#FFC857`
* **Carbon / Greenhouse**: `#C9A66B`
* **Generic Earth**: `#8FD3E8` (Limb)

*Rule:* The phenomenon tint is applied strictly to the Disc and minimal accents. It is never the sole conveyor of status, validity, or scientific meaning.

### 2.3 Typography Scale & Font Stack
* **Font Family**: System UI fallback stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`) with tabular numerals enabled via `font-variant-numeric: tabular-nums`. Locally bundled lightweight OFL woff2 included where supported.
* **Casing**: Sentence case everywhere. Zero all-caps eyebrow labels.
* **Line Height**: 1.5 for body text, 1.2 for headings.
* **Max Measure**: Lines capped at 68 characters for comfortable reading.

| Role | Font Size | Font Weight | Line Height |
| :--- | :--- | :--- | :--- |
| `display` | `1.500rem` (24px) | 600 | 1.20 |
| `title` | `1.125rem` (18px) | 600 | 1.25 |
| `headline` | `1.000rem` (16px) | 500 | 1.30 |
| `body` | `0.875rem` (14px) | 400 | 1.50 |
| `caption` | `0.8125rem` (13px)| 400 | 1.40 |
| `mono-stat` | `0.8125rem` (13px)| 500 | 1.00 (`tabular-nums`) |

### 2.4 Shape, Spacing, and Radii
* **Control Radius**: `6px` (`--ejb-radius-control`) for buttons, chips, sliders.
* **Panel Radius**: `12px` (`--ejb-radius-panel`) for overlay panel, popup container, cards.
* **Disc & Round Controls**: `50%` (`--ejb-radius-round`).
* **Spacing Scale**: Base unit `4px`:
  * `xs`: 4px, `sm`: 8px, `md`: 12px, `lg`: 16px, `xl`: 24px, `2xl`: 32px.
* **Separation**: Information is separated by whitespace first; hairline dividers (`1px solid rgba(143, 211, 232, 0.12)`) second.

### 2.5 Motion & Animation Rules
* **The Single Orchestrated Moment**: On initial sonification start, the Disc "tunes in" from the center outwards across 1.2 seconds (`ease-out`), synchronized with the initial audio onset.
* **Audio-Reactive Motion**: Only the Disc outer rim oscillates (radius modulation $\le 6\text{px}$) driven by the Web Audio Analyser node.
* **Prefers-Reduced-Motion**: Under `prefers-reduced-motion: reduce` or when manually toggled in settings, all orbital scaling is disabled; the rim becomes a static ring with 4 Hz stepped level updates.

---

## 3. Surface ASCII Wireframes

### Surface 1: Popup Launcher (~360px wide)
```text
+------------------------------------------+
|  (O) Earth Jukebox                       |
|  GEDI Forest Canopy Height               |
|  [Chip: Estimated from the legend  (i)]  |
|                                          |
|      [   ▶   Start listening   ]         |
|                                          |
|  How it sounds                           |
|  ( Exact )  [ Musical ]  ( Sweep )       |
|  Values snap to an authentic scale.      |
|                                          |
|  [ ⛶  Open listening panel ]             |
|  [ ↗  Launch listening room ]            |
+------------------------------------------+
```

### Surface 2: In-Page Listening Panel Overlay (Shadow DOM)

#### 2A: Dock State (collapsed, bottom-right, ~56px height)
```text
+-----------------------------------------------------------+
| (O) [▶] GEDI Forest Canopy Height               [ ⛶ ] [✕] |
+-----------------------------------------------------------+
```

#### 2B: Expanded State (~380px wide × ~620px tall)
```text
+------------------------------------------+
| GEDI Forest Canopy Height     [ — ] [ ✕ ]|
| [Chip: Estimated from the legend  (i)]   |
|                                          |
|                THE DISC                  |
|          (Concentric Rings &             |
|           Reactive Outer Rim)            |
|                                          |
| Caption: Tall, dense forest across the   |
| middle view, so the tone is deep.        |
|                                          |
| [⏮]    [ ▶ / ⏸ ]    [⏭]    [🔊 ———o—] [🔇]|
|                                          |
| How it sounds:                           |
| ( Exact )  [ Musical ]  ( Sweep )        |
| Values snap to an authentic scale.       |
| [x] Add sound identity                   |
|                                          |
| ──────────────────────────────────────── |
| What you're hearing                      |
| • Canopy height                          |
|   Pitch rises as forest gets taller [Solo]|
| • Spatial position                       |
|   Left/right pan follows view       [Solo]|
| • Environmental density                  |
|   Harmonic richness reflects cover  [Solo]|
|                                          |
| > Under the hood (drawer)                |
+------------------------------------------+
```

### Surface 3: Listening Room (Full Page Studio)
```text
+--------------------------------------------------------------------------+
| (O) Earth Jukebox      [Source Picker ▼]      [Data View]  [?]  [Settings]|
|                                                                          |
| +-----------------------------------+  +-------------------------------+ |
| |                                   |  |                               | |
| |                                   |  |           THE DISC            | |
| |       NASA Visual Stage           |  |         (Large 360px)         | |
| |      (Video / Simulation)         |  |                               | |
| |                                   |  |                               | |
| +-----------------------------------+  +-------------------------------+ |
| [▶] 00:14 ────────o────────── 01:00   Caption: Dense old-growth canopy   |
| [Exact] [Musical] [Sweep]  [x] Identity                                  |
|                                        What you're hearing               |
|                                        • Canopy height (pitch)     [Solo]|
|                                        • Spatial position (stereo) [Solo]|
|                                        • Density (timbre)          [Solo]|
| ──────────────────────────────────────────────────────────────────────── |
| v Under the hood                                                         |
|   [4x8 Spatial Heatmap]  |  [Contract JSON Inspector]  |  [Diagnostics]  |
+--------------------------------------------------------------------------+
```

---

## 4. Self-Critique Against the "Avoid" List

Before proceeding to code, the design plan is audited against the section 4 prohibitions:

1. **Avoid: Single acid-green / vermilion on near-black.**  
   *Correction*: Discarded the high-saturation neon cyan/green accent. Replaced with authentic orbital dawn tones (`Night #0B1020`, `Dusk #151C36`, `Horizon #F2C9A0`, `Limb #8FD3E8`) with subtle, meaningful phenomenon tints.
2. **Avoid: Identical rounded cards with soft grey shadows.**  
   *Correction*: Removed the card grid. Surfaces are defined by spacing and hairline borders (`dusk-border`).
3. **Avoid: Tracked-out ALL-CAPS eyebrow labels.**  
   *Correction*: Stripped all `text-transform: uppercase` and `letter-spacing: 0.1em`. Replaced with plain sentence case titles ("What you're hearing", "How it sounds", "Under the hood").
4. **Avoid: Middle-dot meta strings.**  
   *Correction*: Replaced `Canopy · 30m · 12Hz` strings with structured lists and dedicated chips.
5. **Avoid: Trailing arrows on buttons.**  
   *Correction*: Buttons use clear action verbs without decorative `→` or `>>`.
6. **Avoid: Monospace font for small labels.**  
   *Correction*: Body and label typography uses standard clean proportional type; `tabular-nums` is used strictly for time and numerical readouts.
7. **Avoid: Hover animations on everything.**  
   *Correction*: Interaction states are restrained to clear background tint and focus outline transitions (150ms).
