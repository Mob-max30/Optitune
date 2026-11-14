# Contract v1 Deep Source Audit (Earth Jukebox)

**Audit Date:** 2026-11-15  
**Auditor:** Earth Jukebox Engineering Team (Pranav K & Ujwal A)  
**Contract Specification:** `docs/CONTRACT.md` (`EjbFramePayload` v1)

---

## 1. Executive Summary

Contract v1 defines the primary data interface between the real-time visual analysis pipeline and the Web Audio sonification engine. It guarantees strict runtime constraints:
- All metric outputs are floats clamped strictly in `[0.0, 1.0]`.
- Floating point values are rounded to 3 decimal places to keep per-frame JSON payload size below 1 KB at 12 Hz.
- Media time (`t = video.currentTime` in seconds) anchors all audio scheduling rather than wall-clock time.

---

## 2. Field-by-Field Audit

### 2.1 Metadata & Temporal Anchors

| Field | Type | Range | Unit | Producer | Consumer | Measurement vs. Proxy | Calculation / Logic | Missing-Value Behavior |
|---|---|---|---|---|---|---|---|---|
| `v` | `1` (literal) | `1` | None | `content/index.ts` | `audio/engine.ts` | Protocol | Hardcoded schema version | Fatal if `!== 1` |
| `t` | `number` | `[0.0, ∞)` | Seconds | `capture.ts` (rVFC / video) | `audio/engine.ts` | Temporal Anchor | `video.currentTime` (or synthetic accumulator) rounded to 3 decimals | Defaults to `0.0` |
| `frameIndex` | `number` | `[0, ∞)` | Integer | `capture.ts` | `popup.ts`, Debugger | Frame Counter | Monotonically increasing tick counter | `0` |
| `vizId` | `string` | Preset ID | String ID | `content/index.ts` | `audio/engine.ts` | Provenance ID | Matched SVS ID, URL pattern, or fallback | Defaults to `'general-earth'` |

---

### 2.2 Core Metrics (`metrics`)

#### `metrics.brightness`
- **Type:** `number`
- **Range:** `[0.0, 1.0]`
- **Unit:** Normalized luminance ratio
- **Producer:** `analysis/luminance.ts` (`calculateAverageLuminance`)
- **Consumer:** `audio/engine.ts` (Lead Voice gain, filter cutoff, fallback pitch)
- **Measurement vs. Proxy:** Visual Proxy (perceptual video luma, not calibrated physical candela or radiometric flux).
- **Calculation:** Rec. 601 luma $Y = 0.299R + 0.587G + 0.114B$ across all pixels exceeding `ignoreDark` threshold, normalized by 255.
- **Missing-Value Behavior:** Clamped to `0.0`.

#### `metrics.dominantColor`
- **Type:** `{ r: number, g: number, b: number }`
- **Range:** Each channel `[0.0, 1.0]`
- **Unit:** Normalized RGB
- **Producer:** `analysis/color.ts` (`extractColorMetrics`)
- **Consumer:** `popup.ts` (Swatch UI), `audio/engine.ts`
- **Measurement vs. Proxy:** Visual Proxy (video frame color average).
- **Calculation:** Mean RGB of non-dark pixels divided by 255.
- **Missing-Value Behavior:** `{ r: 0, g: 0, b: 0 }`.

#### `metrics.hue`
- **Type:** `number`
- **Range:** `[0.0, 1.0]`
- **Unit:** Normalized circular angle ($0.0 = 0^\circ, 1.0 = 360^\circ$)
- **Producer:** `analysis/color.ts`
- **Consumer:** `audio/engine.ts` (timbre selection, pad key transposition, frequency modulation)
- **Measurement vs. Proxy:** Visual Feature (peak bin from 12-bin histogram, avoids false purple blends).
- **Calculation:** Converts RGB to HSV, bins hue into 12 segments (30° each), picks the histogram peak bin center.
- **Missing-Value Behavior:** `0.0`.

#### `metrics.saturation`
- **Type:** `number`
- **Range:** `[0.0, 1.0]`
- **Unit:** Normalized ratio
- **Producer:** `analysis/color.ts`
- **Consumer:** `audio/engine.ts` (fallback blend `brightness * 0.7 + saturation * 0.3`)
- **Measurement vs. Proxy:** Visual Feature.
- **Calculation:** $( \max(R,G,B) - \min(R,G,B) ) / \max(R,G,B)$.
- **Missing-Value Behavior:** `0.0`.

