import { describe, it, expect, beforeEach } from 'vitest';
import {
  SourceSignatureEngine,
  Mulberry32PRNG,
  compute64BitHash,
  TONIC_OPTIONS,
  GROOVE_TEMPLATES,
  MOTIF_LIBRARY
} from '../extension/src/semantic/signature';

describe('Gate G4: Source Signature, Seeded PRNG & Identity Registry', () => {
  let engine: SourceSignatureEngine;

  beforeEach(() => {
    engine = new SourceSignatureEngine();
  });

  it('Mulberry32 PRNG is strictly deterministic and repeatable with given seed', () => {
    const prng1 = new Mulberry32PRNG(42);
    const prng2 = new Mulberry32PRNG(42);

    const seq1 = [prng1.next(), prng1.next(), prng1.next(), prng1.nextInt(1, 100)];
    const seq2 = [prng2.next(), prng2.next(), prng2.next(), prng2.nextInt(1, 100)];

    expect(seq1).toEqual(seq2);
    expect(seq1[0]).toBeGreaterThanOrEqual(0.0);
    expect(seq1[0]).toBeLessThanOrEqual(1.0);
  });

  it('computes 64-bit deterministic hash matching hex length of 16 characters', () => {
    const hash1 = compute64BitHash('NASA_SVS_4950:gedi-forest-height');
    const hash2 = compute64BitHash('NASA_SVS_4950:gedi-forest-height');
    const hash3 = compute64BitHash('NASA_SVS_5313:night-lights');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBe(16);
  });

  it('guarantees unique identity tuples across all 10 presets and diverse fixtures', () => {
    const fixtures = [
      { key: 'svs-4950', phen: 'gedi-forest-height' },
      { key: 'svs-3912', phen: 'sst-currents' },
      { key: 'svs-5313', phen: 'night-lights' },
      { key: 'svs-5011', phen: 'geos-aerosols' },
      { key: 'svs-5533', phen: 'atmospheric-co2' },
      { key: 'svs-5669', phen: 'grace-groundwater' },
      { key: 'svs-13786', phen: 'iss-lightning' },
      { key: 'thermal-fire-1', phen: 'thermal-fire' },
      { key: 'aurora-solar-1', phen: 'aurora-solar' },
      { key: 'air-quality-1', phen: 'air-quality' },
      { key: 'custom-ocean-1', phen: 'sst-currents' },
      { key: 'custom-ocean-2', phen: 'sst-currents' },
      { key: 'custom-fire-1', phen: 'thermal-fire' },
      { key: 'custom-fire-2', phen: 'thermal-fire' }
    ];

    const identityTuples = fixtures.map(f =>
      engine.generateIdentity(f.key, f.phen, 'fingerprint-1', [1, 2, 3])
    );

    const tupleKeys = identityTuples.map(
      t => `${t.tonic}-${t.scaleId}-${t.grooveTemplate}-${t.paletteVariant}-${t.motifId}`
    );

    const uniqueKeys = new Set(tupleKeys);
    expect(uniqueKeys.size).toBe(fixtures.length); // Every single fixture has a unique identity tuple!
  });

  it('restricts scale selection to documented per-phenomenon affect sets', () => {
    const fireIdentity = engine.generateIdentity('wildfire_101', 'thermal-fire');
    // thermal-fire scale candidates: ['dorian', 'natural-minor', 'chromatic']
    expect(['dorian', 'natural-minor', 'chromatic']).toContain(fireIdentity.scaleId);

    const sstIdentity = engine.generateIdentity('sst_ocean_101', 'sst-currents');
    // sst-currents scale candidates: ['pentatonic-major', 'dorian', 'lydian']
    expect(['pentatonic-major', 'dorian', 'lydian']).toContain(sstIdentity.scaleId);
  });
});
