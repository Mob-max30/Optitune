# Earth Jukebox (EJB) — Known Limitations & System Boundaries

> **Document Type:** Operational Boundaries & Engineering Constraints  
> **Authors:** Pranav K & Ujwal A (NASA Space Apps Challenge 2026)

---

## 1. Browser & Web Platform Boundaries

### 1.1. Cross-Origin Media & Canvas Tainting (CORS)
- **Constraint:** HTML5 `<canvas>` security standards forbid calling `.getImageData()` on video elements whose remote server does not emit `Access-Control-Allow-Origin: *` headers.
- **Handling in Earth Jukebox:** 
  - Standard NASA SVS media assets (`https://svs.gsfc.nasa.gov/`) broadly support CORS.
  - If a user loads an untrusted third-party URL that blocks CORS, Earth Jukebox gracefully catches the DOM security error, displays a clear explanatory message, and falls back to:
    1. Standalone Demo Studio simulation mode.
    2. Local MP4 / WebM file upload (which runs locally with zero CORS restrictions).
    3. Dedicated synthetic generator.

### 1.2. Browser Autoplay & AudioContext Gesture Policies
- **Constraint:** Modern browsers (Chrome, Edge, Firefox) prohibit audio playback before an explicit user gesture (click, tap, keypress).
- **Handling in Earth Jukebox:** 
  - The `EarthJukeboxAudioEngine` initializes in a clean suspended state.
  - The Web Audio graph resumes smoothly upon clicking "▶ Start Sonification" or toggling the extension popup, satisfying browser autoplay policies with zero console errors.

### 1.3. Native Fullscreen Video Occlusion
- **Constraint:** When an HTML5 video enters browser native fullscreen mode (`video.requestFullscreen()`), the browser places that video element into a dedicated top-layer rendering context. Any DOM element injected into the document body (including our Shadow DOM overlay) is visually occluded by the fullscreen element.
- **Handling in Earth Jukebox:**
  - The audio engine continues running completely uninterrupted.
  - The global keyboard shortcut `Alt+Shift+S` continues to function.
  - The extension popup remains accessible from the browser toolbar.

---

## 2. Visual Extraction & Calibration Boundaries

### 2.1. Apparent Motion vs. True Physical Velocity
- **Constraint:** Frame-differencing and optical flow extract pixel displacements across the screen. If a visualization features a moving 3D camera (e.g., zooming in on an atmospheric river), pixel motion reflects both camera trajectory and physical fluid movement.
- **Handling in Earth Jukebox:**
  - Motion delta is strictly classified as a **Tier 4 Visual Proxy**.
  - It is never converted to physical velocity units (e.g., m/s) unless spatial projection and camera motion matrices are explicitly provided.

### 2.2. Video Compression Artifacts
- **Constraint:** High lossy compression (e.g. 480p low-bitrate H.264) causes chroma subsampling (YUV 4:2:0) and block boundary artifacts, introducing small color perturbations ($\pm 3-5 \Delta E$).
- **Handling in Earth Jukebox:**
  - $\text{CIELAB } \Delta E$ matching uses a generous threshold of $35.0$ and applies spatial averaging across the Region of Interest (ROI) to smooth out high-frequency compression noise.

### 2.3. Missing or Non-Monotonic Legends
- **Constraint:** Some public visualizations use artistic cyclical colormaps or lack embedded legends.
- **Handling in Earth Jukebox:**
  - The system detects uncalibrated sources, abstains from fabricating physical quantities, and clearly indicates that the sonification is operating in **Visual Proxy Mode**.

### 2.4. Colormap Coverage Discrepancies (GEDI Cyan 195° vs Low Physical Values)
- **Constraint:** In satellite imagery where large ocean or background bodies dominate the frame, dominant hue calculations reflect the overall background (e.g., cyan ocean at 195°), while calibrated legend matching only identifies land pixels (or fails threshold coverage).
- **Handling in Earth Jukebox:**
  - Under Amendment B, the UI isolates raw metrics to the "Under the hood" drawer and explicitly uses Provenance Chips ("Based on the picture only" vs "Estimated from the legend").
  - Missing or out-of-gamut sectors in the Listening Disc are rendered as dashed open outlines ("No usable data here") rather than defaulting to zero or falsely claiming physical canopy height.
