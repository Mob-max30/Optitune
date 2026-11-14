# NASA Visualization Profile Audit (Earth Jukebox)

**Audit Date:** 2026-11-15  
**Auditor:** Earth Jukebox Engineering Team (Pranav K & Ujwal A)  
**Specification Sources:** `extension/src/presets/visualizations.json` & `extension/src/audio/profiles.ts`

---

## Summary of All Presets

Earth Jukebox currently defines **10 calibrated challenge presets** plus **1 general adaptive fallback profile**:

| # | Preset ID | SVS ID | Phenomenon | Calibrated Variable | Unit | Physical Range | Default Mode | Primary Metric |
|---|---|---|---|---|---|---|---|---|
| 1 | `gedi-forest-height` | 4950 | Forest Canopy Height | Canopy Height | m | 0 – 60 | Scientific | `dataValue` |
| 2 | `night-lights` | 5313 | Urban Electrification | Luminance / Density | ratio | 0 – 1 | Artistic | `brightness` |
| 3 | `iss-lightning` | 5011 | Lightning Discharges | Optical Flashes | ratio | 0 – 1 | Scientific | `brightness` |
| 4 | `sst-currents` | 3912 | Ocean Temp & Currents | Sea Surface Temp | °C | -2 – 35 | Artistic | `dataValue` |
| 5 | `geos-aerosols` | 5669 | Aerosol Particulates | Aerosol Coverage | ratio | 0 – 1 | Artistic | `layers` |
| 6 | `dyamond-co2` | 5196 | Atmospheric CO2 | Carbon Concentration | ppm | 395 – 425 | Scientific | `dataValue` |
| 7 | `perpetual-ocean` | 5425 | Boundary Ocean Eddies | Current Streak Velocity | ratio | 0 – 1 | Artistic | `motion` |
| 8 | `air-quality` | 5533 | Particulate Matter | Plume Optical Depth | ratio | 0 – 1 | Scientific | `dataValue` |
| 9 | `atmospheric-river` | 4960 | Water Vapor Transport | Vapor Plume Mass | ratio | 0 – 1 | Artistic | `brightness` |
| 10 | `caldwell-73` | 13786 | NASA Scanner Sonification | Astronomical Flux | ratio | 0 – 1 | Scanner | `brightness` |
| 11 | `general-earth` | N/A | General Earth Observation | Adaptive Illumination | ratio | 0 – 1 | Scientific | `brightness` |

---

## Detailed Profile Audit

