# Earth Jukebox (EJB) — Perceptual Semantic Mapping Knowledge Base

> **Version:** 1.0.0  
> **Authors:** Pranav K & Ujwal A (NASA Space Apps Challenge 2026)  
> **Source Module:** `extension/src/semantic/mapping-knowledge-base.ts`  
> **Standard:** Perceptual crossmodal correspondences, psychoacoustic literature, and NASA SVS sonification standards.

---

## 1. Overview & Architectural Principles

The **Semantic Mapping Knowledge Base** defines the formal vocabulary and rules governing how Earth Science features are translated into auditory dimensions. In traditional sonification projects, parameter mappings are often hardcoded ad-hoc, leading to:
1. **Arbitrary Mappings:** Inverting intuitive polarities (e.g., mapping higher altitude to lower pitch).
2. **Acoustic Collisions:** Two distinct scientific dimensions competing for the exact same acoustic voice or parameter (e.g., pitch or lowpass cutoff).
3. **Auditory Overload:** Exceeding human auditory scene analysis limits (>4 simultaneous unstratified continuous voices).
4. **Lack of Calibrated Ground Truth:** Obscuring whether an auditory parameter represents physical calibrated SI units or an uncalibrated optical proxy.

To solve this, Earth Jukebox v1.0.0 establishes an evidence-labelled knowledge base where every mapping entry specifies:
- **Scientific Dimension:** Magnitude, Rate of Change, Spatial Distribution, Event/Anomaly, or Temporal Progression.
- **Auditory Target Dimension:** Pitch frequency, amplitude gain, lowpass filter cutoff, stereo pan, pulse rate, transient percussion, noise density, or harmonic mode.
- **Synthesizer Voice Assignment:** Dedicated routing to `lead_voice`, `pad_voice`, `percussion_voice`, `noise_voice`, or `scanner_voice`.
- **Scaling Function:** Mathematical transformation (`linear`, `logarithmic`, `exponential`, `quantized_scale`, or `threshold_trigger`).
- **Evidence Level:** Empirical rating based on published psychophysics (`strong_empirical`, `moderate_literature`, or `design_hypothesis`).
- **Conflict Sets:** Explicit collision constraints preventing parameter clashes.
- **Auditory Legend Description:** Human- and screen-reader-readable verbal description.

---

## 2. Complete Mapping Catalog (15 Mappings)

| Mapping ID | Scientific Dimension | Matched Features | Target Auditory Dimension | Target Voice | Scaling Function | Evidence Level |
|---|---|---|---|---|---|---|
| `map.magnitude.altitude_to_pitch` | Magnitude | `canopy_height`, `elevation`, `altitude`, `plume_height` | `pitch_frequency` | `lead_voice` | Logarithmic | Strong Empirical |
| `map.magnitude.temperature_to_harmonic_mode` | Magnitude | `sea_surface_temperature`, `temperature`, `thermal_anomaly` | `harmonic_mode` | `lead_voice` | Quantized Scale | Moderate Literature |
| `map.magnitude.concentration_to_pitch_tension` | Magnitude | `co2_concentration`, `methane_ppm`, `ozone_dobson` | `pitch_frequency` | `lead_voice` | Linear | Moderate Literature |
| `map.magnitude.luma_to_amplitude` | Magnitude | `perceptual_luminance`, `brightness`, `surface_radiance` | `amplitude_gain` | `lead_voice` | Exponential | Strong Empirical |
| `map.velocity.motion_to_filter_cutoff` | Velocity | `interframe_motion_delta`, `optical_flow`, `fluid_speed` | `lowpass_cutoff` | `lead_voice` | Linear | Strong Empirical |
| `map.velocity.current_to_noise_wash` | Velocity | `current_streak_velocity`, `wave_energy`, `wind_speed` | `noise_density` | `noise_voice` | Linear | Moderate Literature |
| `map.position.longitude_to_stereo_pan` | Position | `longitude`, `x_coord`, `spatial_regional_matrix` | `stereo_pan` | `lead_voice` | Linear | Strong Empirical |
| `map.position.latitude_to_row_voicing` | Spatial Distribution | `spatial_regional_matrix`, `latitude_bands` | `latitudinal_voicing` | `pad_voice` | Quantized Scale | Design Hypothesis |
| `map.event.lightning_to_percussion` | Events & Anomalies | `optical_lightning_flash`, `lightning_event`, `flash` | `transient_percussion` | `percussion_voice` | Threshold Trigger | Strong Empirical |
| `map.category.smoke_to_analog_saw` | Category / Distribution | `aerosol_smoke_coverage`, `wildfire_smoke` | `noise_density` | `noise_voice` | Linear | Design Hypothesis |
| `map.category.dust_to_pink_grain` | Category / Distribution | `aerosol_dust_coverage`, `mineral_dust` | `noise_density` | `noise_voice` | Linear | Design Hypothesis |
| `map.category.seasalt_to_crystalline_sines` | Category / Distribution | `aerosol_seasalt_coverage`, `marine_sea_salt` | `pitch_frequency` | `pad_voice` | Linear | Design Hypothesis |
| `map.magnitude.air_quality_to_distortion` | Magnitude | `air_quality_index`, `pm25_density`, `smog_plume` | `lowpass_cutoff` | `lead_voice` | Linear | Moderate Literature |
| `map.structure.atmospheric_river_to_stereo_width` | Spatial Structure | `vapor_plume_width`, `atmospheric_river_corridor` | `stereo_pan` | `pad_voice` | Linear | Moderate Literature |
| `map.scanner.column_time_sweep` | Temporal Progression | `spatial_profiles_cols`, `astronomical_flux`, `caldwell_scanner`| `pulse_rate_tempo` | `scanner_voice` | Linear | Strong Empirical |

