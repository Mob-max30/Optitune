# SASC — Attention Engine & Scene Optimization Specification

**Subsystem:** Earth Jukebox Autonomous Scientific Sonification  
**Components:** `extension/src/sasc/attention-engine.ts`, `extension/src/sasc/scene-optimizer.ts`  
**Purpose:** Multi-factor feature salience ranking, redundancy reduction, and global auditory scene optimization.

---

## 1. Multi-Factor Attention Model

Raw scientific visualizations contain dozens of spatial and temporal variables. Sonifying all variables simultaneously produces cacophony. SASC evaluates each feature's attention score $A_i \in [0.0, 1.0]$:

$$A_i = w_r R_i + w_c C_i + w_m M_i + w_d D_i + w_t T_i + w_s S_i + w_g G_i$$

### Factor Weights:
- $w_r = 0.25$: Scientific relevance (importance within the domain).
- $w_c = 0.20$: Calibration confidence (Tier 1 = 1.0, Tier 3 calibrated = 0.70 + 0.15, Tier 4 proxy = 0.40).
- $w_m = 0.15$: Normalized physical magnitude.
- $w_d = 0.15$: Dynamic volatility (rate of change / temporal derivative).
- $w_t = 0.10$: Temporal novelty (sudden jumps vs steady baseline).
- $w_s = 0.05$: Spatial centrality (proximity to region of interest).
- $w_g = 0.10$: User / instructional guidance.

### Priority Bands:
- **CRITICAL ($A_i \ge 0.85$):** Mandatory auditory stream (assigned `SCIENTIFIC_ANCHOR` or `STATE`).
- **HIGH ($0.65 \le A_i < 0.85$):** Primary stream (assigned `DYNAMICS` or `STRUCTURE`).
- **MEDIUM ($0.45 \le A_i < 0.65$):** Secondary stream (assigned `CONFIDENCE` or subtle layer).
- **LOW ($0.25 \le A_i < 0.45$):** Background ambient wash.
- **NEGLIGIBLE ($A_i < 0.25$):** Suppressed to preserve acoustic transparency.

---

## 2. Redundancy & Conflict Analysis

Features measuring the same physical phenomenon (e.g. canopy height scalar + canopy height duplicate or identical proxy) are classified into three deterministic actions:

1. **`MERGE`:** Identical scientific quantities are combined into a single unified stream, averting auditory beating and phase cancellation.
2. **`GROUP`:** Spatially correlated variables (e.g. 4 latitudinal rows) are grouped into a coherent multi-voice pad rather than competing melodic leads.
3. **`SEPARATE`:** Orthogonal physical variables (e.g. canopy height vs wind speed) are routed to distinct auditory channels (pitch vs noise filter cutoff).

---

## 3. Auditory Role Assignment & Optimization

SASC defines 6 distinct Auditory Roles:
1. `SCIENTIFIC_ANCHOR`: The foundational physical reference (e.g. Sub-Bass Voice 35–150 Hz).
2. `STATE`: The primary physical measurement trajectory (e.g. Quantized Lead Voice).
3. `STRUCTURE`: The spatial distribution across hemispheres (e.g. 4-Voice Harmonic Pad).
4. `DYNAMICS`: Temporal velocity and flux (e.g. Rhythmic Pulse & Filter Cutoff Sweeps).
5. `EVENTS`: Sudden discrete anomalies (e.g. Snappy Percussion Strikes).
6. `CONFIDENCE`: Telemetry quality and uncertainty (e.g. Shimmer texture / bandwidth).

The Scene Optimizer maximizes global scene quality $Q(M)$ using greedy matching with deterministic tie-breaking (lexicographical feature ID ordering), ensuring identical inputs always produce the exact same acoustic scene profile.
