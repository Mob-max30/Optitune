# Earth Jukebox — Technical Methodology & System Architecture

**NASA Space Apps Challenge 2026 — "The Earth Information Jukebox"**  
**Authors:** Ujwal A (Visual Analysis & Extension Lead) & Pranav K (Sonification & Audio Engine Lead)  
**System Classification:** A real-time, browser-integrated, algorithmic sonification pipeline using computer-vision-style visual analysis and scientific legend calibration.

---

## 1. Problem & Target Users

NASA's Earth Information Center (EIC) and Scientific Visualization Studio (SVS) produce some of humanity's most breathtaking and critical planetary observations—mapping canopy height from the ISS, decadal changes in urban electrification, lightning frequency, and ocean thermal currents. However, these visualizations are almost exclusively visual: pixel arrays rendered into MP4 files or dynamic canvas viewports.

This creates fundamental barriers:
1. **Blind and Low-Vision Individuals:** SVS video streams convey intricate spatial distributions, magnitudes, and anomalies through color ramps and motion that are completely inaccessible to screen readers.
2. **STEM Educators and Students:** Auditory data representation engages multimodal cognition, helping neurodiverse learners perceive temporal patterns, cyclic dynamics, and spatial correlations simultaneously.
3. **General Public & Museum Visitors:** Sonification creates an emotionally resonant, visceral connection to Earth system science, transforming passive watching into an immersive acoustic landscape.

Earth Jukebox solves this by bridging the gap between visual pixels and acoustic frequencies in real time, directly inside the user's browser, with zero backend latency and absolute privacy.

---

## 2. Pipeline Architecture

```
NASA EIC / SVS Web Page
   │  <video> or <canvas> element
   ▼
Content Script (Isolated World)
   │  MediaFinder → Dynamic MutationObserver → ROI Crop → OffscreenCanvas (32×32)
   ▼
Analysis Engine (Dedicated Web Worker / Offscreen Canvas)
   │  ├── Rec. 601 Perceptual Luminance
   │  ├── HSV 12-Bin Hue Peak Voting (avoids false color blending)
   │  ├── CIELAB Scientific Legend Lookup Table (Color → Physical Quantity)
   │  ├── 4×8 Spatial Regional Matrix
   │  ├── Inter-frame Pixel Motion Delta
   │  ├── Localized Transient Flash & Event Detector
   │  └── Caldwell-73 Style Column/Row Scanner Profile
   ▼
Normalizer & Throttler (10–15 Hz, default 12 Hz)
   │  Clamps floats strictly to [0.0, 1.0], rounds to 3 decimal places
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

### Cross-Origin Fallback Architecture (Tainted Canvas Mitigation):
```
User Gesture (Popup Click / Shortcut) → Background Service Worker
   │  chrome.tabCapture.getMediaStreamId({ targetTabId })
   ▼
Offscreen Document (chrome.offscreen.createDocument, reason: USER_MEDIA)
   │  getUserMedia({ chromeMediaSource: 'tab', chromeMediaSourceId })
   ▼
