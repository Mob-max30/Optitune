/**
 * Earth Jukebox (EJB) — Salience & Role Assignment Engine (Amendment A, Section A4)
 *
 * Replaces name-only mapping selection with value-aware salience ranking:
 * salience_f = importance[phenomenonClass][f] * |z_f| * confidence_f * (1 + novelty_f)
 *
 * Top 3 features become FOREGROUND roles (lead, rhythm/events, tension/texture).
 * Remaining features become BACKGROUND roles (bed modulation).
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import { clamp, round3 } from '../analysis/normalize';

export type ForegroundRole = 'lead' | 'rhythm_events' | 'tension_texture';
export type BackgroundRole = 'bed_modulation';
export type FeatureRole = ForegroundRole | BackgroundRole;

export interface FeatureSalienceScore {
  featureName: string;
  zScore: number;
  importanceWeight: number;
  confidence: number;
  novelty: number;
  salience: number;
  assignedRole: FeatureRole;
  rank: number;
}

export interface RoleAssignmentResult {
  foreground: [string, string, string]; // Top 3 features by salience
  background: string[];                 // Remaining features
  salienceMap: Map<string, FeatureSalienceScore>;
  salienceList: FeatureSalienceScore[];
}

/**
 * Documented Design Parameters: Importance weights per phenomenon and feature.
 */
export const PHENOMENON_IMPORTANCE_WEIGHTS: Record<string, Record<string, number>> = {
  'thermal-fire': {
    extreme_fraction: 1.0,
    peak_intensity: 0.95,
    temporal_rate: 0.90,
    spatial_spread: 0.70,
    surface_texture: 0.60,
    spatial_focus: 0.50,
    proxy_level: 0.40,
    calibrated_level: 0.85
  },
  'sst-currents': {
    spatial_spread: 0.95,
    calibrated_level: 0.90,
    proxy_level: 0.85,
    surface_texture: 0.80,
    spatial_focus: 0.60,
    extreme_fraction: 0.40,
    temporal_rate: 0.50
  },
  'gedi-forest-height': {
    calibrated_level: 1.0,
    peak_intensity: 0.90,
    spatial_spread: 0.80,
    surface_texture: 0.70,
    spatial_focus: 0.50,
    extreme_fraction: 0.40,
    temporal_rate: 0.20
  },
  'night-lights': {
    extreme_fraction: 0.95,
    spatial_focus: 0.90,
    surface_texture: 0.85,
    peak_intensity: 0.80,
    proxy_level: 0.60,
    spatial_spread: 0.50,
    temporal_rate: 0.40
  },
  'geos-aerosols': {
    spatial_spread: 0.95,
    surface_texture: 0.90,
    temporal_rate: 0.85,
    proxy_level: 0.70,
    spatial_focus: 0.60,
    extreme_fraction: 0.50
  },
  'iss-lightning': {
    temporal_rate: 1.0,
    extreme_fraction: 0.95,
    peak_intensity: 0.90,
    spatial_focus: 0.80,
    surface_texture: 0.40,
    proxy_level: 0.30
  },
  'generic-earth': {
    proxy_level: 0.80,
    spatial_spread: 0.75,
    surface_texture: 0.70,
    extreme_fraction: 0.65,
    temporal_rate: 0.60,
    spatial_focus: 0.50,
    peak_intensity: 0.50
  }
};

/**
 * Deterministic tie-break order for features when salience is identical.
 */
const DETERMINISTIC_FEATURE_ORDER = [
  'extreme_fraction',
  'calibrated_level',
  'temporal_rate',
  'peak_intensity',
  'spatial_spread',
  'surface_texture',
  'spatial_focus',
  'proxy_level',
  'apparent_motion',
  'luminance_proxy',
  'regional_matrix_4x8'
];

export class SalienceEngine {
  private lastZScores = new Map<string, number>();

  /**
   * Evaluates salience for a collection of features and assigns Foreground and Background roles.
   */
  evaluateRoles(
    sourceKey: string,
    phenomenonClass: string,
    features: Array<{ featureName: string; zScore: number; confidence?: number; dt?: number }>
  ): RoleAssignmentResult {
    const importanceTable = PHENOMENON_IMPORTANCE_WEIGHTS[phenomenonClass] || PHENOMENON_IMPORTANCE_WEIGHTS['generic-earth'];

    const scoredFeatures: FeatureSalienceScore[] = [];

    for (const f of features) {
      const name = f.featureName;
      const z = f.zScore;
      const absZ = Math.abs(z);
      const importance = importanceTable[name] ?? 0.50;
      const confidence = f.confidence ?? 0.80;

      // Novelty calculation: |dz/dt|
      const histKey = `${sourceKey}:${name}`;
      const prevZ = this.lastZScores.get(histKey) ?? z;
      const dt = f.dt ?? 0.33; // ~3 Hz
      const dzdt = Math.abs(z - prevZ) / Math.max(0.01, dt);
      const novelty = clamp(dzdt * 0.5, 0.0, 2.0);
      this.lastZScores.set(histKey, z);

      // SASC / Amendment A Formula:
      // salience_f = importance * |z_f| * confidence * (1 + novelty)
      const rawSalience = importance * (absZ + 0.1) * confidence * (1 + novelty);
      const salience = round3(clamp(rawSalience, 0.0, 10.0));

      scoredFeatures.push({
        featureName: name,
        zScore: round3(z),
        importanceWeight: importance,
        confidence,
        novelty: round3(novelty),
        salience,
        assignedRole: 'bed_modulation', // placeholder before ranking
        rank: 0
      });
    }

    // Deterministic ranking: highest salience first, tie-break by fixed feature order
    scoredFeatures.sort((a, b) => {
      if (Math.abs(b.salience - a.salience) > 0.001) {
        return b.salience - a.salience;
      }
      const orderA = DETERMINISTIC_FEATURE_ORDER.indexOf(a.featureName);
      const orderB = DETERMINISTIC_FEATURE_ORDER.indexOf(b.featureName);
      const rankA = orderA !== -1 ? orderA : 999;
      const rankB = orderB !== -1 ? orderB : 999;
      return rankA - rankB;
    });

    const foregroundRoles: ForegroundRole[] = ['lead', 'rhythm_events', 'tension_texture'];
    const foregroundNames: [string, string, string] = ['none', 'none', 'none'];
    const backgroundNames: string[] = [];
    const salienceMap = new Map<string, FeatureSalienceScore>();

    for (let i = 0; i < scoredFeatures.length; i++) {
      const item = scoredFeatures[i];
      item.rank = i + 1;
      if (i < 3) {
        item.assignedRole = foregroundRoles[i];
        foregroundNames[i] = item.featureName;
      } else {
        item.assignedRole = 'bed_modulation';
        backgroundNames.push(item.featureName);
      }
      salienceMap.set(item.featureName, item);
    }

    return {
      foreground: foregroundNames,
      background: backgroundNames,
      salienceMap,
      salienceList: scoredFeatures
    };
  }

  clear(): void {
    this.lastZScores.clear();
  }
}

export const globalSalienceEngine = new SalienceEngine();
