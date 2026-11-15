# Earth Jukebox (EJB) — Plain-Language Copy & Nomenclature Guide
**Specification Reference:** Amendment B, Section 4 (Gate B1)  
**Date:** November 15, 2026  
**Authors:** Pranav K & Ujwal A  

---

## 1. Core Principles

1. **Listener's Perspective**: All descriptions describe what the listener hears and what in the picture causes it.
2. **Active Voice & Sentence Case**: No title case headings, no all-caps eyebrows.
3. **One Job Per Element**: Every string has a single, unambiguous purpose.
4. **Honest Errors**: State what happened and how to fix it; never apologize.
5. **Strict Vocabulary Consistency**: The same action has the same name across popup, overlay, and Listening Room.

---

## 2. Nomenclature Mapping Table

| Internal Identifier | Listener-Facing Label | Explanation / Popover Text |
| :--- | :--- | :--- |
| `tier1_direct_binary` | **From source data** | Directly read from calibrated NASA scientific data files (e.g. HDF5, NetCDF, GeoTIFF). |
| `tier2_curated_table` | **From NASA metadata** | Extracted from authoritative NASA scientific catalogs and mission metadata. |
| `tier3_calibrated_visual` | **Estimated from the legend** | Calibrated by matching visualization pixels against the official scientific colorbar. |
| `tier4_visual_proxy` | **Based on the picture only** | Qualitative visual proxy derived from image brightness and motion; no direct physical units. |
| `mode:scientific` | **Exact** | Pitch continuously follows physical values without snapping to a scale. |
| `mode:artistic` / `raaga` | **Musical** | Sound values snap to harmonious musical scales and authentic melodic structures. |
| `mode:scanner` | **Sweep** | Left-to-right auditory sweep scanning across columns (Caldwell-73 style). |
| `semanticEnhance: true` | **Add sound identity** | Introduces melodic motifs, drone beds, and rhythmic groove tailored to this phenomenon. |
| Section: Live Metrics | **Under the hood** | Technical diagnostic drawer: pixel matrices, color hue, motion delta, and raw data contracts. |
| Section: Sound Legend | **What you're hearing** | Plain-language translation of active sound streams, directions, and instruments. |
| Section: Mode Control | **How it sounds** | Selection between raw continuous tracking, musical scales, or sequential sweep. |

---

## 3. Provenance Chip Icons and Wording

Each provenance chip is rendered with an unambiguous SVG icon AND plain text:

* **Tier 1 (Source Data)**:  
  Icon: `[●]` (Concentric solid dot / satellite sensor)  
  Label: `From source data`
* **Tier 2 (Metadata)**:  
  Icon: `[≡]` (Structured table / dataset catalog)  
  Label: `From NASA metadata`
* **Tier 3 (Legend Calibrated)**:  
  Icon: `[◨]` (Colorbar ramp / calibrated swatch)  
  Label: `Estimated from the legend`
* **Tier 4 (Visual Proxy)**:  
  Icon: `[◐]` (Camera aperture / visual proxy)  
  Label: `Based on the picture only`

---

## 4. Mode Descriptions

Displayed immediately beneath the active segmented mode button:

* **Exact**: *"Pitch continuously follows the measured value."*
* **Musical**: *"Values snap to an authentic musical scale."*
* **Sweep**: *"A playhead reads the image columns left to right."*

---

## 5. Taglines & Empty States

* **Primary Tagline**: *"Hear the pulse of Earth's living systems."*
* **First-Run Instruction**: *"Press play. The picture is the score."*
* **Empty State (No NASA Media Found)**:  
  Title: *"No visualization found"*  
  Body: *"Open an Earth Information Center (earth.gov) or SVS (svs.gsfc.nasa.gov) video, or try the offline Listening Room."*  
  Action: `[Open Listening Room]`
* **Error State (Tainted Canvas)**:  
  Title: *"Video protected by cross-origin security"*  
  Body: *"The host page prevents direct pixel access for this video. Open the same visualization directly on NASA SVS or download it to the Listening Room."*
