/**
 * Earth Jukebox (EJB) — Authentic Indian Tabla Synthesizer Voice
 *
 * Implements a dual-drum acoustic Tabla percussion engine:
 * - Bayan (Left Hand / Bass Drum): Deep, resonant pitch-bending skin ("Ge", "Ghe", "Dhin")
 * - Dayan (Right Hand / Treble Bell Drum): Tuned to tonic Sa with metallic rim ring ("Na", "Ta", "Tin")
 * - Theka Rhythm Sequencer: Plays authentic Indian Taalas (Keharwa, Rupak, Teentaal, Dadra, Jhaptal)
 * - Dynamic Laya (Tempo): Accelerates smoothly from Vilambit (slow) to Drut (fast) based on rate of change!
 *
 * Authored by Pranav K & Ujwal A for NASA Space Apps Challenge 2026.
 */

import { TaalaProfile, TaalaBol, TAALA_PROFILES } from '../raagas';
import { midiToFrequency } from '../scales';

export class TablaVoice {
  private ctx: AudioContext;
  private outputNode: GainNode;
  private isStarted = false;
  private timerId: number | null = null;
  private activeTaala: TaalaProfile = TAALA_PROFILES.keharwa;
  private currentMatraIndex = 0; // Current beat in cycle (0-indexed)
  private rootMidi = 48; // C3 (Sa)
  private currentBpm = 84;
  private masterGain = 0.35;
  private isEnabled = true;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.outputNode = ctx.createGain();
    this.outputNode.gain.setValueAtTime(0.0, ctx.currentTime);
    this.outputNode.connect(destination);
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    this.currentMatraIndex = 0;
    this.outputNode.gain.setTargetAtTime(this.masterGain, this.ctx.currentTime, 0.05);
    this.scheduleNextMatra();
  }

  stop(): void {
    this.isStarted = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.outputNode.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
  }

  setTaala(taala: TaalaProfile): void {
    this.activeTaala = taala;
    this.currentMatraIndex = 0;
  }

  setRootMidi(midi: number): void {
    this.rootMidi = midi;
  }

  /**
   * Modulates rhythm tempo (BPM) smoothly based on scientific rate-of-change and motion.
   */
  setDynamicTempo(motion: number, rateOfChange: number): void {
    const baseBpm = this.activeTaala.defaultBpm;
    // Calm baseline (65 BPM) up to dynamic excitement (135 BPM)
    const targetBpm = Math.max(60, Math.min(140, baseBpm + (motion * 40) + (Math.abs(rateOfChange) * 25)));
    this.currentBpm = targetBpm;
  }

  setGain(gain: number): void {
    this.masterGain = Math.max(0, Math.min(0.6, gain));
    if (this.isStarted) {
      this.outputNode.gain.setTargetAtTime(this.masterGain, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Triggers an individual Tabla bol stroke manually (e.g. for lightning strikes or scene cuts).
   */
  triggerBol(bol: string, velocity = 1.0): void {
    const now = this.ctx.currentTime;
    if (bol === 'Dha' || bol === 'Dhin') {
      this.playBayan(now, 0.45 * velocity);
      this.playDayan(now, 'ring', 0.50 * velocity);
    } else if (bol === 'Ge' || bol === 'Ghe') {
      this.playBayan(now, 0.50 * velocity);
    } else if (bol === 'Na' || bol === 'Ta') {
      this.playDayan(now, 'rim', 0.55 * velocity);
    } else if (bol === 'Tin') {
      this.playDayan(now, 'ring', 0.45 * velocity);
    } else if (bol === 'Ke' || bol === 'Kat') {
      this.playDayan(now, 'muted', 0.35 * velocity);
    }
  }

  /**
   * Synthesizes the left-hand Bayan bass drum:
   * Low sinusoidal sweep (60 Hz -> 90 Hz) simulating the player's sliding palm.
   */
  private playBayan(now: number, gain = 0.40): void {
    if (this.ctx.state === 'closed') return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    // Authentic Bayan sliding pitch bend: Starts deep, slides upward with palm pressure
    osc.frequency.setValueAtTime(62, now);
    osc.frequency.exponentialRampToValueAtTime(94, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.28);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);
    filter.Q.setValueAtTime(2.5, now);

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.outputNode);

    osc.start(now);
    osc.stop(now + 0.35);

    setTimeout(() => {
      try {
        osc.disconnect();
        filter.disconnect();
        gainNode.disconnect();
      } catch {
        // Disconnected
      }
    }, 400);
  }

  /**
   * Synthesizes the right-hand Dayan treble drum:
   * Tuned precisely to the root Sa (C3 or C4) with metallic ringing rim overtones.
   */
  private playDayan(now: number, stroke: 'rim' | 'ring' | 'muted', gain = 0.40): void {
    if (this.ctx.state === 'closed') return;

    const saFreq = midiToFrequency(this.rootMidi);
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gainNode = this.ctx.createGain();

    if (stroke === 'rim') {
      // "Na" — Crisp metallic rim strike rich in high frequencies
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(saFreq * 2, now);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(4.0, now);

      gainNode.gain.setValueAtTime(gain * 0.9, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    } else if (stroke === 'ring') {
      // "Tin" / "Tun" — Resonant open bell chime tuned to Sa
      osc.type = 'sine';
      osc.frequency.setValueAtTime(saFreq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(saFreq * 3, now);
      filter.Q.setValueAtTime(3.0, now);

      gainNode.gain.setValueAtTime(gain * 0.8, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    } else {
      // "Ke" / "Kat" — Flat muted slap
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(1.5, now);

      gainNode.gain.setValueAtTime(gain * 0.6, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    }

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.outputNode);

    osc.start(now);
    osc.stop(now + 0.30);

    setTimeout(() => {
      try {
        osc.disconnect();
        filter.disconnect();
        gainNode.disconnect();
      } catch {
        // Disconnected
      }
    }, 350);
  }

  /**
   * Advances the Taala theka sequence on each matra (beat).
   */
  private scheduleNextMatra(): void {
    if (!this.isStarted || !this.isEnabled) return;

    const currentBol = this.activeTaala.bols[this.currentMatraIndex];
    if (currentBol) {
      const now = this.ctx.currentTime;
      const isSam = currentBol.type === 'sam';
      const strokeVelocity = isSam ? 1.0 : 0.75;

      if (currentBol.hasBayan) {
        this.playBayan(now, 0.40 * strokeVelocity);
      }
      if (currentBol.hasDayan) {
        this.playDayan(now, currentBol.dayanStroke || 'rim', 0.45 * strokeVelocity);
      }
    }

    this.currentMatraIndex = (this.currentMatraIndex + 1) % this.activeTaala.matras;

    // Calculate beat interval in milliseconds from BPM
    const beatIntervalMs = (60 / this.currentBpm) * 1000;
    this.timerId = window.setTimeout(() => {
      this.scheduleNextMatra();
    }, beatIntervalMs);
  }

  dispose(): void {
    this.stop();
    try {
      this.outputNode.disconnect();
    } catch {
      // Disconnected
    }
  }
}
