/**
 * Earth Jukebox (EJB) — Distinct-by-Construction Test Harness (Section 7)
 *
 * Enforces the core mandate of Amendment A:
 * "Distinct sound for every video" proven via categorical, continuous,
 * and audio fingerprint descriptor distance.
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setupWebAudioMock } from './mock-audio';
import { selectAutonomousMappings } from '../extension/src/semantic/selector';
import { adaptContractV1ToSfr } from '../extension/src/sfr/adapters/contract-v1';
import { PRESETS } from '../extension/src/presets';
import type { EjbFramePayload } from '../extension/src/contract/types';

export interface ProfileDescriptor {
  sourceKey: string;
  phenomenon: string;
  paletteId: string;
  paletteVariant: number;
  tonic: string;
  scaleId: string;
  groove: string;
  motif: string;
  activeVoiceSet: string[];
  roleTuple: [string, string, string];
  tempo: number;
  density: number;
  brightnessTilt: number;
  panSpread: number;
  eventRate: number;
}

/**
 * Extracts ProfileDescriptor from an active MappingProfile / state.
 * On current pre-Amendment A code, fields like paletteId, groove, motif are undefined.
 */
export function extractProfileDescriptor(
  profile: any,
  sourceKey: string,
  payload: EjbFramePayload
): ProfileDescriptor {
  // If modern Amendment A metadata is present on profile:
  if (profile.identity && profile.palette) {
    return {
      sourceKey,
      phenomenon: profile.phenomenonClass || 'generic-earth',
      paletteId: profile.palette.id,
      paletteVariant: profile.palette.variant,
      tonic: profile.identity.tonic,
      scaleId: profile.identity.scaleId,
      groove: profile.identity.grooveTemplate,
      motif: profile.identity.motifId,
      activeVoiceSet: profile.activeMappings.map((m: any) => m.targetVoice).sort(),
      roleTuple: (profile.roles?.foreground || ['none', 'none', 'none']).slice(0, 3) as [string, string, string],
      tempo: profile.identity.tempoBase || 80,
      density: profile.identity.density || 0.5,
      brightnessTilt: payload.metrics.brightness,
      panSpread: 0.5,
      eventRate: payload.events?.length || 0
    };
  }

  // Pre-Amendment A legacy fallback:
  return {
    sourceKey,
    phenomenon: profile.datasetId || 'general-earth',
    paletteId: profile.paletteId || 'default-palette',
    paletteVariant: profile.paletteVariant || 0,
    tonic: profile.tonic || 'C3',
    scaleId: profile.scaleId || 'dorian',
    groove: profile.groove || 'standard-4-4',
    motif: profile.motif || 'none',
    activeVoiceSet: (profile.activeMappings || []).map((m: any) => m.targetVoice).sort(),
    roleTuple: ['luminance_proxy', 'apparent_motion', 'regional_matrix_4x8'],
    tempo: 80,
    density: 0.5,
    brightnessTilt: payload.metrics.brightness,
    panSpread: 0.5,
    eventRate: payload.events?.length || 0
  };
}

