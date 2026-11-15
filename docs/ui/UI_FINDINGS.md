# Earth Jukebox (EJB) — UI Findings & Scientific Discrepancy Log
**Specification Reference:** Amendment B, Section 8, 13 (Gate B0)  
**Date:** November 15, 2026  
**Authors:** Pranav K & Ujwal A  

---

## 1. Finding 1: The GEDI Forest Height "Hue 195° vs Physical Value 0.04 m" Discrepancy

### Observation
During live testing and dashboard auditing of the `gedi-forest-height` preset (SVS 4950), the following conflicting state was observed in the dashboard:
* **Preset Description**: *"Brown/dark indicates low vegetation (<5m), bright green indicates medium canopy (~30m), and cyan/white denotes tall old-growth forests up to 60m."*
* **Observed Metrics in UI**:
  * Dominant Hue: `195°` (Cyan / blue-green)
  * Physical Value: `0.04 m` (or `0.04 (approx)`)
* **Auditory Result**: The synthesizer lead oscillator plummeted to its lowest bass register (~110 Hz), sonifying "near-zero canopy height" despite the visual screen being visibly dominated by cyan/teal hues.

### Root Cause Analysis
1. **Colorbar Stops vs Screen Area Composition**:
   In `extension/src/presets/visualizations.json`, the GEDI legend stops are configured as:
   ```json
   { "color": [40, 25, 10], "value": 0 },
   { "color": [92, 70, 30], "value": 5 },
   { "color": [130, 140, 45], "value": 15 },
   { "color": [40, 160, 40], "value": 30 },
   { "color": [20, 210, 120], "value": 45 },
   { "color": [180, 255, 230], "value": 60 }
   ```
2. **Dominant Color Extraction vs Legend Matching**:
   - `extractColorMetrics()` samples the entire frame buffer (or ROI) and computes the mean RGB vector and dominant hue. In satellite imagery featuring oceans, cloud edges, or dark water bodies adjacent to coastlines, the dominant hue frequently lands at ~195° (oceanic cyan-blue).
   - `calculateAverageLegendValue()` in `legend.ts` maps pixels to the nearest stop in CIELAB $\Delta E$ space.
   - However, when the ocean or dark background pixels dominate (>80% of the frame), they either:
     a) Exceeded `maxDeltaE` (36.0) and were discarded, leaving only a tiny handful of dark coastal pixels near value `0` (hence average normalized value $\approx 0.0006 \times 60 \approx 0.04\text{ m}$); OR
     b) Fallback logic in `content/index.ts` (when coverage fraction was below 20%) defaulted `dataValue` to an uncalibrated proxy computed from luminance and motion, yielding a low float (~0.04) that the UI displayed with the calibrated unit label `m`!
3. **The Presentation Fault**:
   The legacy UI had no mechanism to distinguish between:
   - A true, calibrated scientific measurement of 0.04 meters canopy height.
   - An uncalibrated visual proxy value where legend matching was insufficient or unavailable.
   Consequently, the user saw **"0.04 m"** next to **"Hue: 195° (Cyan)"**, directly contradicting the textual claim that cyan represents 60m tall trees.

### Resolution under Amendment B
1. **Provenance Chip**: Never display physical units (`m`, `K`, `ppm`) unless the data is Provenance Tier 1, 2, or validly calibrated Tier 3. For Tier 4 (proxy/fallback), the UI must display:
   - Chip: `[Based on the picture only]`
   - Readout: `Brightness 0.41, relative to this video`
   - Caption: *"Brighter areas in the upper view, so the tone rises."* (No physical claims of "forest height" or "meters").
2. **Missing & Out-of-Gamut Cells**:
   In the 4x8 spatial grid, cells with no matching legend data must be rendered as dashed empty outlines ("No usable data here") rather than defaulting to zero or black.
3. **Under the Hood Placement**:
   Raw hue numbers and raw delta values are relocated strictly inside the "Under the hood" diagnostic drawer with an explicit annotation of calibration coverage.

---

## 2. Finding 2: Lack of Source Reliability Indicators (Provenance Invisibility)

* **Current State**: All numbers in the UI are formatted identically (e.g. `0.84`), whether derived from direct HDF5 tables or rough frame-differencing motion algorithms.
* **Impact**: Listeners and evaluators cannot verify whether the sound reflects NASA satellite measurements or browser-rendered visual proxies.
* **Resolution**: Introduction of the 4-tier Provenance Chip with icon and popover:
  - **Tier 1**: "From source data"
  - **Tier 2**: "From NASA metadata"
  - **Tier 3**: "Estimated from the legend"
  - **Tier 4**: "Based on the picture only"

---

## 3. Finding 3: Visual Clutter and SaaS Anti-Patterns

* **Current State**:
  - All-caps eyebrow labels (`LIVE SCIENTIFIC METRICS`, `SONIFICATION AUDIO MODE`)
  - Redundant meters and sliders taking up 60% of vertical space
  - Collapsed `<details>` tag hiding the auditory mapping explanation
  - Monospace font used for small descriptive text
* **Resolution**:
  - Replace with calm instrument-panel design language based on Earth night-side colors (`Night #0B1020`, `Dusk #151C36`, `Horizon #F2C9A0`, `Limb #8FD3E8`).
  - Hero focus on **The Listening Disc**.
  - Always-open, plain-language legend: "What you're hearing".
  - Sentence case throughout. No decorative gradient washes.
