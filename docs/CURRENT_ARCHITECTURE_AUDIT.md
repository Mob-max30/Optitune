# Current Architecture & Technical State Audit

**Audit Date:** 2026-11-15  
**Auditor:** Earth Jukebox Engineering Team (Pranav K & Ujwal A)

---

## 1. Architectural Overview

Earth Jukebox operates on a decoupled client-side pipeline dividing computer-vision visual extraction (Ujwal) from audio synthesis (Pranav):

```
[ NASA Video / SVS Page ]
        │
        ▼ (MediaFinder: Capture-phase Play/Pause/Seek Interceptors)
[ 32×32 Hardware Canvas Frame Downscaler ]
        │
        ▼ (In-thread Fast Pixel Math <0.08ms per tick)
[ Scientific Analysis: Rec.601, CIELAB Legend LUT, 4×8 Spatial Grid, Motion/Flash ]
        │
        ▼ (12 Hz Throttled Normalizer)
[ Contract v1 Event Bus: CustomEvent("ejb:frame") + Direct Pipeline Feed ]
        │
        ▼ (AudioEngine: Mode Selection, EMA Smoother, Spatial Centroid)
[ Multi-Voice Web Audio Synthesis: Lead, Pad, Percussion, Noise, Scanner ]
        │
        ▼ (Master Bus: -18 dB Hearing Safety Limiter & Analyser)
[ Synchronized Audio Output + Oscilloscope Visualizer ]
```

---

## 2. Strengths of the Current System

1. **Strictly Decoupled Responsibilities:** Visual analysis never touches audio nodes; the audio engine never parses raw pixel buffers. The JSON Contract v1 maintains clean architectural isolation.
2. **Sub-millisecond Real-Time Performance:** Downscaling frames to $32 \times 32$ pixels allows full Rec. 601, CIELAB nearest-stop legend calibration, and 4×8 grid analysis to complete in $<0.08\text{ ms}$, ensuring 0 dropped video frames and $< 3\%$ CPU usage on low-end hardware (e.g. Intel i3).
3. **Resilient Autoplay & User Gesture Handling:** Global capture-phase listeners (`play`, `playing`, `pause`, `seeked`) and single-click pointer unlocking bypass browser autoplay restrictions gracefully.
4. **Hearing Protection Built-In:** A hardwired `-18 dB` dynamics compressor limiter safeguards users against sudden volume surges or acoustic fatigue, which is essential for blind/low-vision accessibility.
5. **Calibrated Physical Fallbacks:** If a video matches a NASA legend, physical measurements (canopy meters, °C) are sonified; if unlisted, the engine falls back to an adaptive blend of brightness, saturation, and hue rather than failing or generating silence.

---

## 3. Identified Architectural Gaps & Next Evolutionary Steps

While the current system has robust preset-based sonification, several key capabilities are needed to reach the intended generalized semantic sonification vision outlined in the Master Blueprint:

1. **Tight Coupling to Pre-configured Presets:** The audio engine currently relies on hardcoded preset configs in `visualizations.json` and `profiles.ts`. If an arbitrary NASA visualization is presented, the system uses a generic visual proxy rather than understanding the underlying scientific phenomenon.
2. **Absence of Unified Scientific Feature Representation (SFR):** Telemetry from visual frames, NASA metadata, and future raw scientific files (NetCDF/HDF5) currently lack a common schema that explicitly documents measurement units, coordinates, calibration status, and confidence intervals.
3. **Absence of Autonomous Semantic Reasoning:** Parameter mappings (e.g. height $\to$ frequency, temperature $\to$ mode) are manually pre-selected. An autonomous mapping engine is needed to evaluate scientific dimensions (magnitude, velocity, position, periodicity), check perceptual evidence levels, detect channel conflicts, and generate reproducible mapping profiles.
4. **Static Auditory Explanations:** The auditory sound legend is currently static text. It needs to be generated dynamically based on active mapping decisions so users know exactly what every acoustic dimension represents.

---

## 4. Architectural Evolution Strategy

To bridge these gaps without breaking the existing verified codebase:
1. **Preserve Contract v1:** Keep `ejb:frame` as the real-time visual telemetry wire format.
2. **Build an SFR Adapter (`sfr/adapters/contract-v1.ts`):** Convert incoming Contract v1 frames into strongly-typed `ScientificFeatureRecord`s with explicit provenance and calibration tracking.
3. **Build Mapping Knowledge Base (`semantic/mapping-knowledge-base.ts`):** Catalogue 15–20 evidence-labelled crossmodal mappings with conflict detection.
4. **Build Semantic Selector (`semantic/selector.ts`):** In shadow/testing mode, evaluate SFR records and produce a validated `MappingProfile`.
5. **Bridge to Audio Engine:** Adapt the validated `MappingProfile` to drive existing audio voices without rewriting the core synthesis graph.