### 1. GEDI Forest Canopy Height (`gedi-forest-height`)
- **NASA Source:** SVS 4950 ([https://svs.gsfc.nasa.gov/4950/](https://svs.gsfc.nasa.gov/4950/))
- **Scientific Phenomenon:** Global LiDAR canopy top height from the ISS GEDI mission.
- **ROI:** `[0.04, 0.10, 0.92, 0.80]` (excludes title banner and color bar).
- **Physical Bounds:** `min: 0`, `max: 60`, `unit: "m"`.
- **Legend & Calibration:** 4-stop CIELAB lookup: `#2d1e08` (0m, bare soil/shrub), `#356314` (15m, woodland), `#148c3b` (35m, dense forest), `#38e8a8` (60m, towering old-growth). Non-vegetation background rejected at $\Delta E > 36.0$.
- **Audio Mapping:** Continuous physical log mapping $f_0 \in [130.81\text{ Hz}, 587.33\text{ Hz}]$ ($C_3 \to D_5$). Low brush sounds deep and woody; tall forest canopy ascends to airy resonant register.
- **Voices Used:** Lead Voice (triangle wave, 600–5000 Hz filter cutoff) + Latitudinal Pad.
- **Assumptions:** 8-bit video compression artifacts do not displace color outside the $\Delta E \le 36.0$ tolerance threshold.
- **Limitations:** Video animation only captures sampled time slices, not continuous daily LiDAR updates.

### 2. Earth at Night: Change in Night Lights (`night-lights`)
- **NASA Source:** SVS 5313 ([https://svs.gsfc.nasa.gov/5313/](https://svs.gsfc.nasa.gov/5313/))
- **Scientific Phenomenon:** Decadal changes in planetary electrification from Suomi NPP VIIRS Day/Night Band.
- **ROI:** `[0.00, 0.05, 1.00, 0.90]`.
- **Thresholding:** `ignoreDark: 0.05` excludes deep space and unlit oceanic areas.
- **Audio Mapping:** Artistic mode on traditional Japanese **Akebono scale** ($G_3 \to G_5$, 196–784 Hz). Illumination drives crystalline bell-like overtone shimmer; motion drives pulse rate.
- **Voices Used:** Lead Voice (sine wave with bandpass filter) + Latitudinal Pad.
- **Assumptions:** Bright pixels represent anthropogenic electric illumination or gas flares.
- **Limitations:** Lunar illumination variations and cloud cover can introduce visual brightness shifts unrelated to power grid growth.

### 3. Lightning Events from the ISS (`iss-lightning`)
- **NASA Source:** SVS 5011 ([https://svs.gsfc.nasa.gov/5011/](https://svs.gsfc.nasa.gov/5011/))
- **Scientific Phenomenon:** Optical lightning detection events from the ISS Lightning Imaging Sensor (LIS).
- **ROI:** `[0.00, 0.00, 1.00, 1.00]`.
- **Event Detector:** Baseline alpha $\alpha = 0.05$, flash threshold $\tau = 0.20$.
- **Audio Mapping:** Deep atmospheric wind/storm rumble drone ($G_2 \to G_4$, 98–392 Hz) + transient percussive clicks panned directly to strike $X$ coordinates.
- **Voices Used:** Lead Voice (sawtooth, lowpass 400–3000 Hz) + Percussion Voice (snappy 70ms decay) + Latitudinal Pad.
- **Assumptions:** Rapid brightness spikes across localized 4×8 cells represent electrical lightning discharges.
- **Limitations:** High sensor glare or orbital day/night transitions can trigger transient false alarms.

### 4. Global Sea Surface Currents & Temperature (`sst-currents`)
- **NASA Source:** SVS 3912 ([https://svs.gsfc.nasa.gov/3912/](https://svs.gsfc.nasa.gov/3912/))
- **Scientific Phenomenon:** Estimating the Circulation and Climate of the Ocean (ECCO2) thermal gradients and mesoscale current velocities.
- **Physical Bounds:** `min: -2.0`, `max: 35.0`, `unit: "°C"`.
- **Legend & Calibration:** 4-stop thermal ramp: `#1e1b4b` (-2°C, polar freezing), `#0284c7` (10°C, temperate), `#eab308` (24°C, subtropical), `#dc2626` (35°C, tropical).
- **Audio Mapping:** Dorian ocean pad ($A_2 \to C_5$, 110–523 Hz). Current flow speed opens wave lowpass filter sweeps; temperature modulates harmonic mode and pitch.
- **Voices Used:** Lead Voice (sine) + Noise Voice (ocean wave wash) + Latitudinal Pad.
- **Assumptions:** Surface thermal streaks correspond to underlying convective transport.
- **Limitations:** Visual flow in rendered animation is rendered with synthetic streaklines; physical velocity is calibrated to animation frame delta.

### 5. GEOS Aerosols (`geos-aerosols`)
- **NASA Source:** SVS 5669 ([https://svs.gsfc.nasa.gov/5669/](https://svs.gsfc.nasa.gov/5669/))
- **Scientific Phenomenon:** Multi-component atmospheric aerosol transport (dust, smoke, sea salt, sulfate).
- **Layers:** `['dust', 'smoke', 'seaSalt', 'sulfate']`.
- **Audio Mapping:** Multi-textured soundscape. Smoke = warm analog saw (950 Hz bandpass); Dust = filtered pink noise (650 Hz); Sea Salt = glassy high-register sines (2200 Hz).
- **Voices Used:** Textural Noise Voice + Lead Voice (sawtooth) + Latitudinal Pad.
- **Assumptions:** Color classes distinctly partition into aerosol species.
- **Limitations:** Co-located aerosol plumes can blend visually.

### 6. DYAMOND Global Atmospheric CO2 (`dyamond-co2`)
- **NASA Source:** SVS 5196 ([https://svs.gsfc.nasa.gov/5196/](https://svs.gsfc.nasa.gov/5196/))
- **Scientific Phenomenon:** High-resolution atmospheric carbon dioxide concentration dynamics.
- **Physical Bounds:** `min: 395.0`, `max: 425.0`, `unit: "ppm"`.
- **Legend & Calibration:** Color ramp from pristine background (395 ppm) to industrial carbon plumes (425 ppm).
- **Audio Mapping:** Continuous Lydian mapping ($E_3 \to C_5$, 165–523 Hz). Carbon concentration accumulation builds acoustic tension and filter resonance.
- **Voices Used:** Lead Voice (triangle) + Latitudinal Pad.

### 7. Perpetual Ocean 2: Western Boundary Currents (`perpetual-ocean`)
- **NASA Source:** SVS 5425 ([https://svs.gsfc.nasa.gov/5425/](https://svs.gsfc.nasa.gov/5425/))
- **Scientific Phenomenon:** High-resolution ocean surface boundary currents and mesoscale eddies.
- **Audio Mapping:** Modal Dorian ($B_2 \to B_4$, 123–494 Hz). Boundary eddies modulate rhythmic filter sweeps in the stereo field.
- **Voices Used:** Lead Voice (sine) + Noise Voice + Latitudinal Pad.

### 8. Air Quality Model Runs (`air-quality`)
- **NASA Source:** SVS 5533 ([https://svs.gsfc.nasa.gov/5533/](https://svs.gsfc.nasa.gov/5533/))
- **Scientific Phenomenon:** Particulate matter ($PM_{2.5}$) and atmospheric air quality modeling.
- **Audio Mapping:** Natural Minor ($C^\#_3 \to C^\#_5$, 139–554 Hz). Particulate density drives acoustic distortion, filter resonance, and brightness.
- **Voices Used:** Lead Voice (sawtooth) + Latitudinal Pad.

### 9. 3D Volumetric Atmospheric River (`atmospheric-river`)
- **NASA Source:** SVS 4960 ([https://svs.gsfc.nasa.gov/4960/](https://svs.gsfc.nasa.gov/4960/))
- **Scientific Phenomenon:** Tropospheric water vapor transport corridors (atmospheric rivers).
- **Audio Mapping:** Lydian scale ($C_3 \to E_5$, 131–659 Hz). Plume corridor width controls stereo acoustic width; total vapor mass drives pad volume.
- **Voices Used:** Lead Voice (triangle) + Latitudinal Pad.

### 10. Data Sonification: Caldwell 73 (`caldwell-73`)
- **NASA Source:** SVS 13786 ([https://svs.gsfc.nasa.gov/13786/](https://svs.gsfc.nasa.gov/13786/))
- **Scientific Phenomenon:** NASA's reference astronomical image sonification methodology.
- **Audio Mapping:** Time scans horizontally left-to-right across columns 0–31. Vertical latitude/row maps to pitch ($131 \to 880\text{ Hz}$).
- **Voices Used:** Scanner Voice + Master Limiter.

### 11. General Earth Adaptive Fallback (`general-earth`)
- **NASA Source:** Generic fallback for unlisted NASA EIC / SVS videos.
- **Audio Mapping:** Dorian scale ($A_2 \to E_5$, 110–659 Hz). Dynamic mapping blends brightness, saturation, and hue to create real-time adaptive soundscapes without crashing or producing silence.
- **Voices Used:** Lead Voice (adaptive timbre) + Latitudinal Pad.
