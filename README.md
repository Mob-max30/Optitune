# 🌍 Earth Jukebox — Real-Time NASA Visual Sonification

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-blue.svg)](https://www.spaceappschallenge.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests: Vitest](https://img.shields.io/badge/Tests-Vitest%20Passing-brightgreen.svg)]()
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-orange.svg)]()

> **"Hear the pulse of Earth's living systems."**  
> An algorithmic, browser-integrated sonification pipeline that translates NASA Earth Information Center (EIC) and Scientific Visualization Studio (SVS) video feeds into rich, synchronized acoustic soundscapes in real time.

---

## 👥 Team & Module Roles

| Module | Owner | Core Responsibilities |
|---|---|---|
| **Visual Analysis & Extension Pipeline** | **Ujwal A** | Chrome extension (MV3), media detection, 32×32 hardware downscaling, Rec. 601 luminance, HSV peak hue voting, CIELAB scientific legend calibration, 4×8 regional grid matrix, inter-frame motion delta, transient flash detection, data contract schema, fallback demo studio, packaging & deployment. |
| **Sonification Engine** | **Pranav K** | Sound synthesis engine, Web Audio API / Tone.js multi-voice synth, parameter-to-audio mapping (canopy/temp → pitch, regional matrix → stereo panning, motion → timbre/filter cutoff, flashes → percussion clicks). |

**Architectural Boundary:**  
Ujwal's visual pipeline never synthesizes sound; Pranav's audio engine never touches raw pixels. The two modules communicate exclusively across the standardized **`CustomEvent` `ejb:frame` (Contract v1)** event bus.

---

## 🏗️ System Architecture

```
NASA EIC / SVS Web Page
   │  <video> or <canvas> element
   ▼
Content Script (Isolated World)
   │  MediaFinder → MutationObserver → ROI Crop → 32×32 Canvas ({ willReadFrequently: true })
   ▼
Analysis Engine (Dedicated Web Worker / Offscreen Canvas)
   │  ├── Rec. 601 Perceptual Luminance
   │  ├── HSV 12-Bin Hue Peak Voting (prevents false color blending)
   │  ├── CIELAB Scientific Legend Lookup Table (Color → Physical Unit)
   │  ├── 4×8 Regional Spatial Matrix (Row-major)
   │  ├── Inter-frame Pixel Motion Delta & Jump Detection
   │  ├── Localized Flash & Lightning Burst Detector
   │  └── Caldwell-73 Style Scanner Profile
   ▼
Normalizer & Throttler (10–15 Hz, default 12 Hz)
   │  Strictly clamped floats [0.0, 1.0], rounded to 3 decimal places
   ▼
Window CustomEvent Bus: CustomEvent "ejb:frame" (Contract v1)
   ▼
Sonification Engine (Web Audio API / Tone.js — Pranav K)
   │  ├── Physical Measurement → Harmonic Pitch & Frequency Scaling
   │  ├── 4×8 Spatial Centroid → Stereo Panning & Voice Distribution
   │  ├── Motion Delta → Timbre & Low-Pass Filter Cutoff
   │  └── Discrete Flashes → Percussive Acoustic Accents
   ▼
Real-time Multichannel Sound, tightly synchronized to video.currentTime
```

---

## 🛰️ Supported NASA Visualization Presets

Earth Jukebox includes calibrated presets for NASA's challenge catalog:

1. **GEDI Forest Canopy Height (SVS 4950)** — LiDAR canopy measurements (0–60 m) mapped to fundamental pitch center.
2. **Change in Night Lights 2012–2023 (SVS 5313)** — Decadal urban electrification dynamics driving sonic density and volume.
3. **Lightning Events from ISS (SVS 5011)** — LIS lightning strikes triggering localized percussive stereo clicks.
4. **Sea Surface Currents & Temperature (SVS 3912)** — Thermal ocean gradients (-2°C to 35°C) and swirling current pads.
5. **GEOS Aerosols (SVS 5669)** — Multi-layer atmospheric smoke, dust, sea salt, and sulfate textures.
6. **DYAMOND Global Atmospheric CO2 (SVS 5196)** — Carbon concentration plumes (395–425 ppm) driving harmonic tension.
7. **Perpetual Ocean 2 (SVS 5425)** — Mesoscale boundary current activity and eddies.
8. **Air Quality Model Runs (SVS 5533)** — Particulate matter transport and topological plumes.
9. **3D Atmospheric River (SVS 4960)** — Water vapor transport corridor width and volume.
10. **Data Sonification: Caldwell 73 (SVS 13786)** — NASA's conceptual reference for our horizontal column scanner mode.

