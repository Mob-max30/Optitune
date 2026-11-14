# SASC — Scientific Ontology Specification

**Subsystem:** Earth Jukebox Autonomous Scientific Sonification  
**Component:** `extension/src/sasc/ontology.ts`  
**Purpose:** Formal scientific characterization of planetary variables and provenance tiers.

---

## 1. The 16 Scientific Roles

Every extracted property is categorized into one of 16 scientific ontological roles:

| Scientific Role | Description | Typical Physical Dimensions | Auditory Affordance |
| :--- | :--- | :--- | :--- |
| `STATE` | Equilibrium or baseline physical condition | Temperature, Height, Sea Level | Sustained pitch, harmonic center |
| `MAGNITUDE` | Absolute physical quantity | Meters, Kelvin, Dobson Units | Frequency register, amplitude |
| `RATE` | First temporal derivative ($\Delta v / \Delta t$) | m/s, °C/decade, flux/sec | Pulse tempo, tremolo frequency |
| `ACCELERATION` | Second temporal derivative | $\text{m/s}^2$ | Frequency glide acceleration |
| `GRADIENT` | Spatial derivative ($\nabla v$) | $\Delta \text{temp} / \Delta \text{lat}$ | Filter cutoff, stereo pan spread |
| `FLUX` | Transfer per unit area per unit time | $\text{W/m}^2$, $\text{kg/m}^2\text{s}$ | Noise amplitude, textural density |
| `DIRECTION` | Vector heading | Degrees [0, 360) | Stereo azimuth, phase shift |
| `POSITION` | Spatial coordinates | Lat/Long, X/Y | Spatial panner position |
| `PERIODICITY` | Cyclic frequency or seasonal cadence | Days, Months, Hertz | LFO rate, rhythmic meter |
| `THRESHOLD` | Physical regime limit or tipping point | Critical temperature, saturation | Percussive chime, alert accent |
| `EVENT` | Discrete spatio-temporal phenomenon | Lightning strike, fire outburst | Snappy percussive transient |
| `DEVIATION` | Anomaly relative to historical mean | $\Delta T$, $\sigma$-score | Dissonance, detune amount |
| `STRUCTURE` | Spatial distribution or spatial matrix | Regional grid, variance | Polyphonic chord voicing (Pad) |
| `UNCERTAINTY` | Measurement error bounds | Standard error, $\Delta E$ | White noise shimmer, bandwidth |
| `EXTENT` | Spatial area or coverage volume | $\text{km}^2$, percentage | Reverb decay length, stereo width |
| `CORRELATION` | Empirical statistical co-variance | Pearson $r$ | Harmonic consonance |

---

## 2. Provenance Tiers

To safeguard scientific credibility, SASC strictly enforces four provenance tiers:

- **Tier 1 — Raw Telemetry (`tier1_raw_telemetry`):** Native scientific arrays (NetCDF-4, HDF5, GeoTIFF). Direct IEEE floating-point measurements with certified metadata.
- **Tier 2 — NASA Metadata (`tier2_nasa_metadata`):** Documented Scientific Visualization Studio (SVS) parameters, colorbar scales, and flight trajectory logs.
- **Tier 3 — Calibrated Visual (`tier3_calibrated_visual`):** Colorimetric CIELAB $\Delta E$ nearest-stop matching against calibrated NASA colorbars. Uncalibrated visual artifacts are never coerced into false physical measurements.
- **Tier 4 — Visual Proxy (`tier4_visual_proxy`):** Uncalibrated video features (Rec.601 luminance, optical flow pixel velocity). These are explicitly tagged with unit `"ratio"` and restricted from claiming scientific units.

---

## 3. Physical Bounds and Missing-Data Safeguards

- **Strict Validation:** Features exceeding physical bounds (e.g. canopy height $> 120\text{ m}$, sea surface temperature $< -5^\circ\text{C}$ or $> 50^\circ\text{C}$) are rejected by `validateFeatureSemantics`.
- **Missing Data Preservation:** If sensor telemetry is null or obscured by clouds, `isMissing: true` is preserved. It is **never coerced to 0**, preventing spurious cold/zero sonification.
