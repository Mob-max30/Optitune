# Earth Jukebox (EJB) — UI Audit & Inventory
**Specification Reference:** Amendment B (Interface and Experience Redesign: "The Listening Disc")  
**Gate:** B0 — System Audit & Data Reading Mapping  
**Date:** November 15, 2026  
**Authors:** Pranav K & Ujwal A  

---

## 1. Executive Summary

This audit establishes an exhaustive baseline of all user-facing interfaces currently shipped in the Earth Jukebox project:
1. **Extension Popup** (`extension/src/popup/popup.html`, `popup.ts`, `popup.css`)
2. **Demo Studio / Page** (`demo-page/index.html`, `demo-page/main.ts`, `demo-page/style.css`)
3. **Auditory Legend Generators** (`extension/src/accessibility/auditory-legend.ts`, `extension/src/sasc/sasc-legend.ts`)

It documents every DOM element, the exact upstream data fields read, transformations applied, and critiques the current presentation against the requirements of Amendment B.

---

## 2. Extension Popup Audit (`extension/src/popup`)

The popup acts as the primary user control surface launched from the browser toolbar (approx. 360px wide).

| DOM ID / Selector | Type | Upstream Data Source | Transformation / Formatting | Critique under Amendment B |
| :--- | :--- | :--- | :--- | :--- |
| `#statusBadge` | `span.badge` | `res.isActive`, `res.hasMedia` | CSS classes: `badge-active`, `badge-inactive`, `badge-searching`. Text: "Live", "Auto-Ready", "Searching", "Disabled" | Uses generic color pills. Communicates engine state without communicating source reliability. |
| `#srAnnouncer` | `div.sr-only` | Event-driven status strings | Polite ARIA-live announcement on user action or connection state | Announcer exists and is polite, but is not synchronized with caption updates or rate-limited to 8s. |
| `#toggleBtn` | `button.btn` | `res.extensionEnabled`, `res.isActive`, `res.isMediaPlaying` | Text toggles: "Start Sonifying", "Sonifying (Click to Pause)", "Auto-Ready (Plays with Video)" | Large button is good, but text is verbose and styling relies on generic SaaS button styling. |
| `#presetSelect` | `select.select` | `res.availablePresets` (`PRESETS` dictionary) | Populates `<option>` tags with `preset.name` | Dropdown selector encourages manual overrides instead of letting autonomous recognition work. |
| `#presetDescription`| `p.description-text` | `activePreset.description` | Plain text from visualization configuration | Static paragraph text; duplicates what the caption and chip should say. |
| `#modeSelect` | `select.select` | `res.mode` (`telemetry.mode`) | Options: `raaga`, `artistic`, `scientific`, `scanner` | Dropdown-style mode selector. Amendment B requires replacing with an explicit 3-choice control ("Exact", "Musical", "Sweep"). |
| `#raagaStatusCard` | `div` | `res.telemetry.raagaName`, `taalaName`, `currentSwara` | Renders Indian classical indicators | Tightly coupled to Raaga mode; hardcoded inline styles; visually cluttered. |
| `#volumeRange` | `input[type=range]` | `res.volume` (or local storage) | Maps 0.0 to 1.0 (step 0.05) | Basic unstyled range slider without mute toggle or clear level indication. |
| `#metricLuma` | `span.metric-val` | `p.metrics.brightness` | `p.metrics.brightness.toFixed(2)` | **RAW METRIC LEAKAGE**: Raw float shown in main popup body. Violates primary job (judges need to hear what is playing, not read lab numbers). |
| `#meterLumaBar` | `div.meter-fill` | `p.metrics.brightness` | `width: ${Math.round(brightness * 100)}%` | Generic progress bar. |
| `#metricDataValue` | `span.metric-val` | `p.metrics.dataValue`, `preset.legend` | Interpolates `min + dataValue * (max - min)` or raw `dataValue.toFixed(2)` | **CRITICAL MISMATCH LEAK**: Displays physical value even when data is uncalibrated proxy. No provenance tier chip. |
| `#metricUnit` | `span.metric-unit` | `preset.legend.unit` | Falls back to "approximate" | Small muted text, easily overlooked. |
| `#colorSwatch` | `div.color-swatch` | `p.metrics.dominantColor` | `rgb(r*255, g*255, b*255)` | Color swatch conveys little value to blind or low-vision listeners. |
| `#metricHue` | `span.metric-val` | `p.metrics.hue` | `Hue: ${Math.round(hue * 360)}°` | **RAW METRIC LEAKAGE**: Degrees of hue shown to user. |
| `#metricMotion` | `span.metric-val` | `p.metrics.motion` | `motion.toFixed(2)` | **RAW METRIC LEAKAGE**: Raw optical delta shown directly. |
| `#meterMotionBar`| `div.meter-fill` | `p.metrics.motion` | Percentage width bar | Generic progress bar. |
| `#videoTime` | `strong` | `p.t` | `t.toFixed(2)}s` | Tabular numeral missing monospace/tabular font feature. |
| `#frameIdx` | `strong` | `p.frameIndex` | String integer | Diagnostic number; irrelevant for primary listening experience. |
| `#soundLegendText` | `div.legend-content`| `res.sascScene` or `res.mappingProfile` | Rendered HTML from legend generators | Hidden inside a collapsed `<details>` accordion. Violates requirement that legend must be open and primary. |

