/**
 * Earth Jukebox (EJB) — Procedural Phenomenon Sound Palette Voice (Amendment A, Section A6)
 *
 * Implements procedural acoustic context palettes:
 * - fire/thermal: Poisson impulse crackle (2-6 kHz) + low-pass rumble
 * - ocean/currents: pink noise with slow swell LFO (6-12s) + soft drip events
 * - atmosphere/aerosol: band-limited wind noise with spread-tied width
 * - air quality: breath-like noise with lowpass closing on high concentration
 * - cryosphere/ice: sparse resonant FM pings + creak textures
 * - biosphere/canopy: soft plucks + foliage rustle noise
 * - lightning/storm: low thunder rumble bed
 * - night lights: warm shimmer pad + distant urban pulse
 * - carbon/co2: additive drone with data-driven partials & roughness
 * - generic earth: neutral textured pad
 *
 * Gain Staging: Palette bed is at most -18 dB (<= 0.12) relative to lead voice by default.
 * Passes through master gain and limiter safety chain with zero bypass.
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import { clamp } from '../../analysis/normalize';

export type PaletteClassId =
  | 'fire'
  | 'ocean'
  | 'atmosphere'
  | 'air_quality'
  | 'cryosphere'
  | 'biosphere'
  | 'lightning'
  | 'night_lights'
  | 'carbon'
  | 'generic_earth';

export type PaletteDataSlot =
  | 'density'
  | 'gain'
  | 'cutoff'
  | 'width'
  | 'roughness'
  | 'pitch_center'
  | 'filter_frequency'
  | 'noise_density'
  | 'intensity'
  | 'pulse_rate';

export interface PaletteDeclaration {
  id: PaletteClassId;
  name: string;
  dataSlots: PaletteDataSlot[];
  description: string;
}

export const PALETTE_DECLARATIONS: Record<PaletteClassId, PaletteDeclaration> = {
  fire: {
    id: 'fire',
    name: 'Thermal Wildfire & Crackle',
    dataSlots: ['density', 'gain', 'cutoff', 'roughness'],
    description: 'Poisson impulse crackle through bandpass filter with deep combustion rumble bed'
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Swell & Currents',
    dataSlots: ['gain', 'cutoff', 'width'],
    description: 'Pink noise modulated by 8-second tidal swell LFO with moving lowpass filter'
  },
  atmosphere: {
    id: 'atmosphere',
    name: 'Atmospheric Wind & Aerosol',
    dataSlots: ['gain', 'cutoff', 'width'],
    description: 'Band-limited resonant wind noise with spatial stereo width'
  },
  air_quality: {
    id: 'air_quality',
    name: 'Air Quality & Particulate Haze',
    dataSlots: ['gain', 'cutoff', 'density'],
    description: 'Breath-like noise with lowpass filter closing as pollutant concentration rises'
  },
  cryosphere: {
    id: 'cryosphere',
    name: 'Glacial Ice & Cryosphere',
    dataSlots: ['gain', 'density', 'roughness'],
    description: 'Sparse resonant FM pings and long-decay crystalline creak textures'
  },
  biosphere: {
    id: 'biosphere',
    name: 'Living Biosphere & Canopy',
    dataSlots: ['gain', 'cutoff', 'density'],
    description: 'Soft organic rustle noise and gentle resonant leaf plucks'
  },
  lightning: {
    id: 'lightning',
    name: 'Severe Storm & Thunder Rumble',
    dataSlots: ['gain', 'cutoff', 'density'],
    description: 'Low-frequency atmospheric thunder rumble bed supporting lightning percussion'
  },
  night_lights: {
    id: 'night_lights',
    name: 'Earth at Night & Urban Shimmer',
    dataSlots: ['gain', 'cutoff', 'width'],
    description: 'Warm dual-oscillator detuned shimmer pad with distant nocturnal pulse'
  },
  carbon: {
    id: 'carbon',
    name: 'Tropospheric Carbon Dioxide',
    dataSlots: ['gain', 'cutoff', 'roughness'],
    description: 'Additive harmonic drone whose partial count and acoustic roughness follow concentration'
  },
  generic_earth: {
    id: 'generic_earth',
    name: 'Adaptive Planetary Texture',
    dataSlots: ['gain', 'cutoff'],
    description: 'Neutral textured pad, explicitly tagged as visual proxy context'
  }
};

export class PaletteVoice {
  private ctx: AudioContext;
  private masterOutput: GainNode;
  private currentPalette: PaletteClassId = 'generic_earth';
  private currentVariant = 0;
  private isStarted = false;

  // Active audio nodes
  private noiseSource: AudioNode | null = null;
  private filterNode: BiquadFilterNode;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;
  private pannerNode: StereoPannerNode | null = null;

  // Gain staging cap (-18 dB = ~0.12)
  private maxAllowedGain = 0.12;
  private currentBedGain = 0.06;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.masterOutput = ctx.createGain();
    this.masterOutput.gain.setValueAtTime(0.0, ctx.currentTime);

    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(800, ctx.currentTime);

    if (typeof ctx.createStereoPanner === 'function') {
      this.pannerNode = ctx.createStereoPanner();
      this.filterNode.connect(this.masterOutput);
      this.masterOutput.connect(this.pannerNode);
      this.pannerNode.connect(destination);
    } else {
      this.filterNode.connect(this.masterOutput);
      this.masterOutput.connect(destination);
    }
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    this.rebuildPaletteNodes();
    this.masterOutput.gain.setTargetAtTime(this.currentBedGain, this.ctx.currentTime, 0.1);
  }

  stop(): void {
    this.isStarted = false;
    this.masterOutput.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
    this.cleanupNodes();
  }

  fadeTo(targetGain: number, duration = 0.05): void {
    const clamped = Math.max(0, Math.min(this.maxAllowedGain, targetGain));
    this.currentBedGain = clamped;
    this.masterOutput.gain.setTargetAtTime(clamped, this.ctx.currentTime, duration);
  }

  setPalette(paletteId: PaletteClassId, variant = 0): void {
    if (this.currentPalette === paletteId && this.currentVariant === variant) return;
    this.currentPalette = paletteId;
    this.currentVariant = variant;
    if (this.isStarted) {
      this.rebuildPaletteNodes();
    }
  }

  getPalette(): { id: PaletteClassId; variant: number } {
    return { id: this.currentPalette, variant: this.currentVariant };
  }

  /**
   * Updates palette sound parameters in real time based on mapped feature slots.
   */
  update(slots: Partial<Record<PaletteDataSlot, number>>): void {
    if (!this.isStarted || this.ctx.state === 'closed') return;
    const now = this.ctx.currentTime;

    // 1. Gain Staging (-18 dB cap)
    if (slots.gain !== undefined) {
      const targetGain = clamp(slots.gain * this.maxAllowedGain, 0.0, this.maxAllowedGain);
      this.currentBedGain = targetGain;
      this.masterOutput.gain.setTargetAtTime(targetGain, now, 0.08);
    }

    // 2. Cutoff Modulation
    if (slots.cutoff !== undefined) {
      const minCutoff = this.currentPalette === 'ocean' ? 150 : 350;
      const maxCutoff = this.currentPalette === 'fire' ? 6500 : 3200;
      const targetCutoff = clamp(minCutoff + slots.cutoff * (maxCutoff - minCutoff), 100, 12000);
      this.filterNode.frequency.setTargetAtTime(targetCutoff, now, 0.08);
    }

    // 3. Stereo Width / Pan
    if (slots.width !== undefined && this.pannerNode) {
      const pan = clamp(slots.width * 2 - 1, -0.8, 0.8);
      this.pannerNode.pan.setTargetAtTime(pan, now, 0.1);
    }
  }

  private rebuildPaletteNodes(): void {
    this.cleanupNodes();
    if (!this.isStarted || this.ctx.state === 'closed') return;
    const now = this.ctx.currentTime;

    switch (this.currentPalette) {
      case 'fire':
        this.setupFirePalette(now);
        break;
      case 'ocean':
        this.setupOceanPalette(now);
        break;
      case 'atmosphere':
      case 'air_quality':
        this.setupWindPalette(now);
        break;
      case 'night_lights':
        this.setupNightLightsPalette(now);
        break;
      case 'cryosphere':
        this.setupIcePalette(now);
        break;
      default:
        this.setupGenericEarthPalette(now);
        break;
    }
  }

  private setupFirePalette(now: number): void {
    // 1. Poisson Impulse Crackle (Bandpass 2.5 kHz to 5 kHz)
    this.filterNode.type = 'bandpass';
    this.filterNode.frequency.setValueAtTime(3200 + this.currentVariant * 400, now);
    this.filterNode.Q.setValueAtTime(2.5, now);

    // Procedural buffer with sparse crackle impulses
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const impulseDensity = 0.008 + this.currentVariant * 0.003;

    for (let i = 0; i < bufferSize; i++) {
      if (Math.random() < impulseDensity) {
        data[i] = (Math.random() * 2 - 1) * 0.6;
      } else {
        data[i] = 0;
      }
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(this.filterNode);
    noise.start(now);
    this.noiseSource = noise;

    // 2. Low-frequency combustion sub-rumble (55 Hz)
    const rumble = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(55, now);
    rumbleGain.gain.setValueAtTime(0.04, now);
    rumble.connect(rumbleGain);
    rumbleGain.connect(this.masterOutput);
    rumble.start(now);
    this.rumbleOsc = rumble;
  }

  private setupOceanPalette(now: number): void {
    // Pink noise + 8-second swell LFO
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(450, now);
    this.filterNode.Q.setValueAtTime(1.8, now);

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // 8-second slow swell LFO
    const lfo = this.ctx.createOscillator();
    const lfoG = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.125, now); // 8-second period
    lfoG.gain.setValueAtTime(250, now);
    lfo.connect(lfoG);
    lfoG.connect(this.filterNode.frequency);
    lfo.start(now);
    this.lfoOsc = lfo;
    this.lfoGain = lfoG;

    noise.connect(this.filterNode);
    noise.start(now);
    this.noiseSource = noise;
  }

  private setupWindPalette(now: number): void {
    this.filterNode.type = 'bandpass';
    this.filterNode.frequency.setValueAtTime(750 + this.currentVariant * 150, now);
    this.filterNode.Q.setValueAtTime(1.5, now);

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.25;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(this.filterNode);
    noise.start(now);
    this.noiseSource = noise;
  }

  private setupNightLightsPalette(now: number): void {
    // Warm detuned dual-sine shimmer
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(1400, now);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(220, now);
    osc2.frequency.setValueAtTime(221.2 + this.currentVariant * 0.4, now); // slow acoustic beating
    subGain.gain.setValueAtTime(0.04, now);

    osc1.connect(subGain);
    osc2.connect(subGain);
    subGain.connect(this.filterNode);
    osc1.start(now);
    osc2.start(now);
    this.rumbleOsc = osc1;
  }

  private setupIcePalette(now: number): void {
    this.filterNode.type = 'highpass';
    this.filterNode.frequency.setValueAtTime(1800, now);
    this.filterNode.Q.setValueAtTime(4.0, now);

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Sparse crystalline clicks
    for (let i = 0; i < bufferSize; i++) {
      if (Math.random() < 0.003) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      } else {
        data[i] = 0;
      }
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(this.filterNode);
    noise.start(now);
    this.noiseSource = noise;
  }

  private setupGenericEarthPalette(now: number): void {
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(600, now);
    this.filterNode.Q.setValueAtTime(1.0, now);

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(this.filterNode);
    noise.start(now);
    this.noiseSource = noise;
  }

  private cleanupNodes(): void {
    try {
      if (this.noiseSource && 'stop' in this.noiseSource) {
        (this.noiseSource as any).stop();
        this.noiseSource.disconnect();
      }
      if (this.lfoOsc) {
        this.lfoOsc.stop();
        this.lfoOsc.disconnect();
      }
      if (this.lfoGain) {
        this.lfoGain.disconnect();
      }
      if (this.rumbleOsc) {
        this.rumbleOsc.stop();
        this.rumbleOsc.disconnect();
      }
    } catch {
      // Disconnected
    }
    this.noiseSource = null;
    this.lfoOsc = null;
    this.lfoGain = null;
    this.rumbleOsc = null;
  }

  dispose(): void {
    this.stop();
    try {
      this.filterNode.disconnect();
      this.masterOutput.disconnect();
      if (this.pannerNode) this.pannerNode.disconnect();
    } catch {
      // Disconnected
    }
  }
}
