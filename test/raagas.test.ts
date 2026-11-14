import { describe, it, expect, beforeEach } from 'vitest';
import { setupWebAudioMock } from './mock-audio';
import {
  RAAGA_PROFILES,
  TAALA_PROFILES,
  getRaagaForDataset,
  getTaalaForDataset,
  quantizeToRaagaSwara
} from '../extension/src/audio/raagas';
import { TanpuraVoice } from '../extension/src/audio/synths/tanpura-voice';
import { TablaVoice } from '../extension/src/audio/synths/tabla-voice';
import { IndianMelodicVoice } from '../extension/src/audio/synths/raaga-lead';
import { EarthJukeboxAudioEngine } from '../extension/src/audio/engine';
import type { EjbFramePayload } from '../extension/src/contract/types';

describe('Indian Classical Raagas & Taalas Sonification Engine', () => {
  beforeEach(() => {
    setupWebAudioMock();
  });

  it('provides authentic Raaga definitions with distinct swara sets and instruments', () => {
    const gediRaaga = getRaagaForDataset('gedi-forest-height');
    expect(gediRaaga.name).toBe('Raaga Bhoopali');
    expect(gediRaaga.swaras).toEqual(['S', 'R', 'G', 'P', 'D']);
    expect(gediRaaga.timbre).toBe('bansuri');
    expect(gediRaaga.preferredTaala).toBe('keharwa');

    const sstRaaga = getRaagaForDataset('sst-currents');
    expect(sstRaaga.name).toBe('Raaga Megh Malhar');
    expect(sstRaaga.swaras).toEqual(['S', 'R', 'm', 'P', 'n']);
    expect(sstRaaga.timbre).toBe('sitar');
    expect(sstRaaga.preferredTaala).toBe('rupak');

    const nightRaaga = getRaagaForDataset('night-lights');
    expect(nightRaaga.name).toBe('Raaga Yaman');
    expect(nightRaaga.swaras).toContain('M'); // Teevra Ma
    expect(nightRaaga.preferredTaala).toBe('jhaptal');

    // Guarantee that every phenomenon is completely distinct!
    expect(gediRaaga.name).not.toBe(sstRaaga.name);
    expect(gediRaaga.preferredTaala).not.toBe(sstRaaga.preferredTaala);
    expect(gediRaaga.timbre).not.toBe(sstRaaga.timbre);
  });

  it('defines classic Indian Taalas with correct matras and bol structures', () => {
    const keharwa = TAALA_PROFILES.keharwa;
    expect(keharwa.matras).toBe(8);
    expect(keharwa.bols.length).toBe(8);
    expect(keharwa.bols[0].bol).toBe('Dha');
    expect(keharwa.bols[0].type).toBe('sam');

    const rupak = TAALA_PROFILES.rupak;
    expect(rupak.matras).toBe(7);
    expect(rupak.bols.length).toBe(7);
    expect(rupak.bols[0].bol).toBe('Tin');
    expect(rupak.bols[0].type).toBe('khali'); // Rupak uniquely starts on Khali!

    const teentaal = TAALA_PROFILES.teentaal;
    expect(teentaal.matras).toBe(16);
    expect(teentaal.bols.length).toBe(16);
  });

  it('quantizes scientific data values to exact Raaga swaras and frequencies', () => {
    const bhoopali = RAAGA_PROFILES['gedi-forest-height'];

    // Lowest value (0.00) -> Root Sa (C3 = ~130.8 Hz)
    const lowSwara = quantizeToRaagaSwara(0.0, bhoopali, 48);
    expect(lowSwara.swara).toBe('S');
    expect(lowSwara.frequency).toBeCloseTo(130.81, 1);

    // Mid value (~0.40) -> Gandhar or Pancham
    const midSwara = quantizeToRaagaSwara(0.4, bhoopali, 48);
    expect(['G', 'P', 'D']).toContain(midSwara.swara);
    expect(midSwara.frequency).toBeGreaterThan(130.81);

    // High old-growth canopy (1.00) -> Soaring Taar Saptak Ga/Pa
    const highSwara = quantizeToRaagaSwara(0.99, bhoopali, 48);
    expect(highSwara.frequency).toBeGreaterThan(300);
  });

  it('Tanpura drone initializes and strums acoustic 4-string cycle', () => {
    const ctx = new AudioContext();
    const dest = ctx.createGain();
    const tanpura = new TanpuraVoice(ctx, dest);

    tanpura.setRootMidi(48, false);
    tanpura.start();
    tanpura.setGain(0.4);
    tanpura.stop();
    tanpura.dispose();
  });

  it('Tabla voice triggers Bayan and Dayan strokes and adapts laya to motion', () => {
    const ctx = new AudioContext();
    const dest = ctx.createGain();
    const tabla = new TablaVoice(ctx, dest);

    tabla.setTaala(TAALA_PROFILES.rupak);
    tabla.start();
    tabla.setDynamicTempo(0.5, 2.0); // Fast motion accelerates BPM
    tabla.triggerBol('Dha', 0.9);
    tabla.triggerBol('Tin', 0.7);
    tabla.stop();
    tabla.dispose();
  });

  it('IndianMelodicVoice updates swaras with meend and adapts timbre', () => {
    const ctx = new AudioContext();
    const dest = ctx.createGain();
    const melVoice = new IndianMelodicVoice(ctx, dest);

    melVoice.setRaaga(RAAGA_PROFILES['gedi-forest-height']);
    melVoice.start();

    const note1 = melVoice.update(0.2, 0.4);
    expect(note1.frequency).toBeGreaterThan(100);

    const note2 = melVoice.update(0.7, 0.5);
    expect(note2.frequency).toBeGreaterThan(note1.frequency);

    melVoice.dispose();
  });

  it('EarthJukeboxAudioEngine runs in raaga mode and populates telemetry with Raaga and Taala names', async () => {
    const engine = new EarthJukeboxAudioEngine({ mode: 'raaga', masterVolume: 0.8 });
    await engine.start();

    const frame: EjbFramePayload = {
      v: 1,
      t: 5.0,
      frameIndex: 60,
      vizId: 'gedi-forest-height',
      metrics: {
        brightness: 0.7,
        dominantColor: { r: 0.2, g: 0.8, b: 0.3 },
        hue: 0.35,
        saturation: 0.8,
        dataValue: 0.65,
        motion: 0.05,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.7),
          dataValue: new Array(32).fill(0.65)
        }
      },
      flags: { seeked: false, scene_cut: false }
    };

    engine.processFrame(frame);
    const tel = engine.getTelemetry();

    expect(tel.mode).toBe('raaga');
    expect(tel.vizId).toBe('gedi-forest-height');
    expect(tel.raagaName).toBe('Raaga Bhoopali');
    expect(tel.taalaName).toBe('Keharwa Taal');
    expect(tel.currentSwara).toBeDefined();

    engine.destroy();
  });
});