---

## 3. Demo Studio / Page Audit (`demo-page`)

The demo studio is a full-page development dashboard with simulated feeds, video playback, and metrics.

| DOM ID / Selector | Type | Upstream Data Source | Transformation / Formatting | Critique under Amendment B |
| :--- | :--- | :--- | :--- | :--- |
| `#mediaSourceSelect` | `select` | User input | Switches between synthetic canvas, file upload, or video URL | Functional, but layout is utilitarian and cluttered with form fields. |
| `#simulationCanvas` | `canvas` | Internal procedural simulation | 640x360 2D procedural rendering | Excellent standalone offline asset; should be cinematic and calm in the Listening Room. |
| `#playerVideo` | `video` | User file / URL | HTML5 video tag | Functional video element with standard browser controls. |
| `#roiOverlayCanvas` | `canvas` | `preset.roi` | Draws bounding box overlay | Useful for debugging, but visual clutter for a calm listening experience. |
| `#playPauseBtn` | `button` | Audio engine state | "▶ Start Sonification" / "⏸ Pause Sonification" | Large button, needs unification with shared transport tokens. |
| `#timeSlider` | `input[range]` | Video / simulation time | Normalizes time 0–100 | Standard slider, lacks integration with the Disc rim. |
| `#valLuma`, `#valPhysical`, `#valHue`, `#valSat`, `#valMotion` | `div.card-value` | `payload.metrics.*` | Floating point strings | An entire column of raw dashboard metric cards ("sci-fi dashboard / SaaS template" anti-pattern). |
| `#spatialHeatmap` | `div.spatial-heatmap` | `payload.metrics.regions` (4x8 grid) | 32 `div.grid-cell` elements colored with green/cyan opacity | Rectangular grid fails to communicate connection to orbital perception; lacks screen-reader grid semantics. |
| `#audioVisualizer` | `canvas.audio-scope` | `audioEngine.getAnalyserNode()` | Time-domain oscilloscope (380x60) | Basic raw oscilloscope. The Disc rim should replace this as the audio-reactive element. |
| `#jsonPayloadView` | `pre.json-view` | `ejb:frame` payload | `JSON.stringify(payload, null, 2)` | Belongs strictly inside an "Under the hood" drawer. |

---

## 4. Auditory Legend Generators Audit

### `extension/src/accessibility/auditory-legend.ts`
* Reads `MappingProfile.auditoryLegend` (`LegendItem[]`).
* Generates HTML with stream numbers, feature names, scientific units, target voice, target auditory dimension, and verbal descriptions.
* **Positive**: Clearly describes auditory directionality (e.g. "Pitch rises as forest gets taller").
* **Gaps**: Lacks provenance chips, lacks explicit distinction between data, context, and identity classes, lacks per-stream solo controls.

### `extension/src/sasc/sasc-legend.ts`
* Reads `AuditorySceneProfile.activeStreams`.
* Categorizes streams into Foreground, Midground, Background.
* **Gaps**: Complex nested markup with dark background styles that do not match the design token palette; missing plain-language synthesis.

---

## 5. Summary of Architecture Violations to Rectify

1. **Raw Metric Prominence**: The popup and demo page currently give 50% or more of visual space to raw numbers (luminance, hue in degrees, motion delta, frame count). Under Amendment B, raw numbers belong exclusively in the "Under the hood" drawer.
2. **Provenance Obscurity**: Neither interface displays whether a value is directly measured (Tier 1/2), estimated from the colorbar (Tier 3), or derived purely from video pixels (Tier 4).
3. **Mode Selection**: Mode selection is an HTML dropdown with 4 internal options instead of an accessible 3-button segmented control ("Exact", "Musical", "Sweep").
4. **Legend Hidden**: The auditory legend in the popup is tucked into a collapsed `<details>` summary. It must be prominently visible and open.
5. **No Listening Disc**: No radial representation of the 4x8 spatial grid exists.
