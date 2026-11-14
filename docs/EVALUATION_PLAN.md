# Earth Jukebox (EJB) — Evaluation Plan & Verification Protocol

> **Document Type:** Scientific & Perceptual Evaluation Protocol  
> **Authors:** Pranav K & Ujwal A (NASA Space Apps Challenge 2026)

---

## 1. Overview & Evaluation Goals

The evaluation plan establishes empirical methods to verify three core questions:
1. **Extraction Accuracy:** Do extracted physical measurements and visual proxies faithfully track documented NASA ground truth without hallucination?
2. **Semantic Determinism & Safety:** Does the autonomous selector resolve parameter collisions, prioritize physical provenance, cap auditory stream crowding, and execute within latency SLAs?
3. **Information Transfer (Auditory Comprehension):** Can human listeners successfully identify trends (increasing vs. decreasing), spatial locations (west vs. east), and discrete physical events (lightning strikes) purely through sound?

---

## 2. Extraction Accuracy Evaluation

### 2.1. Ground Truth Comparison
- **Method:** Compare values extracted from rendered SVS visualisations against direct NetCDF / tabular values (e.g. GEDI L2A canopy height, MODIS sea surface temperature, Mauna Loa CO2 observations).
- **Metrics:**
  - Absolute Error: $|V_{\text{extracted}} - V_{\text{ground\_truth}}|$
  - Relative Error: $\frac{|V_{\text{extracted}} - V_{\text{ground\_truth}}|}{V_{\text{range}}}$
  - Calibration coverage percentage (percentage of non-background pixels matching within $\Delta E < 35.0$).

### 2.2. Robustness Testing
- Test resilience to non-data overlays: video titles, continental border lines, geographic axes, and colorbar legends.
- Test missing-data handling: verify that fill values (`-999.0` or `null`) are never mapped to numerical zero.

---

## 3. Semantic Selector Evaluation

### 3.1. Algorithmic Benchmarks
- **Determinism:** Provide identical `ScientificFeatureFrame` inputs across 1,000 runs; assert byte-for-byte identical `profileId` and assignment order.
- **Conflict Avoidance:** Inject conflicting features (e.g., both canopy height and greenhouse gas concentration demanding pitch on `lead_voice`); assert that only the higher-scoring feature wins without parameter collision.
- **Provenance Priority:** Provide a Tier 1 physical feature alongside a Tier 4 optical proxy; verify that Tier 1 is selected for primary voicing.

### 3.2. Performance SLA
- Measure end-to-end selector latency: Target $< 1.0\text{ ms}$; hard ceiling $< 5.0\text{ ms}$.

---

## 4. Controlled Auditory Comprehension Protocol

### 4.1. Participant Task Design (Non-Preference, Information-Focused)
Listeners are presented with 10-second randomized audio clips and asked objective comprehension questions:
1. **Trend Discrimination:** "Is the scientific variable increasing, decreasing, or remaining stable?"
2. **Spatial Localization:** "Did the phenomenon occur predominantly in the Western, Central, or Eastern hemisphere?"
3. **Transient Detection:** "How many lightning strikes or discrete bursts occurred?"
4. **Timbral Layer Identification:** "Which particulate aerosol was present (smoke, dust, or sea salt)?"

### 4.2. Statistical Evaluation
- Calculate percentage accuracy across tasks.
- Target: $>80\%$ accuracy for monotonic trends and discrete transient strikes.