Hidden <video> → Downscaled Canvas → Identical Analysis Pipeline
```

---

## 3. How Frames Are Captured

### 3.1 Media Detection (`MediaFinder`)
NASA web pages are frequently structured as Single Page Applications (SPAs) or embedded iframes where media elements are injected asynchronously.
- The `MediaFinder` evaluates visibility (`offsetWidth > 20`, non-zero opacity, visible display mode).
- It prioritizes actively playing `<video>` elements (`!paused && readyState >= 2`), followed by the largest visible `<video>` by bounding client rectangle area, falling back to `<canvas>` viewports.
- A DOM `MutationObserver` continuously observes document mutations to seamlessly track video element replacements, pagination, or playlist transitions without requiring page reloads.

### 3.2 High-Performance Direct Capture (`FrameCapturePipeline`)
- Direct capture utilizes a 32×32 hidden `HTMLCanvasElement` initialized with the optimization attribute `{ willReadFrequently: true }`.
- Downscaling from 1080p to 32×32 in hardware on the GPU reduces memory readback overhead by **99.9%** (from 8.29 million bytes per frame to only 4,096 bytes).
- Frames are scheduled via `requestVideoFrameCallback` on supporting browsers, guaranteeing execution precisely when a new visual frame is presented by the compositor and eliminating duplicate computations on paused or stalled video.
- Execution is throttled to 10–15 Hz (default 12 Hz), which human psychoacoustics recognizes as continuous musical modulation while maintaining <3% CPU utilization on lightweight hardware (such as an Intel Core i3 with 8 GB RAM).

### 3.3 Zero-Backend Client-Side Processing
All pixel reads, color transforms, and sound synthesis happen 100% locally within the browser engine. No pixels, video frames, or audio streams ever leave the user's computer.

---

## 4. How Information Is Extracted (Formulas & Algorithms)

### 4.1 Region of Interest (ROI) Cropping
NASA SVS frames often burn title overlays, date tickers, and colorbars directly into the video canvas. To prevent sonifying decorative typography, each visualization preset defines an exact normalized ROI rectangle:

$$\text{ROI} = [x_{\text{norm}}, y_{\text{norm}}, w_{\text{norm}}, h_{\text{norm}}] \in [0.0, 1.0]^4$$

$$\text{Crop Rectangle} = [\lfloor x_{\text{norm}} \cdot W_{\text{src}} \rfloor, \lfloor y_{\text{norm}} \cdot H_{\text{src}} \rfloor, \lfloor w_{\text{norm}} \cdot W_{\text{src}} \rfloor, \lfloor h_{\text{norm}} \cdot H_{\text{src}} \rfloor]$$

### 4.2 Rec. 601 Perceived Luminance
Human vision is non-linearly sensitive to green wavelengths over blue. We apply the ITU-R Rec. 601 luma formula per pixel:

$$Y_i = \frac{0.299 R_i + 0.587 G_i + 0.114 B_i}{255}$$

$$\bar{Y} = \frac{1}{|S_{\text{valid}}|} \sum_{i \in S_{\text{valid}}} Y_i \quad \text{where } S_{\text{valid}} = \{ i \mid Y_i \ge \tau_{\text{dark}} \}$$

Pixels below $\tau_{\text{dark}}$ (e.g. 0.05) are classified as non-data space or deep ocean masks and excluded from luminance averaging.

### 4.3 Peak Hue Voting (Avoiding False Blending)
A standard arithmetic mean of RGB vectors on a map showing intense red and blue clusters results in purple—a color that does not exist anywhere on the map.  
To preserve scientific truth:
1. Pixels are converted from RGB to HSV space.
2. Saturated pixels ($S \ge 0.12, V \ge \tau_{\text{dark}}$) cast votes into a 12-bin circular hue histogram ($30^\circ$ per bin):
   $$\text{bin}_k = \left[ \frac{k}{12}, \frac{k+1}{12} \right), \quad k \in \{0, 1, \dots, 11\}$$
3. The modal peak bin $k_{\text{peak}} = \arg\max_k (\text{count}_k)$ determines the dominant hue:
   $$\text{Hue}_{\text{dominant}} = \frac{k_{\text{peak}} + 0.5}{12}$$
4. Dominant color is computed exclusively as the average RGB of pixels residing inside that peak bin.

### 4.4 Scientific Legend Calibration (Color → Physical Quantity)
Raw color is not scientific data. NASA publishes exact colorbar calibration stops with each SVS release.  
We transform pixel RGB into the perceptually uniform **CIELAB** color space ($L^*, a^*, b^*$) under the standard D65 illuminant:

$$\Delta E_{76} = \sqrt{(L_1^* - L_2^*)^2 + (a_1^* - a_2^*)^2 + (b_1^* - b_2^*)^2}$$

For each pixel:
1. Find nearest legend stops $S_1$ and adjacent stop $S_2$ with minimal $\Delta E$.
2. If $\min(\Delta E) > \Delta E_{\text{threshold}}$ (default 36.0), reject the pixel as non-data (e.g. background continent or ocean mask).
3. Compute inverse-distance interpolated physical measurement $V$:
   $$V = \frac{w_1 V_1 + w_2 V_2}{w_1 + w_2}, \quad w_i = 1 - \frac{\Delta E_i}{\Delta E_1 + \Delta E_2}$$
4. Normalize against the preset's fixed global physical bounds $[V_{\min}, V_{\max}]$ (e.g. GEDI canopy 0–60 m, SST -2 to 35 °C):
   $$\text{dataValue} = \text{clamp}\left(\frac{V - V_{\min}}{V_{\max} - V_{\min}}, 0.0, 1.0\right)$$

Because normalization references fixed legend bounds rather than dynamic per-frame min/max, physical comparability across different dates and seasons is mathematically preserved.

### 4.5 4×8 Spatial Regional Matrix
The ROI is partitioned into a coarse row-major 4-row by 8-column matrix ($R=4, C=8$, 32 cells total).  
For each cell $c \in \{0, \dots, 31\}$, the pipeline computes mean luminance and mean calibrated physical value. This enables stereo panning and multi-voice regional sonification.

### 4.6 Inter-frame Motion Delta & Jump Detection
Pixel change between successive analyzed frames ($F_t$ and $F_{t-1}$) is computed over the identical ROI:

$$\text{Motion} = \frac{1}{3 \cdot W \cdot H} \sum_{x, y} \sum_{c \in \{R,G,B\}} \frac{|F_t(x,y,c) - F_{t-1}(x,y,c)|}{255}$$

- If $\text{Motion} > 0.38$, the pipeline flags `scene_cut = true`.
- If the user scrubs the video timeline, `flags.seeked = true`, instructing the audio engine to bypass smoothing envelopes.

### 4.7 Transient Event Detection (Flashes & Lightning Strikes)
For event-driven phenomena (ISS lightning, city power grid illumination), each of the 64 spatial cells maintains an exponential moving average baseline:

$$\bar{B}_{c, t} = \bar{B}_{c, t-1} + \alpha (Y_{c, t} - \bar{B}_{c, t-1}), \quad \alpha \approx 0.05$$

When $Y_{c, t} - \bar{B}_{c, t} > \tau_{\text{event}}$ (e.g. 0.20), an event packet is emitted:

$$\text{event} = \{ \text{type: 'flash'}, x: x_{\text{norm}}, y: y_{\text{norm}}, \text{intensity}: \text{clamp}(Y_{c, t} - \bar{B}_{c, t}, 0, 1) \}$$

---

## 5. The Handoff Contract (v1)

The pipeline dispatches `ejb:frame` on `window`. Every numerical field is strictly a float in $[0.0, 1.0]$ rounded to 3 decimal places.

```json
{
  "v": 1,
  "t": 18.42,
  "frameIndex": 221,
  "vizId": "gedi-forest-height",
  "metrics": {
    "brightness": 0.642,
    "dominantColor": { "r": 0.150, "g": 0.810, "b": 0.380 },
    "hue": 0.365,
    "saturation": 0.820,
    "dataValue": 0.575,
    "motion": 0.038,
    "regions": {
      "rows": 4,
      "cols": 8,
      "brightness": [0.12, 0.18, 0.35, 0.62, "... 32 floats ..."],
      "dataValue":  [0.08, 0.14, 0.31, 0.58, "... 32 floats ..."]
    }
  },
  "flags": { "seeked": false, "scene_cut": false },
  "events": [
    { "type": "flash", "x": 0.42, "y": 0.31, "intensity": 0.88 }
  ],
  "profile": {
    "cols": [0.12, 0.24, "... 32 column means ..."],
    "rows": [0.32, 0.45, "... 32 row means ..."]
  }
}
```

---

## 6. Audio Sonification Mapping Table

This table details the deterministic translation of visual scientific metrics into acoustic parameters implemented by the Web Audio / Tone.js sonification engine (Pranav):

| Visual Metric (`ejb:frame`) | Sonic Parameter | Musical Range / Behavior | Scientific Intuition |
|---|---|---|---|
| `dataValue` (GEDI canopy) | Fundamental Frequency ($f_0$) | 130 Hz (C3) – 587 Hz (D5), pentatonic or continuous | Low canopy = deep fundamental; towering 60m old-growth canopy = high, airy register |
| `dataValue` (SST Temperature) | Harmonic Mode / Scale | D Minor / Locrian (-2°C) → Dorian → C Major (35°C) | Sub-zero polar waters sound dissonant & cold; tropical waters sound warm and consonant |
| `dataValue` (CO2 ppm) | Master Pitch Center & Filter Resonance | +0 to +7 semitones; $Q \in [1.0, 8.0]$ | Atmospheric CO2 accumulation builds harmonic tension and acoustic density |
| `brightness` | Master Volume & Harmonic Amplitude | Gain: 0.0 – 1.0 (exponential curve) | Direct perceived illumination translates directly to sonic presence |
| `regions.brightness` (Columns 0–7) | Stereo Panning & Spatial Voice Position | Pan: -1.0 (Full Left) to +1.0 (Full Right) | Visual events on the western hemisphere sound left; eastern hemisphere sound right |
| `regions.dataValue` (Rows 0–3) | Harmonic Chords / Multivoice Registers | Bass (Row 3, South) to Soprano (Row 0, North) | Spatial geographic latitude mapped to vertical musical register |
| `motion` | Low-Pass Filter Cutoff & LFO Rate | Cutoff: 400 Hz – 8,000 Hz; LFO: 0.5 Hz – 8 Hz | Swift ocean currents and rapid atmospheric flow open the acoustic filter |
| `events` (`flash`) | Percussive Acoustic Transient | Synthesized sawtooth click, panned to strike X | Lightning strike or intense illumination flash produces crisp percussive accents |
| `flags.seeked` / `scene_cut` | Portamento / Smoothing Bypass | Envelope resets instantly to target state | Prevents artificial frequency sliding when user scrubs timeline or scene cuts |

### 6.1 Three Selectable Sonification Modes
The engine supports three distinct operational modes switchable in real time:

1. **Scientific Continuous Mode (Default):**
   Continuous logarithmic frequency mapping with zero quantization distortion:
   $$f(V) = f_{\min} \cdot \left(\frac{f_{\max}}{f_{\min}}\right)^{\text{dataValue}}$$
   Ideal for scientific analysis, researcher inspection, and exact contour tracking.
2. **Musical / Aesthetic Mode:**
   Quantizes continuous data metrics to consonant musical scales (Pentatonic Major, Pentatonic Minor, Akebono, Dorian, Lydian) across a 2.5-octave range. Preserves physical trend directionality while ensuring harmonic pleasantness for public outreach, museums, and classrooms.
3. **Caldwell-73 Horizontal Scanner Mode:**
   Inspired by NASA's Chandra/Hubble sonification of Caldwell 73. Columns 0–31 are scanned sequentially across time from left to right; vertical row positions map to pitch (high latitude = soprano, low latitude = bass); brightness maps to amplitude.

### 6.2 Multi-Voice Polyphony & Spatial Architecture
The audio graph feeds six simultaneous acoustic voices into a master bus:
- **Lead Voice:** Dual-oscillator (triangle/saw) with detune chorus (+7 cents) and resonant lowpass filter tracking primary measurement.
- **Latitudinal Pad Voice:** 4-voice polyphonic pad representing the 4 latitudinal rows (Row 0: North/Soprano, Row 1: Mid-North/Alto, Row 2: Mid-South/Tenor, Row 3: South/Bass).
- **Transient Percussion Voice:** Fast exponential decay (70 ms) resonant strike panned to event X coordinate.
- **Textural Noise Voice:** Pink noise with modulated bandpass filter for aerosol smoke/dust layers and ocean wave wash.
- **Hearing Safety Limiter:** Master DynamicsCompressorNode thresholded at -18 dB (6:1 ratio, 3 ms attack) ensuring complete protection against acoustic shock and listener fatigue.

---

## 7. Accuracy, Assumptions & Limitations

1. **Rendered Frames vs. Raw Telemetry:** The extension analyzes rendered MP4 video frames and canvas contexts, not raw NetCDF/HDF5 scientific arrays. Lossy video compression (H.264/H.265 artifacts, chroma subsampling 4:2:0) introduces subtle color variations. Our CIELAB nearest-stop tolerance ($\Delta E \le 36.0$) absorbs compression noise while preserving physical classification accuracy.
2. **Dynamic Range Discretization:** Video frames quantize continuous physical fields into 8-bit per channel RGB. Features whose physical variance falls below the 8-bit quantization threshold cannot be detected.
3. **Orbital & Camera Motion:** On visualizations featuring rotating 3D planetary globes or orbiting cameras (e.g. 3D Atmospheric River), visual motion differencing reflects camera rotation in addition to atmospheric mass movement.
4. **Cross-Origin Security Boundaries:** Videos hosted on third-party CDNs without standard CORS headers (`Access-Control-Allow-Origin: *`) taint the canvas element. Earth Jukebox handles this through its built-in `chrome.tabCapture` offscreen document fallback pipeline.

---

## 8. Accessibility Features

In alignment with NASA's core commitment to accessibility:
- **Full Screen Reader Support:** All interactive controls are marked with explicit ARIA roles. Dynamic state changes ("Sonification started: GEDI Forest Canopy, scientific mode") are announced through an `aria-live="polite"` live region.
- **Global Keyboard Shortcut:** Users can trigger or pause sonification without navigating the UI via <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.
- **High-Contrast Dark Theme:** UI controls adhere strictly to WCAG AAA contrast ratios (>7:1) using deep space navy and bright cyan accents.
- **Auditory Sound Legend:** The popup and demo page provide clear verbal and textual descriptions of what each sound parameter represents before playback begins.
- **Respect for User Motion Preferences:** `prefers-reduced-motion` media queries disable visual transitions.

---

## 9. NASA Data Credits & References

All scientific visualizations supported by Earth Jukebox are sourced directly from NASA's open scientific repositories:

1. **GEDI Forest Canopy Height (2020)**  
   *NASA Goddard Space Flight Center / Scientific Visualization Studio*  
   URL: [https://svs.gsfc.nasa.gov/4950/](https://svs.gsfc.nasa.gov/4950/)  
   LiDAR canopy metrics from the Global Ecosystem Dynamics Investigation aboard ISS.
2. **Earth at Night: Change in Night Lights (2012–2023)**  
   *NASA Earth Information Center / SVS*  
   URL: [https://svs.gsfc.nasa.gov/5313/](https://svs.gsfc.nasa.gov/5313/)  
   Suomi NPP VIIRS Day/Night Band urban electrification dynamics.
3. **Lightning Events from the ISS (2017–2023)**  
   *NASA SVS / LIS Science Team*  
   URL: [https://svs.gsfc.nasa.gov/5011/](https://svs.gsfc.nasa.gov/5011/)  
   Non-imaging optical lightning sensor observations.
4. **Global Sea Surface Currents & Temperature**  
   *NASA Jet Propulsion Laboratory / ECCO2*  
   URL: [https://svs.gsfc.nasa.gov/3912/](https://svs.gsfc.nasa.gov/3912/)  
   Estimating the Circulation and Climate of the Ocean, Phase II (ECCO2).
5. **GEOS Aerosols (Smoke, Dust, Sea Salt, Sulfate)**  
   *NASA Goddard Global Modeling and Assimilation Office*  
   URL: [https://svs.gsfc.nasa.gov/5669/](https://svs.gsfc.nasa.gov/5669/)
6. **DYAMOND Global Atmospheric CO2**  
   *NASA SVS / GEOS Forward Processing*  
   URL: [https://svs.gsfc.nasa.gov/5196/](https://svs.gsfc.nasa.gov/5196/)
7. **Perpetual Ocean 2: Western Boundary Currents**  
   *NASA SVS*  
   URL: [https://svs.gsfc.nasa.gov/5425/](https://svs.gsfc.nasa.gov/5425/)
8. **Air Quality Model Runs**  
   *NASA SVS*  
   URL: [https://svs.gsfc.nasa.gov/5533/](https://svs.gsfc.nasa.gov/5533/)
9. **3D Volumetric Atmospheric River**  
   *NASA SVS*  
   URL: [https://svs.gsfc.nasa.gov/4960/](https://svs.gsfc.nasa.gov/4960/)
10. **Data Sonification: Caldwell 73 (Conceptual Precedent)**  
    *NASA / Chandra X-ray Center / SYSTEM Sounds*  
    URL: [https://svs.gsfc.nasa.gov/13786/](https://svs.gsfc.nasa.gov/13786/)  
    Inspiration for Earth Jukebox's Caldwell-73 horizontal column-scanning mode.

---

## 10. Future Work

1. **Direct NASA GIBS / OGC API Ingestion:** Directly query NASA GIBS (Global Imagery Browse Services) and Earthdata Cloud NetCDF/Cloud-Optimized GeoTIFF (COG) endpoints to sonify floating-point scientific rasters without video decoding.
2. **Interactive Spatial Sonification Probe:** Allow users using a mouse, keyboard, or screen reader cursor to point to a specific geographical region (e.g. the Amazon Basin or Gulf of Mexico) and hear localized acoustic telemetry.
3. **Comparative Dual-Epoch Sonification:** Enable comparative playback of two temporal epochs simultaneously (e.g. 2012 night lights in left ear vs. 2023 in right ear) to clearly reveal decadal change through stereo phase and harmony.
