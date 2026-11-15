# Earth Jukebox (EJB) — Repeatable Demonstration & Judging Walkthrough

> **Document Type:** Demonstration Script & Verification Protocol  
> **Authors:** Pranav K & Ujwal A (NASA Space Apps Challenge 2026)  
> **Live Demo Studio:** `demo-page/dist/index.html` or `npm run dev:demo`

---

## 1. Quick Launch (Zero External Dependencies)

To run the interactive Demo Studio locally:
```bash
npm run dev:demo
# Or open demo-page/dist/index.html directly in any modern browser!
```

---

## 2. Step-by-Step Demonstration Script

### Act 1: Direct Physical Calibration (GEDI Forest Canopy Height — SVS 4950)
1. In the **Active NASA Preset** dropdown, select **`GEDI Global Forest Canopy Height`**.
2. Observe the **Legend Physical Value** card: it immediately displays calibrated canopy height in **meters ($0 - 60\text{ m}$)** with Provenance Tier 3 (`tier3_calibrated_visual`).
3. Click **`▶ Start Sonification`**.
4. **Listen:** As the visualization scrubs through dense tropical rainforest vs. sparse savannas, the **lead voice frequency** sweeps logarithmically from deep $130\text{ Hz}$ up to bright $880\text{ Hz}$.
5. **Auditory Legend:** The verbal legend updates: *"Taller canopy height and higher elevation sound higher in pitch."*

### Act 2: Multi-Mode Synthesis & Spatial Hearing
1. While audio is playing, locate the **Sonification Mode** selector.
2. Switch from **`Scientific (Continuous Physical)`** to **`Musical / Aesthetic (Quantized)`**.
3. **Listen:** The sound instantly quantizes into a harmonious pentatonic/Akebono chord scale whose root note shifts with the dominant vegetation hue.
4. Switch to **`Caldwell-73 Scanner Mode`**.
5. **Listen:** A 16-bank sine additive synthesis engine performs a horizontal time-sweep where vertical spatial coordinate maps directly to pitch frequency.

### Act 3: Discrete Event Detection (Lightning Events from ISS — SVS 5011)
1. Select **`Lightning Events Observed from ISS`** in the preset dropdown.
2. Observe the video feed: as bright optical thunderstorm pulses flash across the screen, discrete transient strikes trigger on the **percussion voice**.
3. **Listen with headphones:** Strikes in the Western hemisphere click sharply in the left ear; strikes in the Eastern hemisphere click in the right ear.

### Act 4: Multi-Layer Aerosol Transport (GEOS Aerosols — SVS 5669)
1. Select **`GEOS Forward Processing Multi-component Aerosols`**.
2. The scene displays simultaneous wildfire smoke plumes, Saharan mineral dust, and marine sea salt spray.
3. **Listen to the acoustic separation:**
   - Wildfire smoke generates a warm **analog sawtooth** texture ($950\text{ Hz}$ bandpass).
   - Desert dust storms sound like a soft **granular pink noise** wash ($650\text{ Hz}$).
   - Marine sea salt contributes crystalline **high-register sine sparkle** ($2200\text{ Hz}$).
4. All three layers play concurrently without acoustic masking or parameter collision.

### Act 5: Uncalibrated Source & Abstention Safeguard
1. In the **Choose Video Source** dropdown, select **`Upload MP4 / WebM File`** or enter an uncalibrated custom URL.
2. Notice the **Legend Physical Value** card: it switches to *"Approximate intensity (ratio)"* with Provenance Tier 4 (`tier4_visual_proxy`).
3. **Key Scientific Proof:** Earth Jukebox **abstains from inventing physical meters or temperatures**, proving that physical values are only emitted when backed by verifiable calibration ground truth.
