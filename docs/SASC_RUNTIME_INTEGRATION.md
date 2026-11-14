# SASC — Runtime Integration Guide

**Subsystem:** Earth Jukebox Autonomous Scientific Sonification  
**Target Environments:** Chrome Browser Extension (`extension/dist`) & Demo Studio (`demo-page/dist`)  

---

## 1. Extension Runtime Architecture

The SASC runtime executes within the browser extension content script:

```
[NASA Web Video / Visualizer]
           │ (HTMLCanvasElement / HTMLVideoElement)
           ▼
[FrameCapturePipeline (12 Hz, 32x32 Clamped Array)]
           │
           ▼
[Direct Analysis Engine (Luma, Color, CIELAB Legend LUT, Motion, Grid)]
           │
           ▼
[Contract v1 Payload (`ejb:frame` Event)]
           │
           ▼
[SFR Adapter (`adaptContractV1ToSfr`)]
           │
           ▼
[SascAudioEngineAdapter (`processScientificFrame`)]
           ├─► Stage 1 & 2: Feature Validation & Ontology Enrichment
           ├─► Stage 3: Scientific Relationship Graph (SRG)
           ├─► Stage 4: Derived Features (Rate-of-Change, Spatial Gradient)
           ├─► Stage 5: Multi-Factor Attention Scoring ($A_i$)
           ├─► Stage 6: Redundancy Analysis (Merge, Group, Separate)
           ├─► Stage 7-10: Scene Optimization ($Q(M)$)
           ├─► Stage 11: Temporal Grammar Orchestration
           ├─► Stage 12: Scene Profile & Fingerprint Generation
           ├─► Stage 13: Web Audio Engine Multichannel Synthesis:
           │     ├── Sub-Bass Voice (35-150 Hz)
           │     ├── Quantized Lead Voice (Scale Articulation)
           │     ├── 4-Voice Harmonic Pad Voice (Latitudinal Panorama)
           │     ├── Percussion Voice (Lightning Snap & Transient Hits)
           │     └── Texture Noise Voice (Aerosols & Atmospheric Flux)
           └─► Stage 14: Dynamic Auditory Legend Generator
                 ├── Verbal Screen-Reader Announcement
                 └── Structured HTML Legend View (Popup & Demo Studio)
```

---

## 2. Default Musical Mode Configuration

To guarantee that users hear rich, memorable tunes rather than flat laboratory test tones:
1. **Default Mode:** Initialized to `Musical Mode (Quantized Scales)` (`mode: 'artistic'`) across the content script, popup UI, and Demo Studio.
2. **Dynamic Scales:** Automatically selects scale modes tailored to the scientific phenomenon:
   - GEDI Canopy: Lydian (bright, ascending, woody).
   - Night Lights: Akebono (celestial, dramatic).
   - Ocean SST: Dorian (fluid, ancient modal).
   - Atmospheric / Aerosols: Natural Minor (serious, poignant).
3. **Continuous Scientific Mode:** Remains fully accessible via the mode dropdown for researchers requiring unquantized physical frequency calibration.
4. **Caldwell-73 Scanner Mode:** Preserved for spatial grid sonification.

---

## 3. Reloading the Extension in Chrome

Chrome does not hot-reload unpacked extensions in memory. To test the latest build:
1. Open Chrome and navigate to `chrome://extensions/`.
2. Ensure **Developer mode** (top-right toggle) is enabled.
3. Locate the **Earth Jukebox** extension card.
4. Click the circular **Reload** icon on the extension card.
5. Navigate to any NASA visualization page (e.g. `svs.gsfc.nasa.gov` or `earth.gov`) and refresh the tab (<kbd>Ctrl</kbd>+<kbd>R</kbd>).