---

## 🚀 Quickstart & Setup

### Prerequisites
- Node.js `v18+` (Tested on Node `v24`)
- Google Chrome browser

```bash
# 1. Clone repository
git clone https://github.com/ujwalamar314-cell/optitone.git
cd optitone

# 2. Install dependencies
npm install

# 3. Run unit tests (Vitest)
npm test

# 4. Build extension and standalone demo page
npm run build

# 5. Package hackathon release zip
npm run package
```

Release archive will be generated at `releases/earth-jukebox-v1.0.0.zip`.

---

## 🔌 How to Load Extension in Chrome (30-Second Guide)

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left corner.
4. Select the `extension/dist` folder inside this repository.
5. Navigate to any NASA SVS or EIC page (e.g. [GEDI Canopy Height](https://svs.gsfc.nasa.gov/4950/)).
6. Click the **Earth Jukebox** extension icon in your toolbar (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>) and click **Start Sonifying**!

---

## 🎛️ Standalone Fallback Demo Studio (Tier 2)

For judges or reviewers unable to install unpacked Chrome extensions, we provide a complete standalone fallback application in `demo-page/`:
- **Run locally:** `npm run build:demo` and open `demo-page/dist/index.html` in any modern web browser.
- Includes interactive synthetic NASA simulations (GEDI, Night Lights, Lightning, Ocean Currents), custom MP4 upload, external NASA URL loader, live 4×8 spatial heatmap, real-time audio visualizer oscilloscope, and raw contract JSON payload inspector.

---

## 📜 The Data Contract (`ejb:frame` v1)

```typescript
export interface EjbFramePayload {
  v: 1;                             // Contract version
  t: number;                        // Video media currentTime in seconds (sync anchor)
  frameIndex: number;               // Monotonic integer index
  vizId: string;                    // Preset ID (e.g. "gedi-forest-height")
  metrics: {
    brightness: number;             // Rec. 601 luma [0.0, 1.0]
    dominantColor: { r: number; g: number; b: number };
    hue: number;                    // 12-bin histogram peak hue [0.0, 1.0]
    saturation: number;             // HSV saturation [0.0, 1.0]
    dataValue: number | null;       // Legend-calibrated physical measurement [0.0, 1.0]
    motion: number;                 // Inter-frame pixel difference [0.0, 1.0]
    regions: {
      rows: number;                 // 4
      cols: number;                 // 8
      brightness: number[];         // 32 floats in [0.0, 1.0]
      dataValue: (number | null)[]; // 32 floats in [0.0, 1.0]
    };
  };
  flags: {
    seeked: boolean;                // Reset audio glide on timeline scrub
    scene_cut: boolean;             // Abrupt visual transition (>0.38 delta)
  };
  events?: Array<{ type: 'flash'; x: number; y: number; intensity: number }>;
  profile?: { cols: number[]; rows: number[] };
}
```

Detailed specification available in [`docs/CONTRACT.md`](docs/CONTRACT.md).

---

## ♿ Accessibility First

- **Keyboard Navigable:** Full logical tab indexing and visible focus rings.
- **Screen Reader Announcements:** `aria-live="polite"` region vocalizes preset changes and playback state.
- **Global Shortcut:** Instant toggle via <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.
- **High-Contrast Dark Theme:** Adheres to WCAG AAA contrast guidelines.
- **Auditory Sound Legend:** Clear spoken and written explanations of how each physical variable maps to sound.

---

## 📚 Documentation Index

- 📋 [**Data Contract Specification**](docs/CONTRACT.md) — Exact event schemas and rules shared between Ujwal and Pranav.
- 🔬 [**Scientific Methodology & Architecture**](docs/METHODOLOGY.md) — 10-section judge document detailing mathematical formulas, color science, accuracy limitations, and data credits.
- 🔒 [**Privacy Policy & Guarantee**](docs/PRIVACY.md) — Verification of 100% local, client-side execution with zero data collection.

---

## ⚖️ License & Data Credits

- **Software:** Licensed under the [MIT License](LICENSE).
- **Scientific Visualizations:** Sourced from NASA Goddard Space Flight Center, NASA Jet Propulsion Laboratory, and the NASA Earth Information Center.
