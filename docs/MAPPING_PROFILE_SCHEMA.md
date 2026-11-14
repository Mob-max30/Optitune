# Earth Jukebox (EJB) — Mapping Profile Schema Specification

> **Document Type:** Data Contract & Schema Definition  
> **Source Module:** `extension/src/semantic/types.ts`  
> **Status:** Authoritative (Version 1.0.0)

---

## 1. Overview

A **`MappingProfile`** is the validated, deterministic configuration output produced by the Autonomous Semantic Selector. It specifies exactly which scientific features from an incoming `ScientificFeatureFrame` are routed to which Web Audio synthesizer voices and parameters, accompanied by human- and screen-reader-friendly auditory legends.

---

## 2. TypeScript Interface Definition

```typescript
export interface MappingProfile {
  /** Deterministic identifier derived from dataset ID and sorted mapping assignments */
  profileId: string;
  /** Human-readable profile title (e.g. "Autonomous Profile: gedi-forest-height") */
  name: string;
  /** Semantic engine version */
  version: string;
  /** True if the profile is in an idle or silent state */
  isSilent: boolean;
  /** List of actively routed scientific-to-auditory mappings */
  activeMappings: ActiveMappingAssignment[];
  /** Detailed auditory legend items for accessibility and UI display */
  auditoryLegend: LegendItem[];
  /** Generation timestamp (ms since epoch) */
  generatedAt: number;
  /** Total number of unique synthesizer voices active simultaneously (capped at 4) */
  totalActiveVoices: number;
}

export interface ActiveMappingAssignment {
  mappingId: string;
  featureName: string;
  targetAuditoryDimension: AuditoryDimension;
  targetVoice: TargetVoiceId;
  scalingFunction: 'linear' | 'logarithmic' | 'exponential' | 'quantized_scale' | 'threshold_trigger';
  provenanceTier: SourceProvenanceTier | number | string;
  score: number;
  verbalDescription: string;
}

export interface LegendItem {
  featureName: string;
  scientificUnit: string;
  targetAuditoryDimension: AuditoryDimension;
  targetVoice: TargetVoiceId;
  verbalDescription: string;
  evidenceCitation: string;
}
```

---

## 3. Concrete Example Payload (JSON)

```json
{
  "profileId": "profile-gedi-384f9a",
  "name": "Autonomous Profile: gedi-forest-height",
  "version": "1.0.0",
  "isSilent": false,
  "totalActiveVoices": 3,
  "generatedAt": 1731630000000,
  "activeMappings": [
    {
      "mappingId": "map.magnitude.altitude_to_pitch",
      "featureName": "canopy_height",
      "targetAuditoryDimension": "pitch_frequency",
      "targetVoice": "lead_voice",
      "scalingFunction": "logarithmic",
      "provenanceTier": "tier3_calibrated_visual",
      "score": 0.885,
      "verbalDescription": "Taller canopy height and higher elevation sound higher in pitch."
    },
    {
      "mappingId": "map.velocity.motion_to_filter_cutoff",
      "featureName": "interframe_motion_delta",
      "targetAuditoryDimension": "lowpass_cutoff",
      "targetVoice": "lead_voice",
      "scalingFunction": "linear",
      "provenanceTier": "tier4_visual_proxy",
      "score": 0.720,
      "verbalDescription": "Faster motion and rushing currents open the acoustic filter, making the sound brighter."
    },
    {
      "mappingId": "map.position.latitude_to_row_voicing",
      "featureName": "spatial_regional_matrix",
      "targetAuditoryDimension": "latitudinal_voicing",
      "targetVoice": "pad_voice",
      "scalingFunction": "quantized_scale",
      "provenanceTier": "tier3_calibrated_visual",
      "score": 0.765,
      "verbalDescription": "Northern hemisphere events sound in higher registers; southern regions anchor the deep fundamental."
    }
  ],
  "auditoryLegend": [
    {
      "featureName": "canopy_height",
      "scientificUnit": "m",
      "targetAuditoryDimension": "pitch_frequency",
      "targetVoice": "lead_voice",
      "verbalDescription": "Taller canopy height and higher elevation sound higher in pitch.",
      "evidenceCitation": "Spence, C. (2011). Crossmodal correspondences: A tutorial review."
    },
    {
      "featureName": "interframe_motion_delta",
      "scientificUnit": "ratio",
      "targetAuditoryDimension": "lowpass_cutoff",
      "targetVoice": "lead_voice",
      "verbalDescription": "Faster motion and rushing currents open the acoustic filter, making the sound brighter.",
      "evidenceCitation": "Bregman, A. S. (1990). Auditory Scene Analysis."
    },
    {
      "featureName": "spatial_regional_matrix",
      "scientificUnit": "ratio",
      "targetAuditoryDimension": "latitudinal_voicing",
      "targetVoice": "pad_voice",
      "verbalDescription": "Northern hemisphere events sound in higher registers; southern regions anchor the deep fundamental.",
      "evidenceCitation": "Earth Jukebox Master Architecture (2026)."
    }
  ]
}
```
