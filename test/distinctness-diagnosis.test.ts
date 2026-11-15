import { describe, it, expect, beforeEach } from 'vitest';
import { setupWebAudioMock } from './mock-audio';
import { debugTracer, type DebugTraceRecord } from '../extension/src/diagnostic/trace';
import { calculateAverageLuminance } from '../extension/src/analysis/luminance';
import { extractColorMetrics } from '../extension/src/analysis/color';
import { prepareLegendLUT, calculateAverageLegendValue } from '../extension/src/analysis/legend';
import { calculateRegionGrid, calculateSpatialProfiles } from '../extension/src/analysis/regions';
import { calculateMotionAndEvents } from '../extension/src/analysis/motion';
import { adaptContractV1ToSfr } from '../extension/src/sfr/adapters/contract-v1';
import { selectAutonomousMappings } from '../extension/src/semantic/selector';
import { AutonomousAudioEngineAdapter } from '../extension/src/semantic/audio-profile-adapter';
import { EarthJukeboxAudioEngine } from '../extension/src/audio/engine';
import { PRESETS } from '../extension/src/presets';
import type { EjbFramePayload } from '../extension/src/contract/types';

describe('Phase A0: Distinctness Diagnosis Harness (H1 - H10)', () => {
  beforeEach(() => {
    setupWebAudioMock();
    debugTracer.setEnabled(true);
    debugTracer.clear();
  });

  // Generator for 10 distinct test fixtures
  function createSourceBuffer(type: string): Uint8ClampedArray {
    const buf = new Uint8ClampedArray(32 * 32 * 4);
    switch (type) {
      case 'black':
        buf.fill(0);
        for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
        break;

      case 'uniform_white':
        buf.fill(255);
        break;

      case 'single_hotspot':
        buf.fill(0);
        for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
        // Central 4x4 hotspot at row 14-17, col 14-17
        for (let r = 14; r < 18; r++) {
          for (let c = 14; c < 18; c++) {
            const idx = (r * 32 + c) * 4;
            buf[idx] = 255;
            buf[idx + 1] = 255;
            buf[idx + 2] = 255;
          }
        }
        break;

      case 'noise':
        let seed = 12345;
        for (let i = 0; i < buf.length; i += 4) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          buf[i] = (seed >> 16) & 255;
          buf[i + 1] = (seed >> 8) & 255;
          buf[i + 2] = seed & 255;
          buf[i + 3] = 255;
        }
        break;

      case 'forest_canopy': // GEDI green/brown
        for (let r = 0; r < 32; r++) {
          for (let c = 0; c < 32; c++) {
            const idx = (r * 32 + c) * 4;
            buf[idx] = 40 + Math.floor((r / 32) * 50);
            buf[idx + 1] = 160 + Math.floor((c / 32) * 80);
            buf[idx + 2] = 40;
            buf[idx + 3] = 255;
          }
        }
        break;

      case 'ocean_currents': // Cyan / blue
        for (let r = 0; r < 32; r++) {
          for (let c = 0; c < 32; c++) {
            const idx = (r * 32 + c) * 4;
            buf[idx] = 10;
            buf[idx + 1] = 120 + Math.floor((r / 32) * 100);
            buf[idx + 2] = 220;
            buf[idx + 3] = 255;
          }
        }
        break;

      case 'thermal_wildfire': // Red / orange hotspots
        buf.fill(20);
        for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
        for (let r = 8; r < 24; r++) {
          for (let c = 8; c < 24; c++) {
            const idx = (r * 32 + c) * 4;
            buf[idx] = 240;
            buf[idx + 1] = 60 + (r * 5);
            buf[idx + 2] = 10;
          }
        }
        break;

      case 'night_lights': // Dark space with scattered bright clusters
        buf.fill(5);
        for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
        const cityCoords = [[5, 6], [12, 20], [18, 14], [25, 28], [22, 8]];
        for (const [cr, cc] of cityCoords) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const idx = ((cr + dr) * 32 + (cc + dc)) * 4;
              buf[idx] = 250;
              buf[idx + 1] = 230;
              buf[idx + 2] = 180;
            }
          }
        }
        break;

      case 'aerosols_dust': // Low-saturation diffuse gray
        for (let r = 0; r < 32; r++) {
          for (let c = 0; c < 32; c++) {
            const idx = (r * 32 + c) * 4;
            const v = 140 + Math.floor(Math.sin(r * 0.2 + c * 0.3) * 30);
            buf[idx] = v + 5;
            buf[idx + 1] = v;
            buf[idx + 2] = v - 5;
            buf[idx + 3] = 255;
          }
        }
        break;

      case 'lightning_flash': // Sudden high brightness spike
        buf.fill(245);
        break;
    }
    return buf;
  }

  it('runs 10 diverse sources through the pipeline and records full debug trace', async () => {
    const sourceTypes = [
      'black',
      'uniform_white',
      'single_hotspot',
      'noise',
      'forest_canopy',
      'ocean_currents',
      'thermal_wildfire',
      'night_lights',
      'aerosols_dust',
      'lightning_flash'
    ];

    const engine = new EarthJukeboxAudioEngine({ mode: 'scientific' });
    await engine.start();
    const adapter = new AutonomousAudioEngineAdapter(engine);

    for (let i = 0; i < sourceTypes.length; i++) {
      const type = sourceTypes[i];
      const buffer = createSourceBuffer(type);

      const brightness = calculateAverageLuminance(buffer, { ignoreDark: 0.05 });
      const colorMetrics = extractColorMetrics(buffer, { ignoreDark: 0.05 });
      const lut = prepareLegendLUT(PRESETS['gedi-forest-height'].legend);
      const dataValue = calculateAverageLegendValue(buffer, lut, 0.20);
      const regions = calculateRegionGrid(buffer, { rows: 4, cols: 8, width: 32, height: 32, ignoreDark: 0.05 }, lut);
      const baselines = new Float32Array(64).fill(0.1);
      const motionResult = calculateMotionAndEvents(buffer, null, 32, 32, baselines, {});
      const profile = calculateSpatialProfiles(buffer, 32, 32, 32);

      const payload: EjbFramePayload = {
        v: 1,
        t: i * 0.1,
        frameIndex: i,
        vizId: 'general-earth',
        metrics: {
          brightness,
          dominantColor: colorMetrics.dominantColor,
          hue: colorMetrics.hue,
          saturation: colorMetrics.saturation,
          dataValue,
          motion: motionResult.motion,
          regions
        },
        flags: { seeked: false, scene_cut: false },
        profile
      };

      const sfrFrame = adaptContractV1ToSfr(payload);
      const mappingProfile = selectAutonomousMappings(sfrFrame);
      const telemetry = adapter.processScientificFrame(sfrFrame);

      debugTracer.record({
        sourceKey: type,
        buffer,
        preset: 'general-earth',
        mode: 'scientific',
        payload,
        sfrFrame,
        profile: mappingProfile,
        telemetry
      });
    }

    const logs = debugTracer.getTraceLog();
    expect(logs.length).toBe(10);

    // Verify H1: Capture hashes are distinct for distinct buffers
    const hashes = logs.map(l => l.bufferHash);
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(10); // All 10 buffers have unique hashes!
    // Result H1: PASS (Capture hashes differ when image buffers differ; buffer identity is preserved)

    // Log all diagnostic results
    console.log('[Phase A0 Diagnosis Results]');
    for (const l of logs) {
      console.log(`  Source: ${l.sourceKey.padEnd(16)} | Hash: ${l.bufferHash} | Brightness: ${l.contractMetrics.brightness.toFixed(2)} | Hue: ${(l.contractMetrics.hue * 360).toFixed(0)}° | DataValue: ${l.contractMetrics.dataValue} | Mappings: ${l.chosenProfile.mappings.map(m => m.mappingId).join(', ')}`);
    }

    // Verify H2 & H4: Check how GEDI legend LUT false-matches background pixels
    const blackLog = logs.find(l => l.sourceKey === 'black')!;
    console.log('[Diagnosis H2 Evidence] Black frame dataValue matched against GEDI legend:', blackLog.contractMetrics.dataValue);
    expect(blackLog.contractMetrics.dataValue).not.toBeNull(); // Black frame falsely matches GEDI dark stop!

    // Verify H6 & H7: Check candidate mappings and profiles selected across diverse sources
    const profiles = logs.map(l => l.chosenProfile.mappings.map(m => m.mappingId).sort().join(','));
    const uniqueProfiles = new Set(profiles);
    console.log('[Diagnosis H6/H7 Evidence] Unique profile structures across 10 totally distinct sources:', uniqueProfiles.size);
    // H6 & H7: Output collapses because mapping selector picks purely from feature names
    expect(uniqueProfiles.size).toBeLessThanOrEqual(3);

    engine.destroy();
  });
});
