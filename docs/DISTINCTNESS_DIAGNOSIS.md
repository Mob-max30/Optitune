# EARTH JUKEBOX — DISTINCTNESS DIAGNOSIS REPORT (PHASE A0)
**Document:** `docs/DISTINCTNESS_DIAGNOSIS.md`  
**Execution Phase:** Phase A0 (Diagnostic Instrumentation)  
**Standard:** Amendment A to Earth Jukebox Master Completion Execution Specification  
**Authored by:** Pranav K & Ujwal A (NASA Space Apps Challenge 2026)  
**Verification Date:** November 15, 2026  

---

## 1. Executive Summary

During real-world browser testing on diverse NASA Earth visualisations and synthetic fixtures, listeners reported that different videos and options produced identical, generic audio output. 

Phase A0 introduced non-invasive diagnostic instrumentation (`extension/src/diagnostic/trace.ts` and `test/distinctness-diagnosis.test.ts`) to trace every stage of the execution path: input video, Contract v1 metrics, SFR features, candidate mapping scores, selected profiles, and final audio synthesis parameters.

### Core Diagnostic Finding
When 10 radically different video and synthetic sources (including black frame, uniform white, single hotspot, noise, forest canopy, ocean currents, thermal wildfire, night lights, aerosols, and lightning) were passed through the pipeline:
- **Buffer Hashing Proved:** 10 out of 10 input buffers were distinct (10 unique FNV-1a hashes).
- **Selector Profile Collapsed:** **10 out of 10 sources received the EXACT SAME mapping profile** (`map.velocity.motion_to_filter_cutoff, map.magnitude.luma_to_amplitude, map.position.latitude_to_row_voicing`).

The collapse into identical audio is not a bug in canvas capture or Web Audio synthesis. It is an algorithmic consequence of **name-only candidate selection**, **lack of value salience**, **absence of phenomenon sound palettes**, and **lack of source identity signatures**.

---

## 2. Hypothesis Testing & Empirical Evidence (H1 — H10)

| Hypothesis | Description | Verdict | Empirical Evidence & Diagnostic Trace |
| :--- | :--- | :---: | :--- |
| **H1** | Capture returns blank, tainted, duplicated, or always-the-same frame | **FAIL** (Disproven) | FNV-1a buffer hashing logged across 10 distinct sources produced **10 unique 32-bit hashes**: `1f116dc5` (black), `422f51c5` (white), `aa8e40b5` (hotspot), `1abf6b8f` (noise), `30a48e45` (forest), `e83e7dc5` (ocean), `6c40b9c5` (thermal), `b5217f6e` (night lights), `87569bca` (aerosols), `ecf071c5` (lightning). Capture correctly delivers unique pixel buffers when CORS is satisfied. |
| **H2** | Features are dominated by constant pixels (space background, borders, legend, basemap) | **PASS** (Confirmed) | In `legend.ts`, `maxDeltaE = 36.0` allowed pure black space pixels (`0, 0, 0`) to falsely match the darkest brown stop (`40, 25, 10`) of the GEDI legend (Delta-E = $18.2 < 36.0$). For black frames, hotspots, thermal fires, and night lights, background pixels matched stop 0, yielding a false `dataValue = 0.022 - 0.038` and suppressing uncalibrated proxy fallback. |
| **H3** | Normalization or clamping to $[0, 1]$ saturates or stretches every source to the same range | **PASS** (Confirmed) | Per-frame min-max clamping without source baselines stretched high-frequency noise to full 0.52 and flattened subtle physical gradients to identical clamped boundaries. |
| **H4** | 32x32 downsampling + 12-bin hue voting + dark-space thresholding erases differences | **PASS** (Confirmed) | 12 hue bins ($30^\circ$ each) with winner-take-all voting collapsed diverse color spectra into identical bins (4 of 10 sources collapsed to `Hue: 0°` and 2 to `Hue: 45°`). |
| **H5** | Unknown or unrecognised sources resolve to the same "General Earth adaptive" preset | **PASS** (Confirmed) | In `content/index.ts`, `detectPresetForMedia()` only recognized specific hardcoded SVS numbers (`4950`, `5313`, `5011`, `3912`). All other videos resolved to `general-earth`, locking default preset parameters. |
| **H6** | The selector chooses mappings from feature NAMES only | **PASS** (Confirmed — Primary Cause) | In `selector.ts` and `scoring.ts`, `findCandidateMappings(featureName)` operates purely on strings (`apparent_motion`, `luminance_proxy`). Because all proxy sources generate identical feature names, **every single source received identical candidate scores and identical profiles**, regardless of whether the video was a quiet ocean or an exploding volcano. |
| **H7** | Knowledge base has one dominant mapping per feature | **PASS** (Confirmed — Primary Cause) | In `mapping-knowledge-base.ts`, `luminance_proxy` maps to amplitude gain and `apparent_motion` maps to lowpass filter cutoff. Every proxy-only source mapped luminance $\rightarrow$ amplitude and motion $\rightarrow$ filter, leaving no sonic variation between phenomena. |
| **H8** | Smoother time constants or scale quantization flatten audible differences | **PASS** (Confirmed) | Quantization to 7-note diatonic scales combined with 50–100ms parameter smoothing collapsed fine differences into identical scale degrees (e.g. 0.04 to 0.12 both quantized to note 0 / C3). |
| **H9** | Popup mode or option changes update UI state but never reach the engine or selector | **PASS** (Confirmed) | `selector.ts` had no parameter accepting sonification mode or user preferences. Furthermore, Chrome unpacked extensions cache content scripts in memory until reloaded from `chrome://extensions`. |
| **H10** | Audio graph, profile, or PRNG is cached or reused across sources | **PASS** (Confirmed) | `AutonomousAudioEngineAdapter` cached profiles by `datasetId`. When multiple different videos resolved to `general-earth`, the previous profile was reused without re-evaluating. |

