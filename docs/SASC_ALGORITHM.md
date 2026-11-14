# SASC — Scientific Auditory Scene Compiler Algorithm Specification

**Subsystem:** Earth Jukebox Autonomous Scientific Sonification  
**Challenge:** NASA Space Apps Challenge 2026 — The Earth Information Jukebox  
**Authors:** Pranav K & Ujwal A  
**Status:** Implemented & Verified  

---

## 1. Fundamental Mission: Beyond Generic Monotonic Lab Tones

Earth Jukebox answers five fundamental questions for any NASA visualization purely through sound variation:

1. **What is being represented?**  
   The scientific phenomenon (canopy height, sea surface temperature, lightning flash density, aerosol extinction) establishes the sonic foundation: scale selection, fundamental bass register, and physical bounds.
2. **What scientific information can be extracted from it?**  
   Calibrated physical values, provenance tiers (Tier 1 telemetry to Tier 3 visual calibration), rate-of-change derivatives, spatial distributions across latitude/longitude, and discrete anomaly events.
3. **Which characteristics are important to communicate?**  
   The multi-factor attention engine prioritizes scientific salience ($A_i$), separating primary state from secondary rate-of-change and filtering noise.
4. **Which sound representations are most intuitively associated with those characteristics?**  
   - **Sub-Bass Anchor (35–150 Hz):** Represents foundational physical mass, baseline state, and deep planetary reservoir.
   - **Quantized Melodic Lead:** Expresses focal measurement trajectories across culturally resonant musical scales (Akebono, Dorian, Lydian).
   - **Dynamic Rhythmic Pulse:** Directly modulated by the temporal rate-of-change ($\Delta v / \Delta t$) and motion flux.
   - **Harmonic Spatial Pad (4 Voices):** Encodes North-to-South latitudinal spread and regional balance.
   - **Percussive Transients:** Punctuate instant discrete discharges (lightning strikes, thermal spikes).
5. **How can all of that information be combined into one coherent audio experience?**  
   Through the 14-stage SASC compiler, which ensures harmonic concordance, dynamic balance, and deterministic reproducibility.

---

## 2. 14-Stage Compilation Pipeline

```
[Raw Frame / Contract v1]
          │
          ▼
   Stage 1: Ingestion & Provenance Tagging (Tier 1 to Tier 4)
          │
          ▼
   Stage 2: Semantic Validation & Scientific Ontology (16 Roles)
          │
          ▼
   Stage 3: Scientific Relationship Graph (SRG with Cycle Prevention)
          │
          ▼
   Stage 4: Derived Feature Computation (Rate of change, spatial gradient)
          │
          ▼
   Stage 5: Multi-Factor Attention Scoring (A_i = Σ w_k F_k)
          │
          ▼
   Stage 6: Redundancy & Conflict Classification (Merge, Group, Separate)
          │
          ▼
   Stage 7: Candidate Sound Representation Retrieval
          │
          ▼
   Stage 8: Auditory Role Assignment (Anchor, State, Structure, Dynamics, Events)
          │
          ▼
   Stage 9: Global Scene Optimization (Maximizing Q(M))
          │
          ▼
   Stage 10: Psychoacoustic Balance & Dynamic Range Allocation
          │
          ▼
   Stage 11: Temporal Scene Grammar Orchestration (4 Grammatical Streams)
          │
          ▼
   Stage 12: Scene Profile Compilation & Cryptographic Fingerprinting
          │
          ▼
   Stage 13: Web Audio Synthesis (Bass, Lead, Pad, Percussion, Noise)
          │
          ▼
   Stage 14: Dynamic Auditory Legend Generation (Verbal + Structured HTML)
```

---

## 3. Mathematical Formulations

### 3.1 Multi-Factor Attention Scoring ($A_i$)
$$A_i = w_r R_i + w_c C_i + w_m M_i + w_d D_i + w_t T_i + w_s S_i + w_g G_i$$
Where:
- $R_i$: Scientific relevance (0.25)
- $C_i$: Calibration confidence & provenance tier (0.20)
- $M_i$: Normalized physical magnitude (0.15)
- $D_i$: Dynamic volatility / rate-of-change (0.15)
- $T_i$: Temporal novelty (0.10)
- $S_i$: Spatial centrality (0.05)
- $G_i$: User / domain guidance weight (0.10)

### 3.2 Global Scene Quality Maximization ($Q(M)$)
$$Q(M) = \sum_{i} A_i \cdot S(f_i, r_i) - \sum_{i \neq j} C(r_i, r_j) - \sum_i P(f_i, r_i)$$
Where:
- $S(f_i, r_i)$ is semantic compatibility between feature $f_i$ and auditory role $r_i$.
- $C(r_i, r_j)$ is perceptual acoustic conflict penalty (e.g. masking or frequency collision).
- $P(f_i, r_i)$ is cognitive load penalty.

---

## 4. Musicality & Sound Design Implementation

1. **BassVoice:** Sub-octave sine (deep fundamental) + saturation triangle (harmonic body) through a 180 Hz lowpass filter.
2. **LeadVoice:** Dual detuned oscillators with scale quantization note articulation (attack/decay plucks on scale degree changes).
3. **PadVoice:** 4-voice latitudinal chord spreading across stereo panorama (-0.6 to +0.6 pan).
4. **Rhythmic Modulation:** Tempo accelerates from 60 BPM (calm state) to 130 BPM (dynamic flux) based on rate-of-change.