#### `metrics.dataValue`
- **Type:** `number | null`
- **Range:** `[0.0, 1.0]` (when calibrated) or `null`
- **Unit:** Normalized physical unit relative to fixed legend range $[V_{\min}, V_{\max}]$
- **Producer:** `analysis/legend.ts` (`calculateAverageLegendValue`)
- **Consumer:** `audio/engine.ts` (Lead frequency $f_0$)
- **Measurement vs. Proxy:** **Calibrated Scientific Measurement** (where preset legend exists); **Visual Proxy** fallback when `null`.
- **Calculation:** For each pixel, converts RGB to CIE $L^*a^*b^*$, finds nearest stops on NASA color ramp, interpolates physical value, normalizes against fixed $[V_{\min}, V_{\max}]$ (e.g. GEDI 0–60 m, SST -2 to 35 °C). Non-legend pixels $(\Delta E > 36)$ are rejected.
- **Missing-Value Behavior:** Explicit `null`. Audio engine falls back to `brightness * 0.7 + saturation * 0.3`.

#### `metrics.motion`
- **Type:** `number`
- **Range:** `[0.0, 1.0]`
- **Unit:** Normalized inter-frame difference
- **Producer:** `analysis/motion.ts` (`calculateMotionAndEvents`)
- **Consumer:** `audio/engine.ts` (Filter cutoff modulation, noise voice intensity)
- **Measurement vs. Proxy:** Visual Motion Proxy (pixel delta; not georeferenced fluid velocity).
- **Calculation:** $\frac{1}{3 W H} \sum_{x,y,c} \frac{|F_t(x,y,c) - F_{t-1}(x,y,c)|}{255}$.
- **Missing-Value Behavior:** `0.0` on first frame or when `seeked: true`.

#### `metrics.regions`
- **Type:** `RegionGridMetrics` (`{ rows: 4, cols: 8, brightness: number[], dataValue: (number | null)[] }`)
- **Range:** 32 floats in `[0.0, 1.0]`
- **Unit:** Regional normalized luminance and calibrated values
- **Producer:** `analysis/regions.ts` (`calculateRegionGrid`)
- **Consumer:** `audio/spatial.ts`, `audio/synths/pad-voice.ts` (Latitudinal 4-row harmonic voicing and stereo panning centroid)
- **Measurement vs. Proxy:** Mixed: `brightness` is a regional visual proxy; `dataValue` is regional calibrated physical measurement.
- **Calculation:** 4×8 spatial partition (each cell is $W/8 \times H/4$), computing cell-wise average luma and nearest-stop legend values.
- **Missing-Value Behavior:** Arrays filled with `0.0` and `null`.

---

### 2.3 Control Flags & Discrete Events

#### `flags.seeked`
- **Type:** `boolean`
- **Producer:** `content/index.ts` (via `video.onseeked`)
- **Consumer:** `audio/smoother.ts` (bypasses EMA smoothing, resets envelopes instantly)
- **Calculation:** True on media scrub; resets to false on subsequent frame.

#### `flags.scene_cut`
- **Type:** `boolean`
- **Producer:** `analysis/motion.ts`
- **Consumer:** `audio/smoother.ts`
- **Calculation:** True when inter-frame motion delta exceeds threshold ($> 0.38$).

#### `events` (Optional)
- **Type:** `DetectedEvent[]` (`{ type: 'flash', x: number, y: number, intensity: number }`)
- **Producer:** `analysis/motion.ts`
- **Consumer:** `audio/synths/percussion.ts`
- **Measurement vs. Proxy:** Phenomenological Event Detection.
- **Calculation:** Maintained per-cell EMA baseline ($\alpha = 0.05$). Triggered when local cell luma jumps $> 0.20$ above baseline. Panned to strike $X$.

#### `profile` (Optional)
- **Type:** `SpatialProfile` (`{ cols: number[], rows: number[] }`)
- **Range:** 32 floats per dimension
- **Producer:** `analysis/regions.ts` (`calculateSpatialProfiles`)
- **Consumer:** `audio/synths/scanner-voice.ts` (Caldwell-73 horizontal column scanner)
- **Calculation:** Column-wise and row-wise mean luma across the 32×32 canvas.