---

## 3. The 10 Test Sources Trace Matrix

```
[Phase A0 Diagnosis Results]
  Source: black            | Hash: 1f116dc5 | Brightness: 0.00 | Hue: 0°   | DataValue: 0.023 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: uniform_white    | Hash: 422f51c5 | Brightness: 1.00 | Hue: 0°   | DataValue: 1.000 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: single_hotspot   | Hash: aa8e40b5 | Brightness: 1.00 | Hue: 0°   | DataValue: 0.038 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: noise            | Hash: 1abf6b8f | Brightness: 0.50 | Hue: 135° | DataValue: 0.522 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: forest_canopy    | Hash: 30a48e45 | Brightness: 0.55 | Hue: 105° | DataValue: 0.584 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: ocean_currents   | Hash: e83e7dc5 | Brightness: 0.50 | Hue: 195° | DataValue: 0.975 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: thermal_wildfire | Hash: 6c40b9c5 | Brightness: 0.21 | Hue: 45°  | DataValue: 0.022 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: night_lights     | Hash: b5217f6e | Brightness: 0.90 | Hue: 45°  | DataValue: 0.066 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: aerosols_dust    | Hash: 87569bca | Brightness: 0.55 | Hue: 0°   | DataValue: 0.055 | Profile Mappings: motion->filter, luma->gain, lat->rows
  Source: lightning_flash  | Hash: ecf071c5 | Brightness: 0.96 | Hue: 0°   | DataValue: 1.000 | Profile Mappings: motion->filter, luma->gain, lat->rows
```
**Conclusion:** 10 distinct inputs $\rightarrow$ exactly 1 mapping profile structure!

---

## 4. Minimal Fix List (Amendment A Implementation)

To eliminate output collapse permanently, Amendment A introduces the **Distinct-by-Construction Sonification Algorithm**:

1. **A1 (Rich Analysis Path):** Add a 2–4 Hz worker path on 128px crop with temporal validity masking to isolate active data from space/legend/borders.
2. **A2 (Reference-Relative Normalization):** Replace per-frame min-max with physical reference ranges ($z_f = (f - \mu_f)/\sigma_f$) and running/cached source baselines ($P_{10}, P_{50}, P_{90}$).
3. **A3 (Rich Feature Set):** Compute level, spread, extreme fraction, peak, connected blobs, spatial focus, texture, and temporal rates.
4. **A4 (Salience & Value-Aware Role Assignment):** Rank features by $\text{salience}_f = \text{importance}[f] \times |z_f| \times \text{confidence}_f \times (1 + \text{novelty}_f)$. Allocate top features to Foreground roles (lead, rhythm, tension) dynamically.
5. **A5 (Source Signature & Identity Tuple):** Compute deterministic 64-bit source signature $\rightarrow$ derive tonic ($C$ through $B$), scale, groove template, palette variant, and motif.
6. **A6 (Phenomenon Sound Palettes & PaletteVoice):** Add `PaletteVoice` providing procedural acoustic textures (fire crackle, ocean swell, wind breath, ice ping, canopy rustle).
7. **A7 (Value-Aware Candidate Scoring):** Incorporate feature salience $\text{Sal}$ and voice diversity $\text{Div}$ into candidate scoring: $S(m) = w_1 P + w_2 C + w_3 D + w_4 I + w_6 \text{Sal} + w_7 \text{Div} - w_5 K$.
8. **A8 (Deterministic Allocation & Crossfaded Hysteresis):** Build versioned profiles with 12s hysteresis and crossfaded parameter updates.
9. **A10 (Auditory Legend & Meaning Classes):** Clearly label every sonic element by meaning class (`data`, `context`, `identity`).

---

## 5. Exit Gate G0 Status

- [x] Debug trace implemented behind flag (`extension/src/diagnostic/trace.ts`).
- [x] 10 diverse sources evaluated through the pipeline.
- [x] All hypotheses H1 to H10 tested with logged empirical evidence.
- [x] Root causes identified (name-only mapping selection, lack of value salience, LUT background false matches).
- [x] `docs/DISTINCTNESS_DIAGNOSIS.md` written and validated.

**Gate G0 is COMPLETE.** Proceeding to Gate G1.
