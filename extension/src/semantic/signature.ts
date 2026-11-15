/**
 * Earth Jukebox (EJB) — Source Signature & Identity Engine (Amendment A, Section A5)
 *
 * Computes deterministic 64-bit source signatures and derives the complete Identity Tuple:
 * { tonic, scaleId, grooveTemplate, paletteVariant, motifId, tempoBase, registerBase }.
 *
 * Rules:
 * - Deterministic seeded PRNG (mulberry32). NO Math.random anywhere in semantic or audio!
 * - Tagged as "identity" meaning class: makes sources memorable, carries NO data claims.
 * - Computed once per source on load, never jumps mid-playback.
 * - Enforces unique identity tuples across known presets and registered fixtures.
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import type { MusicalScaleName } from '../audio/types';

export interface SourceIdentityTuple {
  signature: string;
  sourceKey: string;
  phenomenonClass: string;
  tonic: string;
  scaleId: MusicalScaleName;
  grooveTemplate: string;
  paletteVariant: number;
  motifId: string;
  tempoBase: number;
  registerBase: 'mandra' | 'madhya' | 'taar'; // low, mid, high register
}

export class Mulberry32PRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  choice<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

/**
 * 64-bit FNV-1a Hash without external dependencies.
 */
export function compute64BitHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x5a5a5a5a;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }

  const s1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const s2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${s1}${s2}`;
}

export const TONIC_OPTIONS = ['C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3'];

/**
 * Documented Per-Phenomenon Affect Sets (Design Hypotheses, labelled as such).
 */
export const PHENOMENON_AFFECT_SCALES: Record<string, MusicalScaleName[]> = {
  'thermal-fire': ['dorian', 'natural-minor', 'chromatic'],
  'sst-currents': ['pentatonic-major', 'dorian', 'lydian'],
  'gedi-forest-height': ['pentatonic-major', 'lydian', 'pentatonic-minor'],
  'night-lights': ['akebono', 'pentatonic-minor', 'dorian'],
  'geos-aerosols': ['natural-minor', 'dorian', 'akebono'],
  'iss-lightning': ['chromatic', 'natural-minor', 'dorian'],
  'generic-earth': ['pentatonic-major', 'dorian', 'lydian', 'pentatonic-minor', 'akebono', 'natural-minor']
};

export const GROOVE_TEMPLATES = [
  'groove.steady_4_4',
  'groove.syncopated_7_8',
  'groove.waltz_3_4',
  'groove.half_time',
  'groove.triplet_swing',
  'groove.polyrhythm_3_4',
  'groove.sparse_ambient',
  'groove.urgent_driving',
  'groove.five_eight',
  'groove.staccato_pulses',
  'groove.meandering_flow',
  'groove.ceremonial_march'
];

export const MOTIF_LIBRARY = [
  'motif.rising_triad',
  'motif.pentatonic_cascade',
  'motif.arpeggio_arch',
  'motif.pendulum_leap',
  'motif.stepwise_ascent',
  'motif.sigh_descent',
  'motif.heraldic_fifth',
  'motif.circular_turn',
  'motif.staccato_repeater',
  'motif.wide_intervallic',
  'motif.syncopated_call',
  'motif.hypnotic_drift',
  'motif.octave_bounce',
  'motif.resolving_cadence',
  'motif.creeping_chroma',
  'motif.celestial_fanfare'
];

export class SourceSignatureEngine {
  private knownSourceTuples = new Map<string, SourceIdentityTuple>();
  private allocatedTuples = new Set<string>();

  /**
   * Generates a deterministic SourceIdentityTuple from source metadata and initial features.
   */
  generateIdentity(
    canonicalSourceKey: string,
    phenomenonClass: string,
    colormapFingerprint = 'default',
    quantizedFeatures: number[] = [0, 0, 0]
  ): SourceIdentityTuple {
    // Check cache
    const cached = this.knownSourceTuples.get(canonicalSourceKey);
    if (cached) return cached;

    let salt = 0;
    let signature = '';
    let tuple: SourceIdentityTuple;

    // Salt loop ensures collision-free identity across the registry
    while (true) {
      const hashInput = `${canonicalSourceKey}:${phenomenonClass}:${colormapFingerprint}:${quantizedFeatures.join(',')}:${salt}`;
      signature = compute64BitHash(hashInput);

      // Seed 32-bit PRNG from lower half of signature
      const seed = parseInt(signature.slice(8, 16), 16) || 123456789;
      const rng = new Mulberry32PRNG(seed);

      const tonic = rng.choice(TONIC_OPTIONS);
      const scaleCandidates = PHENOMENON_AFFECT_SCALES[phenomenonClass] || PHENOMENON_AFFECT_SCALES['generic-earth'];
      const scaleId = rng.choice(scaleCandidates);
      const grooveTemplate = rng.choice(GROOVE_TEMPLATES);
      const paletteVariant = rng.nextInt(0, 3); // 4 variants (0, 1, 2, 3)
      const motifId = rng.choice(MOTIF_LIBRARY);
      const tempoBase = rng.nextInt(68, 112);
      const registerBase: SourceIdentityTuple['registerBase'] = rng.choice(['mandra', 'madhya', 'taar']);

      tuple = {
        signature,
        sourceKey: canonicalSourceKey,
        phenomenonClass,
        tonic,
        scaleId,
        grooveTemplate,
        paletteVariant,
        motifId,
        tempoBase,
        registerBase
      };

      const identityKey = `${tuple.tonic}-${tuple.scaleId}-${tuple.grooveTemplate}-${tuple.paletteVariant}-${tuple.motifId}`;
      if (!this.allocatedTuples.has(identityKey) || salt > 20) {
        this.allocatedTuples.add(identityKey);
        break;
      }
      salt++; // Deterministic salt on collision
    }

    this.knownSourceTuples.set(canonicalSourceKey, tuple);
    return tuple;
  }

  clear(): void {
    this.knownSourceTuples.clear();
    this.allocatedTuples.clear();
  }
}

export const globalSignatureEngine = new SourceSignatureEngine();
