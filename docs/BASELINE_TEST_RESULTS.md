# Baseline Test & Build Verification Results

**Audit Date:** 2026-11-15  
**Auditor:** Earth Jukebox Engineering Team (Pranav K & Ujwal A)  
**Environment:** Windows PowerShell, Node.js v24.11.1, npm 11.6.2, Vitest v5.1.0 (`happy-dom`)

---

## 1. Test Suite Results (`npm test`)

**Overall Status:** **12 Passed (12 Test Files), 43 Passed (43 Tests), 0 Failed, 0 Skipped**

| Test File | Module Under Test | Tests | Status | Execution Time |
|---|---|---|---|---|
| `test/contract.test.ts` | Contract v1 Schema Rules | 1 | PASS | ~12 ms |
| `test/scales.test.ts` | Frequency Mappings & Scale Quantizers | 8 | PASS | ~13 ms |
| `test/engine.test.ts` | Master Web Audio Engine & Lifecycle | 5 | PASS | ~48 ms |
| `test/spatial.test.ts` | 4×8 Spatial Grid & Stereo Centroid | 4 | PASS | ~12 ms |
| `test/audio-profiles.test.ts` | 10 NASA Preset Profiles | 4 | PASS | ~12 ms |
| `test/legend.test.ts` | CIELAB ΔE Legend Calibration | 4 | PASS | ~11 ms |
| `test/motion.test.ts` | Inter-frame Delta & Flash Tracking | 3 | PASS | ~9 ms |
| `test/color.test.ts` | Dominant RGB & Peak Hue Voting | 2 | PASS | ~9 ms |
| `test/regions.test.ts` | Regional Grid Matrix Partitioning | 2 | PASS | ~10 ms |
| `test/luminance.test.ts` | Rec. 601 Perceptual Luminance | 3 | PASS | ~8 ms |
| `test/smoother.test.ts` | Exponential Parameter Smoothing | 4 | PASS | ~11 ms |
| `test/normalize.test.ts` | Math Clamping & 3-Decimal Precision | 3 | PASS | ~6 ms |
| **Total** | **All Core Modules** | **43** | **PASS** | **~11.36 s total** |

---

## 2. Production Build Results (`npm run build`)

### 2.1 Extension Bundle (`scripts/build-extension.js`)
- `extension/dist/content.js`: 47.01 kB (gzip: 14.64 kB) — self-contained IIFE, injects cleanly into NASA pages.
- `extension/dist/service-worker.js`: 2.06 kB (gzip: 0.94 kB) — ES module.
- `extension/dist/analyzer.worker.js`: 9.19 kB (gzip: 3.35 kB) — Web Worker ES module.
- `extension/dist/popup.html`: 5.57 kB (gzip: 1.92 kB) + JS: 10.41 kB + CSS: 4.30 kB.
- `extension/dist/offscreen.html`: 0.50 kB + JS: 0.68 kB.

### 2.2 Standalone Demo Studio Bundle (`demo-page/vite.config.ts`)
- `demo-page/dist/index.html`: 8.52 kB (gzip: 2.81 kB).
- `demo-page/dist/assets/index.js`: 42.37 kB (gzip: 13.98 kB).
- `demo-page/dist/assets/index.css`: 6.29 kB (gzip: 1.91 kB).

### 2.3 Release Archive (`scripts/package.js`)
- `releases/earth-jukebox-v1.0.0.zip`: 33.4 kB — fully self-contained, manifest v3 compliant, ready for hackathon submission and Chrome "Load Unpacked".
