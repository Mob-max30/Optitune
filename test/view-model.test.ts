/**
 * Earth Jukebox (EJB) — UI View-Model Unit Tests
 * Specification: Amendment B, Section 12
 */

import { describe, it, expect } from 'vitest';
import { createUiViewModel, buildDeterministicCaption, mapInternalModeToUi } from '../extension/src/ui/view-model';
import { PRESETS } from '../extension/src/presets';

describe('UI View-Model Adapter', () => {
  it('creates clean view-model from empty/partial inputs without crashing', () => {
    const vm = createUiViewModel({});
    expect(vm).toBeDefined();
    expect(vm.source.title).toBe('NASA Earth Observation');
    expect(vm.source.tint).toBe('#8FD3E8');
    expect(vm.provenance.tier).toBe(4);
    expect(vm.grid.cells.length).toBe(32);
    expect(vm.caption.length).toBeLessThanOrEqual(140);
    expect(vm.mode.active).toBe('musical');
  });

  it('correctly elevates provenance tier for presets with calibrated legends', () => {
    const gedi = PRESETS['gedi-forest-height'];
    const vm = createUiViewModel({
      preset: gedi,
      payload: {
        v: 1,
        t: 10.5,
        frameIndex: 120,
        vizId: 'gedi-forest-height',
        metrics: {
          brightness: 0.72,
          dominantColor: { r: 0.1, g: 0.8, b: 0.4 },
          hue: 0.38,
          saturation: 0.7,
          dataValue: 0.5,
          regions: {
            rows: 4,
            cols: 8,
            brightness: new Array(32).fill(0.6),
            dataValue: new Array(32).fill(0.6)
          }
        },
        flags: { seeked: false, scene_cut: false },
        profile: { rows: [0.6, 0.6, 0.6, 0.6], cols: new Array(8).fill(0.5) }
      }
    });

    expect(vm.provenance.tier).toBe(3);
    expect(vm.provenance.label).toBe('Estimated from the legend');
    expect(vm.source.phenomenonClass).toContain('gedi');
    expect(vm.source.tint).toBe('#8BD66B'); // Canopy green
    expect(vm.source.isGeoreferenced).toBe(true);

    // Verify cell readout includes physical units
    const cell = vm.grid.cells[0];
    expect(cell.readout).toContain('about 36.0 m');
    expect(cell.readout).toContain('estimated from the legend');
  });

  it('generates deterministic captions <= 140 chars in sentence case without physical claims for tier 4', () => {
    const cap1 = buildDeterministicCaption('General Earth', 'generic-earth', 4, 0.8, 0.4, 180);
    expect(cap1.length).toBeLessThanOrEqual(140);
    expect(cap1).not.toContain('meters');
    expect(cap1).not.toContain('Kelvin');
    expect(cap1).not.toContain('ppm');
    // Sentence case (starts with capital letter)
    expect(cap1[0]).toBe(cap1[0].toUpperCase());

    const cap2 = buildDeterministicCaption('GEDI Canopy', 'forest-canopy', 3, 0.65, 0.1, 120);
    expect(cap2.length).toBeLessThanOrEqual(140);
    expect(cap2).toContain('canopy');
  });

  it('maps internal engine modes cleanly to listener-facing 3-choice modes', () => {
    expect(mapInternalModeToUi('scientific').active).toBe('exact');
    expect(mapInternalModeToUi('scanner').active).toBe('sweep');
    expect(mapInternalModeToUi('artistic').active).toBe('musical');
    expect(mapInternalModeToUi('raaga').active).toBe('musical');
  });

  it('marks masked or zero cells as invalid with proper screen reader readout', () => {
    const vm = createUiViewModel({
      payload: {
        v: 1,
        t: 0,
        frameIndex: 0,
        vizId: 'test',
        metrics: {
          brightness: 0,
          dominantColor: { r: 0, g: 0, b: 0 },
          hue: 0,
          saturation: 0,
          dataValue: 0,
          regions: {
            rows: 4,
            cols: 8,
            brightness: [0, 0.5, ...new Array(30).fill(0)],
            dataValue: [0, 0.5, ...new Array(30).fill(0)]
          }
        },
        flags: { seeked: false, scene_cut: false },
        profile: { rows: [0, 0, 0, 0], cols: new Array(8).fill(0) }
      }
    });

    const invalidCell = vm.grid.cells[0];
    expect(invalidCell.isValid).toBe(false);
    expect(invalidCell.readout).toContain('No usable data here');

    const validCell = vm.grid.cells[1];
    expect(validCell.isValid).toBe(true);
  });
});
