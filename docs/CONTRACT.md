# OptiTone — Data Contract Specification (v1)

**NASA Space Apps Challenge 2026 — "The Earth Information Jukebox"**

- **Visual Pipeline Author:** Ujwal A
- **Sonification Engine Author:** Pranav K
- **Interface Protocol:** `window` `CustomEvent` bus in isolated world / main world
- **Version:** `1.1.1`

---

## 1. Overview & Architectural Boundary

The visual analysis pipeline (Ujwal) extracts, downsamples, and scientifically calibrates visual metrics from NASA Earth Information Center (EIC) and Scientific Visualization Studio (SVS) video feeds in real time at **10–15 Hz**.

- **Ujwal's responsibility:** Video detection, ROI cropping, Rec. 601 luminance calculation, HSV hue histogram peak detection, CIELAB scientific legend calibration, 4×8 regional grid discretization, inter-frame motion delta calculation, and event burst detection. Emits strictly normalized floats in `[0.0, 1.0]`. **Never synthesizes audio.**
- **Pranav's responsibility:** Consumes `ejb:frame` events and maps physical metrics, regional centroids, and discrete events into harmonic scales, stereo panning, timbre modulation, and percussive hits via Tone.js / Web Audio API. **Never touches pixels or DOM canvas.**

---

## 2. Event Types & Lifecycle

All events are dispatched on `window` as standard DOM `CustomEvent` instances with `{ bubbles: true, composed: true }`.

| Event Name | Direction | Timing / Condition | Payload Interface |
|---|---|---|---|
| `ejb:ready` | Visual → Audio | Media found and pipeline initialized with metadata | `EjbReadyPayload` |
| `ejb:frame` | Visual → Audio | Every throttled analysis tick (~12 Hz) | `EjbFramePayload` |
| `ejb:state` | Visual → Audio | Video state transition (`playing`, `paused`, `seeked`, `ended`, `lost-media`) | `EjbStatePayload` |
| `ejb:error` | Visual → Audio | Tainted canvas or capture failure | `EjbErrorPayload` |
| `ejb:control` | Audio → Visual | Retune tick rate, grid size, or ROI | `EjbControlPayload` |

---

## 3. Payload Definitions (TypeScript Schema)

### 3.1 `ejb:frame` Payload

```typescript
export interface EjbFramePayload {
  v: 1;                             // Contract version
  t: number;                        // Video media currentTime in seconds (sync anchor)
  frameIndex: number;               // Monotonic integer index
  vizId: string;                    // Preset ID (e.g. "gedi-forest-height")
  metrics: FrameMetrics;            // Core normalized physical metrics
  flags: FrameFlags;                // Playback and continuity flags
  events?: DetectedEvent[];         // Transient spikes (flashes, strikes)
  layers?: Record<string, number>;  // Categorical coverage (e.g. aerosols)
  profile?: SpatialProfile;         // 32-bin column & row brightness profiles
}

export interface FrameMetrics {
  brightness: number;               // Rec. 601 luma [0.0, 1.0]
  dominantColor: {                  // Dominant RGB [0.0, 1.0]
    r: number;
    g: number;
    b: number;
  };
  hue: number;                      // HSV hue from 12-bin histogram peak [0.0, 1.0]
  saturation: number;               // HSV saturation [0.0, 1.0]
  dataValue: number | null;         // Legend-calibrated physical measurement [0.0, 1.0]
  motion: number;                   // Inter-frame pixel difference [0.0, 1.0]
  regions: RegionGridMetrics;       // Coarse spatial matrix
}

export interface RegionGridMetrics {
  rows: number;                     // Default: 4
  cols: number;                     // Default: 8
  brightness: number[];             // Row-major array of length rows*cols (32 floats)
  dataValue: (number | null)[];     // Row-major array of length rows*cols (32 floats/nulls)
}

export interface FrameFlags {
  seeked: boolean;                  // True on timeline scrub; reset glide filters
  scene_cut: boolean;               // True on visual jump/transition (>0.38 delta)
}

export interface DetectedEvent {
  type: 'flash' | 'bright-spot';
  x: number;                        // Normalized X position in ROI [0.0, 1.0]
  y: number;                        // Normalized Y position in ROI [0.0, 1.0]
  intensity: number;                // Relative transient spike above baseline [0.0, 1.0]
}

export interface SpatialProfile {
  cols: number[];                   // 32 floats: column mean brightness (scanner mode)
  rows: number[];                   // 32 floats: row mean brightness
}
```

### 3.2 Example `ejb:frame` JSON Packet

```json
{
  "v": 1,
  "t": 14.25,
  "frameIndex": 171,
  "vizId": "gedi-forest-height",
  "metrics": {
    "brightness": 0.684,
    "dominantColor": { "r": 0.125, "g": 0.824, "b": 0.412 },
    "hue": 0.375,
    "saturation": 0.848,
    "dataValue": 0.582,
    "motion": 0.042,
    "regions": {
      "rows": 4,
      "cols": 8,
      "brightness": [0.12, 0.15, 0.34, 0.68, 0.72, 0.54, 0.22, 0.11, "..."],
      "dataValue":  [0.08, 0.12, 0.28, 0.61, 0.64, 0.48, 0.18, 0.09, "..."]
    }
  },
  "flags": {
    "seeked": false,
    "scene_cut": false
  },
  "events": [
    { "type": "flash", "x": 0.625, "y": 0.375, "intensity": 0.85 }
  ],
  "profile": {
    "cols": [0.1, 0.2, "... 32 floats ..."],
    "rows": [0.3, 0.4, "... 32 floats ..."]
  }
}
```

---

## 4. Contract Rules & Invariants

1. **Normalized Range `[0.0, 1.0]`**: All metric values (brightness, hue, saturation, dataValue, motion, grid elements, profile elements, event intensities) are strictly clamped floats within `[0.0, 1.0]`. No 0–255 raw integer bytes leak out.
2. **Compact 3-Decimal Precision**: Floats are rounded to 3 decimal places to keep per-frame JSON size under **1 KB**.
3. **Sync Anchor (`t`)**: `t` represents the media element's `video.currentTime` in seconds, NOT wall-clock time. Audio scheduling should synchronize against `t`.
4. **Honest Fallback (`dataValue: null`)**: If an uncalibrated visualization or an out-of-bounds ocean mask pixel is encountered, `dataValue` evaluates to `null`. In this condition, the audio engine falls back to `brightness` and `hue`.
5. **Jump Flags**: When `flags.seeked` or `flags.scene_cut` is `true`, audio synth envelopes should instantly snap rather than portamento glide across the time discontinuity.

---

## 5. Pranav's Control Channel (`ejb:control`)

The audio engine may dispatch `ejb:control` to retune the visual analysis pipeline on the fly:

```typescript
window.dispatchEvent(new CustomEvent('ejb:control', {
  detail: {
    tickHz: 15,                     // Update analysis rate (10-15 Hz)
    grid: [4, 8],                   // Row x Col spatial matrix
    roi: [0.05, 0.10, 0.90, 0.80],  // Custom region of interest
    mode: 'scientific'              // 'scientific' | 'artistic' | 'scanner'
  }
}));
```
