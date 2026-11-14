/**
 * Earth Jukebox (EJB) — NASA Visualization Audio Profiles
 *
 * Authored by Pranav K for the NASA Space Apps Challenge 2026.
 *
 * Defines tailored sonic profiles for the 10 official NASA challenge visualizations,
 * mapping physical variables to pitch, timbre, scale, filter frequencies, and spatial acoustics.
 */

import type { PresetAudioProfile } from './types';

export const PRESET_AUDIO_PROFILES: Record<string, PresetAudioProfile> = {
  'gedi-forest-height': {
    id: 'gedi-forest-height',
    defaultMode: 'scientific',
    preferredScale: 'lydian',
    baseFrequency: 130.81, // C3 (ground vegetation / low canopy)
    maxFrequency: 587.33,  // D5 (towering 60m old-growth canopy)
    primaryMetric: 'dataValue',
    oscillatorType: 'triangle',
    filterType: 'lowpass',
    baseCutoff: 600,
    maxCutoff: 5000,
    reverbDecay: 1.8,
    harmonicSpread: 0.15,
    soundLegend: 'Canopy Height (0–60 m): Pitch rises with tree height. Low brush sounds deep and woody; tall forest canopy ascends to airy, resonant registers.'
  },

  'night-lights': {
    id: 'night-lights',
    defaultMode: 'artistic',
    preferredScale: 'akebono',
    baseFrequency: 196.00, // G3
    maxFrequency: 783.99,  // G5
    primaryMetric: 'brightness',
    oscillatorType: 'sine',
    filterType: 'bandpass',
    baseCutoff: 800,
    maxCutoff: 6500,
    reverbDecay: 2.5,
    harmonicSpread: 0.25,
    soundLegend: 'Earth at Night: Illumination drives volume and crystalline overtones. Dense electrified metropolitan areas shimmer with bright harmonic resonance.'
  },

  'iss-lightning': {
    id: 'iss-lightning',
    defaultMode: 'scientific',
    preferredScale: 'pentatonic-minor',
    baseFrequency: 98.00,  // G2 (deep atmospheric storm drone)
    maxFrequency: 392.00,  // G4
    primaryMetric: 'brightness',
    oscillatorType: 'sawtooth',
    filterType: 'lowpass',
    baseCutoff: 400,
    maxCutoff: 3000,
    reverbDecay: 3.0,
    harmonicSpread: 0.3,
    soundLegend: 'ISS Lightning: Low storm rumble in background. Sudden lightning optical flashes trigger crisp percussive clicks panned to strike coordinates.'
  },

  'sst-currents': {
    id: 'sst-currents',
    defaultMode: 'artistic',
    preferredScale: 'dorian',
    baseFrequency: 110.00, // A2 (polar waters -2°C)
    maxFrequency: 523.25,  // C5 (tropical waters 35°C)
    primaryMetric: 'dataValue',
    oscillatorType: 'sine',
    filterType: 'lowpass',
    baseCutoff: 500,
    maxCutoff: 4500,
    reverbDecay: 3.2,
    harmonicSpread: 0.2,
    soundLegend: 'Sea Surface Currents & Temp: Water temperature maps to pitch/mode (polar = cold minor, tropical = warm major). Flow speed modulates oceanic wave filter sweeps.'
  },

  'geos-aerosols': {
    id: 'geos-aerosols',
    defaultMode: 'artistic',
    preferredScale: 'natural-minor',
    baseFrequency: 146.83, // D3
    maxFrequency: 659.25,  // E5
    primaryMetric: 'layers',
    oscillatorType: 'sawtooth',
    filterType: 'bandpass',
    baseCutoff: 700,
    maxCutoff: 5500,
    reverbDecay: 2.2,
    harmonicSpread: 0.35,
    soundLegend: 'GEOS Aerosols: Multi-textured soundscape. Smoke = warm analog saw; Dust = filtered grain noise; Sea Salt = glassy high-register sines.'
  },

  'dyamond-co2': {
    id: 'dyamond-co2',
    defaultMode: 'scientific',
    preferredScale: 'lydian',
    baseFrequency: 164.81, // E3 (395 ppm)
    maxFrequency: 523.25,  // C5 (425 ppm)
    primaryMetric: 'dataValue',
    oscillatorType: 'triangle',
    filterType: 'lowpass',
    baseCutoff: 650,
    maxCutoff: 4800,
    reverbDecay: 2.0,
    harmonicSpread: 0.18,
    soundLegend: 'Global CO2 Plumes: Carbon concentration (ppm) drives fundamental frequency and filter resonance. Higher atmospheric concentrations build acoustic tension.'
  },

  'perpetual-ocean': {
    id: 'perpetual-ocean',
    defaultMode: 'artistic',
    preferredScale: 'dorian',
    baseFrequency: 123.47, // B2
    maxFrequency: 493.88,  // B4
    primaryMetric: 'motion',
    oscillatorType: 'sine',
    filterType: 'lowpass',
    baseCutoff: 450,
    maxCutoff: 4200,
    reverbDecay: 2.8,
    harmonicSpread: 0.22,
    soundLegend: 'Perpetual Ocean: Mesoscale eddies and boundary currents drive undulating rhythmic oscillation and filter sweeps in the stereo field.'
  },

  'air-quality': {
    id: 'air-quality',
    defaultMode: 'scientific',
    preferredScale: 'natural-minor',
    baseFrequency: 138.59, // C#3
    maxFrequency: 554.37,  // C#5
    primaryMetric: 'dataValue',
    oscillatorType: 'sawtooth',
    filterType: 'lowpass',
    baseCutoff: 500,
    maxCutoff: 4000,
    reverbDecay: 1.9,
    harmonicSpread: 0.2,
    soundLegend: 'Air Quality: Particulate density increases acoustic brightness, harmonic distortion, and filter resonance.'
  },

  'atmospheric-river': {
    id: 'atmospheric-river',
    defaultMode: 'artistic',
    preferredScale: 'lydian',
    baseFrequency: 130.81, // C3
    maxFrequency: 659.25,  // E5
    primaryMetric: 'brightness',
    oscillatorType: 'triangle',
    filterType: 'lowpass',
    baseCutoff: 550,
    maxCutoff: 5000,
    reverbDecay: 3.5,
    harmonicSpread: 0.28,
    soundLegend: '3D Atmospheric River: Water vapor plume corridor width controls stereo acoustic width, while total vapor mass drives layered synth pad volume.'
  },

  'caldwell-73': {
    id: 'caldwell-73',
    defaultMode: 'scanner',
    preferredScale: 'pentatonic-major',
    baseFrequency: 130.81, // C3
    maxFrequency: 880.00,  // A5
    primaryMetric: 'brightness',
    oscillatorType: 'sine',
    filterType: 'lowpass',
    baseCutoff: 800,
    maxCutoff: 6000,
    reverbDecay: 2.0,
    harmonicSpread: 0.2,
    soundLegend: 'Caldwell-73 Scanner Mode: Time scans horizontally from left to right across columns. Vertical latitude maps to pitch (top = high, bottom = low).'
  }
};

/**
 * Returns audio profile for the given vizId or safe default (GEDI).
 */
export function getAudioProfile(vizId: string): PresetAudioProfile {
  return PRESET_AUDIO_PROFILES[vizId] || PRESET_AUDIO_PROFILES['gedi-forest-height'];
}
