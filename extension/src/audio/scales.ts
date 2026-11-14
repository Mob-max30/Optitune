/**
 * Earth Jukebox (EJB) — Musical Scales & Frequency Mappers
 *
 * Implements deterministic mapping between normalized physical data [0.0, 1.0]
 * and human auditory perception (frequencies in Hertz), supporting both
 * continuous scientific sonification and harmonically quantized musical modes.
 *
 * Authored by Pranav K.
 */

import type { MusicalScaleName } from './types';

/**
 * Semitone intervals above the tonic root for each supported musical scale.
 */
export const MUSICAL_SCALES: Record<MusicalScaleName, number[]> = {
  // Bright, consonant, peaceful; ideal for canopy heights and daytime observations
  'pentatonic-major': [0, 2, 4, 7, 9],

  // Introspective, contemplative; ideal for nighttime and oceanic depths
  'pentatonic-minor': [0, 3, 5, 7, 10],

  // Japanese traditional pentatonic; dramatic, celestial; ideal for Earth at Night & ISS Lightning
  akebono: [0, 2, 3, 7, 8],

  // Oceanic, floating, ancient modal feel; ideal for Sea Surface Currents & SST
  dorian: [0, 2, 3, 5, 7, 9, 10],

  // Ethereal, buoyant, mystical; ideal for atmospheric rivers and CO2 plumes
  lydian: [0, 2, 4, 6, 7, 9, 11],

  // Serious, dramatic; ideal for aerosol smoke and air quality plumes
  'natural-minor': [0, 2, 3, 5, 7, 8, 10],

  // All 12 semitones; full chromatic precision
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

/**
 * Convert a standard MIDI note number (0-127) to frequency in Hertz.
 * A4 = MIDI note 69 = 440.0 Hz.
 */
export function midiToFrequency(midiNote: number): number {
  return 440.0 * Math.pow(2.0, (midiNote - 69) / 12.0);
}

/**
 * Convert frequency in Hertz to the closest MIDI note number.
 */
export function frequencyToMidi(frequency: number): number {
  return Math.round(69 + 12.0 * Math.log2(frequency / 440.0));
}

/**
 * Continuous Scientific Frequency Mapper.
 *
 * Maps a normalized scientific metric [0.0, 1.0] to a continuous frequency range.
 * In 'log' mode (default), frequency increases exponentially to match human logarithmic
 * pitch perception (equal musical intervals for equal data increments).
 *
 * Formula: f = minFreq * (maxFreq / minFreq)^normalizedValue
 */
export function mapContinuousFrequency(
  normalizedValue: number,
  minFreq = 130.81, // C3
  maxFreq = 587.33, // D5
  curve: 'log' | 'linear' = 'log'
): number {
  const clamped = Math.max(0, Math.min(1, normalizedValue));
  if (curve === 'linear') {
    return minFreq + clamped * (maxFreq - minFreq);
  }
  return minFreq * Math.pow(maxFreq / minFreq, clamped);
}

/**
 * Harmonically Quantized Musical Frequency Mapper.
 *
 * Quantizes a normalized scientific metric [0.0, 1.0] to the nearest note in a chosen
 * musical scale across a specified number of octaves. Preserves data directionality
 * while guaranteeing harmonic concordance for public listening and classroom use.
 */
export function quantizeToScale(
  normalizedValue: number,
  scaleName: MusicalScaleName = 'pentatonic-major',
  rootMidiNote = 48, // C3
  octaves = 2
): number {
  const clamped = Math.max(0, Math.min(1, normalizedValue));
  const scale = MUSICAL_SCALES[scaleName] || MUSICAL_SCALES['pentatonic-major'];

  // Total available notes in the scale across the octave range
  const totalNotes = scale.length * octaves;
  const noteIndex = Math.min(totalNotes - 1, Math.floor(clamped * totalNotes));

  const octaveOffset = Math.floor(noteIndex / scale.length);
  const scaleDegree = noteIndex % scale.length;
  const semitones = scale[scaleDegree] + octaveOffset * 12;

  return midiToFrequency(rootMidiNote + semitones);
}

/**
 * Map an array of column values (such as Caldwell-73 horizontal profiles)
 * into an arpeggiated series of notes.
 */
export function mapProfileToFrequencies(
  profileCols: number[],
  minFreq = 164.81, // E3
  maxFreq = 659.25  // E5
): number[] {
  return profileCols.map(v => mapContinuousFrequency(v, minFreq, maxFreq, 'log'));
}