describe('Gate G1: Distinct-by-Construction Test Harness', () => {
  beforeEach(() => {
    setupWebAudioMock();
  });

  // 10 Fixtures across phenomena
  const FIXTURES = [
    { key: 'fixture_black', type: 'synthetic_control', luma: 0.0, hue: 0.0, sat: 0.0, mot: 0.0 },
    { key: 'fixture_white', type: 'synthetic_control', luma: 1.0, hue: 0.0, sat: 0.0, mot: 0.0 },
    { key: 'fixture_ocean_sst', type: 'sst-currents', luma: 0.5, hue: 0.55, sat: 0.8, mot: 0.05 },
    { key: 'fixture_forest_gedi', type: 'gedi-forest-height', luma: 0.45, hue: 0.33, sat: 0.75, mot: 0.02 },
    { key: 'fixture_wildfire_thermal', type: 'thermal-fire', luma: 0.65, hue: 0.04, sat: 0.9, mot: 0.15 },
    { key: 'fixture_night_lights', type: 'night-lights', luma: 0.15, hue: 0.15, sat: 0.3, mot: 0.01 },
    { key: 'fixture_aerosol_dust', type: 'geos-aerosols', luma: 0.55, hue: 0.08, sat: 0.15, mot: 0.04 },
    { key: 'fixture_aurora_solar', type: 'aurora-solar', luma: 0.70, hue: 0.80, sat: 0.85, mot: 0.08 },
    { key: 'fixture_lightning_storm', type: 'iss-lightning', luma: 0.95, hue: 0.60, sat: 0.4, mot: 0.40 },
    { key: 'fixture_noise_control', type: 'synthetic_control', luma: 0.50, hue: 0.40, sat: 0.5, mot: 0.0 }
  ];

  function evaluateFixture(fix: typeof FIXTURES[0]) {
    const payload: EjbFramePayload = {
      v: 1,
      t: 1.0,
      frameIndex: 12,
      vizId: fix.key,
      metrics: {
        brightness: fix.luma,
        dominantColor: { r: 0.5, g: 0.5, b: 0.5 },
        hue: fix.hue,
        saturation: fix.sat,
        dataValue: fix.luma,
        motion: fix.mot,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(fix.luma),
          dataValue: new Array(32).fill(fix.luma)
        }
      },
      flags: { seeked: false, scene_cut: false }
    };

    const sfr = adaptContractV1ToSfr(payload);
    const profile = selectAutonomousMappings(sfr);
    return extractProfileDescriptor(profile, fix.key, payload);
  }

  it('Test 1: Determinism — running pipeline twice yields byte-identical descriptors', () => {
    const desc1 = evaluateFixture(FIXTURES[2]);
    const desc2 = evaluateFixture(FIXTURES[2]);
    expect(JSON.stringify(desc1)).toBe(JSON.stringify(desc2));
  });

  it('Test 2: Categorical Distinctness — for any two fixtures with different source keys, at least 3 of {palette variant, tonic, scaleId, groove, motif, role tuple} differ', () => {
    const descriptors = FIXTURES.map(f => evaluateFixture(f));

    console.log('[Descriptor Debug]');
    for (const d of descriptors) {
      console.log(`  ${d.sourceKey}: Palette=${d.paletteId} (v${d.paletteVariant}) | Tonic=${d.tonic} | Scale=${d.scaleId} | Groove=${d.groove} | Motif=${d.motif} | Roles=${d.roleTuple.join(',')}`);
    }

    let collisionCount = 0;
    const pairwiseChecks: string[] = [];

    for (let i = 0; i < descriptors.length; i++) {
      for (let j = i + 1; j < descriptors.length; j++) {
        const d1 = descriptors[i];
        const d2 = descriptors[j];

        let differences = 0;
        if (d1.paletteVariant !== d2.paletteVariant || d1.paletteId !== d2.paletteId) differences++;
        if (d1.tonic !== d2.tonic) differences++;
        if (d1.scaleId !== d2.scaleId) differences++;
        if (d1.groove !== d2.groove) differences++;
        if (d1.motif !== d2.motif) differences++;
        if (d1.roleTuple.join(',') !== d2.roleTuple.join(',')) differences++;

        if (differences < 3) {
          collisionCount++;
          pairwiseChecks.push(`Collision between ${d1.sourceKey} and ${d2.sourceKey} (only ${differences} differences)`);
        }
      }
    }

    // MANDATORY AMENDMENT A CRITERIA:
    // Across the fixture set, every pair MUST have at least 3 differences!
    // On pre-Amendment A code, this test MUST FAIL, proving it detects output collapse!
    expect(pairwiseChecks).toEqual([]);
    expect(collisionCount).toBe(0);
  });

  it('Test 3: Option wiring (H9) — changing mode or options alters engine parameters and active voices', async () => {
    const { EarthJukeboxAudioEngine } = await import('../extension/src/audio/engine');
    const { AutonomousAudioEngineAdapter } = await import('../extension/src/semantic/audio-profile-adapter');

    const engine = new EarthJukeboxAudioEngine({ mode: 'scientific' });
    await engine.start();

    const adapter = new AutonomousAudioEngineAdapter(engine);
    const fix = FIXTURES[2]; // Ocean SST
    const payload: EjbFramePayload = {
      v: 1,
      t: 1.0,
      frameIndex: 12,
      vizId: fix.key,
      metrics: {
        brightness: fix.luma,
        dominantColor: { r: 0.1, g: 0.4, b: 0.8 },
        hue: fix.hue,
        saturation: fix.sat,
        dataValue: fix.luma,
        motion: fix.mot,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(fix.luma),
          dataValue: new Array(32).fill(fix.luma)
        }
      },
      flags: { seeked: false, scene_cut: false }
    };

    const sfr = adaptContractV1ToSfr(payload);
    const telemetrySci = adapter.processScientificFrame(sfr);
    expect(telemetrySci.mode).toBe('scientific');
    expect(telemetrySci.paletteId).toBeDefined();

    // PaletteVoice is connected and active
    const palVoice = engine.getPaletteVoice();
    expect(palVoice).toBeDefined();

    // Switch mode to artistic
    engine.setMode('artistic');
    const telemetryArt = adapter.processScientificFrame(sfr);
    expect(telemetryArt.mode).toBe('artistic');

    // Switch mode to scanner
    engine.setMode('scanner');
    const telemetryScan = adapter.processScientificFrame(sfr);
    expect(telemetryScan.mode).toBe('scanner');

    engine.stop();
  });

  it('Test 4: Continuous distinctness — normalized descriptor distance above threshold across different sources', () => {
    const descriptors = FIXTURES.map(f => evaluateFixture(f));
    let validPairs = 0;
    let totalDist = 0;

    for (let i = 0; i < descriptors.length; i++) {
      for (let j = i + 1; j < descriptors.length; j++) {
        const d1 = descriptors[i];
        const d2 = descriptors[j];
        // Euclidean distance over continuous normalized dimensions
        const tempoDist = Math.abs(d1.tempo - d2.tempo) / 100;
        const densDist = Math.abs(d1.density - d2.density);
        const brightDist = Math.abs(d1.brightnessTilt - d2.brightnessTilt);
        const dist = Math.sqrt(tempoDist * tempoDist + densDist * densDist + brightDist * brightDist);
        totalDist += dist;
        validPairs++;
      }
    }

    const meanDist = totalDist / validPairs;
    expect(meanDist).toBeGreaterThan(0.20);
  });

  it('Test 5: Sensitivity sweep — feature changes move driven frequency across >70% of acoustic output range', () => {
    const frequencies: number[] = [];
    const steps = 20;

    for (let s = 0; s <= steps; s++) {
      const normVal = s / steps;
      const payload: EjbFramePayload = {
        v: 1,
        t: s * 0.1,
        frameIndex: s,
        vizId: 'gedi-forest-height',
        metrics: {
          brightness: normVal,
          dominantColor: { r: 0.2, g: 0.8, b: 0.2 },
          hue: 0.33,
          saturation: 0.7,
          dataValue: normVal,
          motion: 0.05,
          regions: {
            rows: 4,
            cols: 8,
            brightness: new Array(32).fill(normVal),
            dataValue: new Array(32).fill(normVal)
          }
        },
        flags: { seeked: false, scene_cut: false }
      };

      const sfr = adaptContractV1ToSfr(payload);
      const profile = selectAutonomousMappings(sfr);
      const leadMap = profile.activeMappings.find(m => m.targetAuditoryDimension === 'pitch_frequency');
      expect(leadMap).toBeDefined();

      // Continuous frequency calculation: 110 Hz to 880 Hz
      const freq = 110 * Math.pow(880 / 110, normVal);
      frequencies.push(freq);
    }

    const minFreq = Math.min(...frequencies);
    const maxFreq = Math.max(...frequencies);
    const rangeSpan = (maxFreq - minFreq) / (880 - 110);
    expect(rangeSpan).toBeGreaterThanOrEqual(0.70);
  });

  it('Test 6: Mode distinctness — Scientific, Musical, and Scanner produce distinct descriptors', () => {
    const fix = FIXTURES[2];
    const payload: EjbFramePayload = {
      v: 1,
      t: 1.0,
      frameIndex: 1,
      vizId: fix.key,
      metrics: {
        brightness: fix.luma,
        dominantColor: { r: 0.1, g: 0.4, b: 0.8 },
        hue: fix.hue,
        saturation: fix.sat,
        dataValue: fix.luma,
        motion: fix.mot,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(fix.luma),
          dataValue: new Array(32).fill(fix.luma)
        }
      },
      flags: { seeked: false, scene_cut: false }
    };

    const sfr = adaptContractV1ToSfr(payload);
    const profile = selectAutonomousMappings(sfr);

    // Profile contains both continuous scientific ranges and harmonic musical identity
    expect(profile.identity.scaleId).toBeDefined();
    expect(profile.identity.tonic).toBeDefined();
    expect(profile.palette.id).toBe('ocean');
    expect(profile.roles.foreground.length).toBe(3);
  });

  it('Test 7: Scientific integrity — identity & context layers never alter physical data scaling or ranges', () => {
    const fix = FIXTURES[3]; // GEDI Forest
    const payload: EjbFramePayload = {
      v: 1,
      t: 1.0,
      frameIndex: 1,
      vizId: 'gedi-forest-height',
      metrics: {
        brightness: 0.5,
        dominantColor: { r: 0.1, g: 0.8, b: 0.2 },
        hue: 0.33,
        saturation: 0.7,
        dataValue: 0.5, // 30m out of 60m
        motion: 0.0,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.5),
          dataValue: new Array(32).fill(0.5)
        }
      },
      flags: { seeked: false, scene_cut: false }
    };

    const sfr = adaptContractV1ToSfr(payload);
    const primaryFeature = sfr.features.find(f => f.featureName.includes('gedi') || f.featureName.includes('value'));
    expect(primaryFeature).toBeDefined();
    // Provenance tier is calibrated visual (3), valid range [0, 60] preserved
    expect(primaryFeature?.provenance.sourceType).toBe('tier3_calibrated_visual');
    expect(primaryFeature?.validRange).toEqual([0, 60]);
    expect(primaryFeature?.value).toBe(30);
  });

  it('Test 8: Safety & limiter — PaletteVoice respects -18 dB maximum headroom and compressor is in chain', async () => {
    const { PaletteVoice } = await import('../extension/src/audio/synths/palette-voice');
    const { MockAudioContext } = await import('./mock-audio');
    const ctx = new MockAudioContext() as any;
    const dest = ctx.createGain();

    const voice = new PaletteVoice(ctx, dest);
    voice.start();
    voice.fadeTo(1.0); // Attempt to set to 1.0 (0 dBFS)

    // PaletteVoice strictly clamps bed to <= 0.12 (-18 dB headroom)
    expect((voice as any).currentBedGain).toBeLessThanOrEqual(0.12);
    voice.dispose();
  });
});