---

## 3. Mathematical Transfer Functions & Formulations

### 3.1. Logarithmic Altitude-to-Pitch Scaling
Human pitch perception is logarithmic in physical frequency ($f \propto 2^{k}$). For vertical canopy heights $h \in [h_{\min}, h_{\max}]$:
$$f(h) = f_{\min} \cdot \left(\frac{f_{\max}}{f_{\min}}\right)^{\frac{\log(1 + \beta \cdot \hat{h})}{\log(1 + \beta)}}$$
Where $\hat{h} = \frac{h - h_{\min}}{h_{\max} - h_{\min}}$, and default range spans $110\text{ Hz} \to 880\text{ Hz}$ (A2 to A5).

### 3.2. Exponential Luminance-to-Loudness Scaling
In accordance with Stevens' Power Law for acoustic loudness perception vs. optical radiance:
$$A(L) = A_{\min} + (A_{\max} - A_{\min}) \cdot (L)^{\gamma}$$
Where $\gamma = 1.6$, matching perceived acoustic loudness expansion.

### 3.3. Linear Cutoff & Panning Transfer
Filter cutoff frequency $f_c$ scales linearly with normalized optical motion energy $\Delta$:
$$f_c(\Delta) = 300\text{ Hz} + \Delta \cdot 4700\text{ Hz}$$
Stereo panning $p \in [-1.0, +1.0]$ scales linearly with normalized horizontal centroid $x \in [0.0, 1.0]$:
$$p(x) = 2x - 1$$

### 3.4. Spatial 4-Row Latitudinal Polyphony
The $4 \times 4$ spatial matrix rows are mapped to SATB vocal registers:
- **Row 0 (Northernmost, $60^\circ\text{N}-90^\circ\text{N}$):** Soprano register ($523.25\text{ Hz} - 1046.5\text{ Hz}$ / C5-C6).
- **Row 1 (North Temperate, $20^\circ\text{N}-60^\circ\text{N}$):** Alto register ($329.63\text{ Hz} - 659.25\text{ Hz}$ / E4-E5).
- **Row 2 (Equatorial / South Temperate, $20^\circ\text{S}-20^\circ\text{N}$):** Tenor register ($196.00\text{ Hz} - 392.00\text{ Hz}$ / G3-G4).
- **Row 3 (Southern Polar, $20^\circ\text{S}-90^\circ\text{S}$):** Bass fundamental ($65.41\text{ Hz} - 130.81\text{ Hz}$ / C2-C3).

---

## 4. Voice Allocation & Polyphony Management

To maintain auditory transparency and avoid masking, the knowledge base strictly partitions parameters into 5 dedicated synthesizer voice engines:

1. **`lead_voice` (Single Polyphony / Monophonic Lead):**
   - Synthesizer: Subtractive Dual-Oscillator (Triangle / Sawtooth) with 4-pole resonant lowpass filter.
   - Assigned Dimensions: Primary scientific magnitude (Canopy height, SST, CO2 concentration), primary motion cutoff.
2. **`pad_voice` (Polyphonic Quad-Voice Ambient Pad):**
   - Synthesizer: 4 independent sine/warm triangle voices with gentle attack/release envelopes.
   - Assigned Dimensions: 4-row latitudinal chords, atmospheric river stereo width, sea salt overtones.
3. **`percussion_voice` (Discrete Event Trigger):**
   - Synthesizer: High-frequency transient click / white noise burst generator with rapid exponential decay (<35 ms).
   - Assigned Dimensions: Optical lightning discharges, fire thermal bursts.
4. **`noise_voice` (Spectral Noise Modulator):**
   - Synthesizer: Stereo pink/sawtooth noise generator with dual bandpass filters (650 Hz / 950 Hz).
   - Assigned Dimensions: Aerosol smoke plume density, dust storm transport, oceanic eddy turbulence.
5. **`scanner_voice` (Raster Time Sweep):**
   - Synthesizer: 16-bank sine additive synthesis engine sweeping column by column.
   - Assigned Dimensions: Caldwell 73 / Hubble / SVS astronomical optical sweeps.

---

## 5. Conflict Resolution & Invalidation Rules

When an incoming dataset contains multiple competing features, the following conflict rules apply:
1. **Dimension Collisions:** If two features both seek `pitch_frequency` on `lead_voice` (e.g., both `canopy_height` and `temperature`), the higher provenance tier and higher informational salience feature claims `pitch_frequency`. The secondary feature is re-routed or dropped.
2. **Filter Cutoff Collisions:** Only one feature may modulate `lowpass_cutoff` per audio frame.
3. **Voice Overload Limit:** No more than 3 active continuous modulations may run simultaneously on `lead_voice`.
