# Earth Jukebox (EJB) — Scientific Integrity & Safeguards Manifesto

> **Document Type:** Scientific Methodology, Calibration Principles & Safeguards  
> **Authors:** Pranav K & Ujwal A (NASA Space Apps Challenge 2026)  
> **Target Standard:** Decoupled Provenance-Aware Sonification

---

## 1. Core Principle: Truth in Auditory Display

In conventional "image sonification," pixel brightness or color is often arbitrarily mapped to musical pitch, creating the illusion of scientific sound when in reality the listener is merely hearing a video render artifact. 

Earth Jukebox enforces a strict boundary between **physical scientific truth** and **uncalibrated visual proxies**:
1. **Never Invent Physical Values:** If a video or image lacks a documented calibration scale, color legend, or metadata, the system will **never** convert pixels into physical quantities (e.g., meters, degrees Celsius, parts per million).
2. **Never Treat Missing Data as Zero:** In Earth Science (e.g., satellite radar gaps, polar ocean ice masks, cloudy pixels), missing data or fill values (e.g., `-999.0`) represent absence of measurement, **not zero magnitude**. Mapping missing data to zero creates severe scientific misinformation (such as sonifying a sensor outage as freezing sub-zero temperatures).
3. **Apparent Motion vs. Physical Velocity:** Pixel motion on a screen reflects camera movement, map projection distortion, or rendering style. It cannot be reported as physical fluid velocity (e.g. m/s) without geospatial projection, resolution, and temporal cadence calibration.

---

## 2. Four-Tier Source Provenance Hierarchy

Every data point entering the Earth Jukebox Scientific Feature Representation (SFR v1) is permanently tagged with one of four immutable provenance tiers:

| Tier | Name | Data Source | Calibration Method | Confidence | Default Voice Routing |
|:---:|---|---|---|:---:|---|
| **Tier 1** | **Raw Telemetry** | Direct NetCDF, HDF5, GeoTIFF, or structured CSV/JSON observational logs. | Direct instrument measurement in verified SI units. | $1.00$ | Highest priority for primary lead voice (`lead_voice`). |
| **Tier 2** | **NASA Metadata** | Official SVS / EIC metadata headers, studio parameters, observation dates. | Documented NASA visualization attributes. | $0.85$ | Metadata scaling, temporal context, and regional voicing. |
| **Tier 3** | **Calibrated Visual** | Rendered visualization video frames matched against documented NASA legends. | Nearest-stop $\text{CIELAB } \Delta E$ color matching ($\Delta E < 35.0$). | $0.70$ | Reconstructed physical scalar driving lead oscillator. |
| **Tier 4** | **Visual Proxy** | Generic uncalibrated pixel arrays, Rec. 601 luminance, optical flow delta. | Uncalibrated mathematical derivation; no physical claim. | $0.45$ | Explicitly labelled visual modulation (filter cutoff, noise). |

---

## 3. Calibration Safeguards & The CIELAB Threshold

When extracting data from rendered visualizations (Tier 3):
- **Perceptual Uniformity:** Color matching is performed in the **$\text{CIELAB}$ color space** ($L^*, a^*, b^*$) rather than standard sRGB, ensuring that Euclidean distance matches human perceptual difference.
- **$\Delta E$ Threshold ($35.0$):** If the minimum distance between a pixel's color and the nearest documented legend stop exceeds $\Delta E = 35.0$, the pixel is treated as a **non-data element** (e.g., geographic boundary lines, continental masks, grid lines, or background space).
- **Abstention Policy:** When no documented legend exists, the system automatically abstains from claiming physical measurements and falls back to a clearly labelled Tier 4 visual proxy.

---

## 4. Distinction Between Time Domains

Earth Jukebox strictly separates three distinct temporal references:
1. **Source Observation Time ($T_{\text{source}}$):** The physical calendar date and time when the satellite or sensor captured the Earth phenomenon (e.g., `2020-09-15T14:30:00Z`).
2. **Media Playback Time ($T_{\text{media}}$):** The current position of the video playback head in seconds ($t \in [0, \text{duration}]$). Audio synchronization is strictly tied to $T_{\text{media}}$, ensuring that pausing, seeking, or scrubbing the video immediately updates the audio graph.
3. **Wall-Clock Time ($T_{\text{wall}}$):** The execution time of the client browser. Used solely for latency benchmarks and internal telemetry timing.

---

## 5. Non-Fabrication & Ethical Commitments

- **No Hallucinated Parameters:** The autonomous selector operates deterministically without non-deterministic generative models in the real-time synthesis loop.
- **Auditory Legend Transparency:** Every active sound is verbally explained via the Auditory Legend, explicitly communicating the feature name, physical unit, provenance tier, and academic citation.
- **Limiter & Acoustic Safety:** All synthesizer voices pass through a dynamics limiter and compressor to guarantee listener hearing safety and prevent clipping distortion.

---

## 6. Meaning Class Orthogonality & Data Layer Sanctity (Amendment A)

Under Amendment A, Earth Jukebox strictly isolates three orthogonal meaning classes:
1. **`data`**: Encodes physical measurements (canopy height, SST, CO2, lightning counts, motion). Modulates continuous synthesizer parameters (pitch, gain, filter cutoff, pan).
2. **`context`**: Encodes the physical phenomenon domain (fire crackle, ocean wash, wind noise) at safe, subdued background levels ($\le -18\text{ dB}$).
3. **`identity`**: Encodes canonical source identifiers (tonic, scale, groove, motif) providing memorable distinctness across videos.

### Invariant Rules:
- **No Cross-Contamination:** The identity layer and context bed **never alter, scale, offset, or invert data measurements**.
- **Polarity Invariance:** Higher physical values consistently sound higher in pitch or presence across all identity modes and presets.
- **Honest Telemetry:** Telemetry and legends distinctly label which sounds represent scientific measurements versus ambient context or harmonic identity.

