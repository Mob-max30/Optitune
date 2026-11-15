# Scientific Feature Representation (SFR v1) Specification

**Version:** 1.0.0  
**Specification Date:** 2026-11-15  
**Authors:** Pranav K & Ujwal A (Earth Jukebox Team)

---

## 1. Overview & Purpose

The **Scientific Feature Representation (SFR v1)** is a strongly-typed, intermediate representation designed to bridge scientific data ingestion (rendered NASA video frames, SVS metadata headers, and raw NetCDF/HDF5 geospatial arrays) with evidence-based semantic sonification.

### Key Architectural Invariants:
1. **Decoupling Ingestion from Audio:** Audio synthesizers and semantic selectors do not need to parse raw pixels or read NetCDF structures directly. They consume standardized `ScientificFeature` records.
2. **Explicit Provenance & Calibration:** Every feature record explicitly states its source tier, extraction method, and calibration status, preventing visual proxies (e.g. video luma) from being misrepresented as calibrated physical measurements.
3. **Explicit Distinction of Missing Data vs. Zero:** Missing measurements are explicitly flagged as `isMissing: true` or `null`, preventing missing telemetry from sounding like zero physical quantity (e.g. 0 meters or 0 ppm).

---

## 2. Source Provenance Hierarchy

When sonifying a NASA visualization, features are ingested using a 4-tier source hierarchy:

```
Tier 1: Direct Scientific Telemetry (NetCDF, HDF5, GeoTIFF arrays)
   │ (Highest precision, ground-truth floating point numbers)
   ▼
Tier 2: NASA Metadata & Visual Parameters (SVS descriptors, header bounds)
   │ (Documented range, units, date ranges, and orbit epochs)
   ▼
Tier 3: Calibrated Visual Extraction (CIELAB ΔE nearest-stop legend match)
   │ (Legend-calibrated physical measurement from rendered MP4 frames)
   ▼
Tier 4: Generic Visual Proxy (Rec. 601 luma, 12-bin peak hue, optical flow delta)
   │ (Honest visual proxy when no calibrated legend is available)
```

---

## 3. Supported Feature Types

1. **Scalar Feature (`featureType: 'scalar'`):** Represents single-point or whole-frame physical measurements (e.g. mean canopy height = 24.6 m, SST = 18.2 °C, carbon concentration = 412 ppm). Contains both physical `value` and normalized `normalizedValue` [0.0, 1.0].
2. **Spatial Grid Feature (`featureType: 'spatial_grid'`):** 2D array of values across geographic latitude/longitude rows and columns (e.g. 4×8 regional matrix).
3. **Event Feature (`featureType: 'event'`):** Discrete temporal anomalies (e.g. ISS lightning strikes, transient urban power flashes, scene cuts) with spatial coordinates $(x, y)$ and intensity.
4. **Vector Feature (`featureType: 'vector'`):** Directional phenomena (e.g. ocean current flow direction and velocity magnitude).
5. **Time Series Feature (`featureType: 'time_series'`):** Temporal sequences with associated timestamps.
6. **Categorical Feature (`featureType: 'categorical'`):** Classification states (e.g. aerosol species: smoke, dust, sea salt, sulfate).

---

## 4. TypeScript Schema

See [`extension/src/sfr/types.ts`](file:///e:/My%20Projects/optitone/extension/src/sfr/types.ts) for full TypeScript interface definitions and [`extension/src/sfr/schema.ts`](file:///e:/My%20Projects/optitone/extension/src/sfr/schema.ts) for runtime validation.

---

## 5. Amendment A Extensions (Rich Feature Set)

To enable Distinct-by-Construction sonification across diverse visual datasets, SFR v1 seamlessly supports the additive `RichFeaturePayload` from Contract v1.1:
- `spatial_spread`: Standard deviation of valid planetary pixels
- `extreme_fraction`: Fraction of pixels exceeding 90th percentile
- `peak_luminance`: 99th percentile peak value
- `spatial_focus`: Centroid coordinate `[x, y]`
- `spatial_texture`: High-frequency laplacian spatial energy
- `directional_skewness`: Spatial sign/skewness
- `spatial_entropy`: Shannon distribution entropy
- `bilateral_symmetry`: East-west bilateral symmetry metric
- `temporal_trend`: Linear trend slope over sliding temporal window
- `temporal_onset`: Onset acceleration for transient detection
- `valid_pixel_fraction`: Planetary mask ratio excluding dark space background ($L < 0.04$)

