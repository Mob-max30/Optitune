import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupWebAudioMock } from './mock-audio';
import type { EjbFramePayload } from '../extension/src/contract/types';
import { adaptContractV1ToSfr } from '../extension/src/sfr/adapters/contract-v1';
import { validateScientificFeatureFrame } from '../extension/src/sfr/schema';
import { selectAutonomousMappings } from '../extension/src/semantic/selector';
import { validateMappingProfile } from '../extension/src/semantic/validator';
import { evaluateProfileParameters, AutonomousAudioEngineAdapter } from '../extension/src/semantic/audio-profile-adapter';
import { generateVerbalLegend, generateStructuredLegendHtml, generateAriaAnnouncement } from '../extension/src/accessibility/auditory-legend';
import { EarthJukeboxAudioEngine } from '../extension/src/audio/engine';

describe('Autonomous Semantic Sonification Integration Pipeline', () => {
  let engine: EarthJukeboxAudioEngine;
  let adapter: AutonomousAudioEngineAdapter;

  beforeEach(async () => {
    setupWebAudioMock();
    engine = new EarthJukeboxAudioEngine({ mode: 'scientific', masterVolume: 0.8 });
    await engine.start();
    adapter = new AutonomousAudioEngineAdapter(engine);
  });

  afterEach(() => {
    engine.destroy();
  });

  it('end-to-end: Contract v1 -> SFR -> Autonomous Selector -> Legend -> Audio Engine telemetry', () => {
    const rawPayload: EjbFramePayload = {
      v: 1,
      t: 10.0,
      frameIndex: 120,
      vizId: 'gedi-forest-height',
      metrics: {
        brightness: 0.65,
        dominantColor: { r: 0.2, g: 0.8, b: 0.3 },
        hue: 0.33, // Green
        saturation: 0.70,
        motion: 0.12,
        dataValue: 0.75, // Physical canopy height normalized
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.65),
          dataValue: new Array(32).fill(0.75)
        }
      },
      flags: {
        seeking: false,
        seeked: false,
        paused: false,
        buffering: false,
        scene_cut: false
      },
      events: [
        {
          type: 'flash',
          intensity: 0.9,
          x: 0.5,
          y: 0.5
        }
      ],
      layers: {
        smoke: 0.4,
        dust: 0.1
      },
      profile: {
        rows: [0.8, 0.6, 0.3, 0.1],
        cols: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
      }
    };

    // 1. Contract v1 -> SFR Frame
    const sfrFrame = adaptContractV1ToSfr(rawPayload);
    expect(sfrFrame.sourceId).toBe('gedi-forest-height');

    const primaryFeat = sfrFrame.features.find(f => f.featureId.includes('primary_measurement'));
    expect(primaryFeat).toBeDefined();
    expect(primaryFeat?.unit).toBe('m');
    expect(primaryFeat?.provenance.sourceType).toBe('tier3_calibrated_visual');

    // 2. Validate SFR Frame
    const sfrValidation = validateScientificFeatureFrame(sfrFrame);
    expect(sfrValidation.valid).toBe(true);

    // 3. Autonomous Selector -> MappingProfile
    const profile = selectAutonomousMappings(sfrFrame);
    expect(profile.isSilent).toBe(false);
    expect(profile.activeMappings.length).toBeGreaterThanOrEqual(2);

    // 4. Validate Mapping Profile
    const profileValidation = validateMappingProfile(profile);
    expect(profileValidation.isValid).toBe(true);
    expect(profileValidation.errors.length).toBe(0);

    // 5. Evaluate Parameters
    const params = evaluateProfileParameters(profile, sfrFrame);
    expect(params.leadFrequency).toBeGreaterThan(110);
    expect(params.leadFrequency).toBeLessThan(880);
    expect(params.leadGain).toBeGreaterThan(0);
    expect(params.filterCutoff).toBeGreaterThan(300);

    // 6. Accessibility & Auditory Legend Generation
    const verbalLegend = generateVerbalLegend(profile);
    expect(verbalLegend).toContain('Earth Jukebox Auditory Legend');

    const htmlLegend = generateStructuredLegendHtml(profile);
    expect(htmlLegend).toContain('class="ejb-legend"');

    const ariaAnnouncement = generateAriaAnnouncement(profile);
    expect(ariaAnnouncement).toContain('Active sonification profile loaded');

    // 7. Feed SFR frame into Autonomous Audio Adapter
    const telemetry = adapter.processScientificFrame(sfrFrame);
    expect(telemetry.leadFrequency).toBeGreaterThan(100);
    expect(telemetry.activeVoices).toBeGreaterThanOrEqual(1);
    expect(telemetry.eventsTriggered).toBeGreaterThanOrEqual(1); // The lightning strike event
  });

  it('gracefully handles transitions between active profiles and silent/empty frames', () => {
    // Empty frame
    const emptyFrame = {
      schemaVersion: 'sfr.v1' as const,
      frameId: 'frame-empty-001',
      sourceId: 'silent-stream',
      timestamp: 2000,
      frameIndex: 1,
      features: []
    };

    const telemetry = adapter.processScientificFrame(emptyFrame);
    expect(telemetry).toBeDefined();

    const activeProfile = adapter.getActiveProfile();
    expect(activeProfile).toBeDefined();
    expect(activeProfile?.isSilent).toBe(true);

    const verbal = generateVerbalLegend(activeProfile!);
    expect(verbal).toContain('silent');
  });
});
