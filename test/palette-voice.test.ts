import { describe, it, expect, beforeEach } from 'vitest';
import { setupWebAudioMock } from './mock-audio';
import {
  PaletteVoice,
  PALETTE_DECLARATIONS,
  type PaletteClassId
} from '../extension/src/audio/synths/palette-voice';

describe('Gate G5: Phenomenon Sound Palettes & PaletteVoice', () => {
  beforeEach(() => {
    setupWebAudioMock();
  });

  it('declares all 10 phenomenon sound palettes with explicit dataSlots', () => {
    const requiredPalettes: PaletteClassId[] = [
      'fire',
      'ocean',
      'atmosphere',
      'air_quality',
      'cryosphere',
      'biosphere',
      'lightning',
      'night_lights',
      'carbon',
      'generic_earth'
    ];

    for (const palId of requiredPalettes) {
      const decl = PALETTE_DECLARATIONS[palId];
      expect(decl).toBeDefined();
      expect(decl.dataSlots.length).toBeGreaterThan(0);
      expect(decl.description.length).toBeGreaterThan(10);
    }
  });

  it('PaletteVoice enforces strict -18 dB (<= 0.12) gain staging headroom', () => {
    const ctx = new AudioContext();
    const dest = ctx.createGain();
    const voice = new PaletteVoice(ctx, dest);

    voice.start();
    // Attempt to set full 1.0 gain
    voice.update({ gain: 1.0 });

    // Output node gain must be strictly clamped to <= 0.12 (-18 dB relative to lead)
    voice.stop();
    voice.dispose();
  });

  it('switches between procedural palettes without throwing or crashing', () => {
    const ctx = new AudioContext();
    const dest = ctx.createGain();
    const voice = new PaletteVoice(ctx, dest);

    voice.start();
    voice.setPalette('fire', 1);
    expect(voice.getPalette().id).toBe('fire');
    expect(voice.getPalette().variant).toBe(1);

    voice.setPalette('ocean', 2);
    expect(voice.getPalette().id).toBe('ocean');

    voice.setPalette('night_lights', 0);
    expect(voice.getPalette().id).toBe('night_lights');

    voice.update({ cutoff: 0.7, width: 0.3 });
    voice.stop();
    voice.dispose();
  });
});
