/**
 * Earth Jukebox (EJB) — Earth Song Musical Composition Engine
 *
 * Authored for the NASA Space Apps Challenge 2026.
 *
 * Dynamically composes a beautiful, distinct-by-construction musical song for every
 * distinct Earth visualization video or image. Rather than obscure scientific frequencies
 * or confusing multi-mode dropdowns, it produces one cohesive, elegant musical piece:
 * - Deterministic Key (12 chromatically distinct root tonics)
 * - Harmonious Musical Mode (Major, Lydian, Dorian, Natural Minor, Major Pentatonic)
 * - 4-Chord Progression cycling smoothly over measures
 * - Warm Sub-Bass that grounds each chord
 * - 4-Voice Polyphonic Ambient Pad voiced across latitudinal rows
 * - Lyrical Melodic Lead that tracks real-time physical/luminance features
 * - Synchronized Percussive Pulse (kick, snare, hi-hat) whose tempo & dynamic intensity
 *   breathe in sync with video motion
 */

import { midiToFrequency } from './scales';

export interface SongChord {
  name: string;
  bassMidi: number;
  padMidis: [number, number, number, number]; // [row0 (N), row1, row2, row3 (S)]
}

export interface SongStructure {
  title: string;
  keyName: string;
  rootMidi: number;
  scaleName: string;
  scaleNotes: number[];
  chordProgression: SongChord[];
  baseBpm: number;
}

const ROOT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const ADJECTIVES = [
  'Pacific', 'Atlantic', 'Arctic', 'Saharan', 'Amazonian',
  'Boreal', 'Solar', 'Stratospheric', 'Luminous', 'Verdant',
  'Oceanic', 'Glacial', 'Crimson', 'Midnight', 'Ethereal',
  'Cosmic', 'Equatorial', 'Alpine', 'Aero', 'Astral',
  'Celestial', 'Magnetic', 'Thermal', 'Terra', 'Aurora'
];

const NOUNS = [
  'Serenade', 'Harmonics', 'Symphony', 'Overture', 'Pulse',
  'Nocturne', 'Drift', 'Rhapsody', 'Horizon', 'Echoes',
  'Aura', 'Waltz', 'Cantata', 'Current', 'Sonata',
  'Cascade', 'Ballad', 'Chant', 'Cadence', 'Lullaby'
];

export function generateSongForMedia(vizId: string, hue = 0.5): SongStructure {
  // Deterministic 32-bit FNV-1a hash of vizId
  let h = 0x811c9dc5;
  for (let i = 0; i < vizId.length; i++) {
    h ^= vizId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const seed = Math.abs(h >>> 0);

  // 1. Root Key: 12 distinct chromatic semitones (C3 = 48)
  const rootIndex = (seed + Math.round(hue * 11)) % 12;
  const rootName = ROOT_NAMES[rootIndex];
  const rootMidi = 48 + rootIndex; // C3 (48) to B3 (59)

  // 2. Mode: 5 universally pleasant, lyrical modes
  const modeIndex = (seed >> 4) % 5;
  let modeName = '';
  let modeIntervals: number[] = [];

  switch (modeIndex) {
    case 0:
      modeName = 'Major Pentatonic';
      modeIntervals = [0, 2, 4, 7, 9];
      break;
    case 1:
      modeName = 'Lush Natural Minor';
      modeIntervals = [0, 2, 3, 5, 7, 8, 10];
      break;
    case 2:
      modeName = 'Uplifting Lydian';
      modeIntervals = [0, 2, 4, 6, 7, 9, 11];
      break;
    case 3:
      modeName = 'Cinematic Dorian';
      modeIntervals = [0, 2, 3, 5, 7, 9, 10];
      break;
    default:
      modeName = 'Warm Major';
      modeIntervals = [0, 2, 4, 5, 7, 9, 11];
      break;
  }

  // 3. Scale Notes spanning Octaves 4, 5, 6 for the melodic lead
  const scaleNotes: number[] = [];
  for (let oct = 1; oct <= 2; oct++) {
    for (const iv of modeIntervals) {
      scaleNotes.push(rootMidi + (oct * 12) + iv);
    }
  }
  // Add the high tonic
  scaleNotes.push(rootMidi + 36);

  // 4. 4-Chord Progression
  const isMinor = modeIndex === 1 || modeIndex === 3;
  const progChoice = (seed >> 8) % 4;
  let rawProg: Array<{ offset: number; third: number; fifth: number; seventh: number; suffix: string }>;

  if (isMinor) {
    switch (progChoice) {
      case 0: // i - VI - III - VII
        rawProg = [
          { offset: 0, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 8, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 3, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 10, third: 4, fifth: 7, seventh: 10, suffix: '7' }
        ];
        break;
      case 1: // i - iv - v - i
        rawProg = [
          { offset: 0, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 5, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 7, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 0, third: 3, fifth: 7, seventh: 10, suffix: 'min7' }
        ];
        break;
      case 2: // i - III - VII - VI
        rawProg = [
          { offset: 0, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 3, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 10, third: 4, fifth: 7, seventh: 10, suffix: '7' },
          { offset: 8, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' }
        ];
        break;
      default: // i - VI - iv - v
        rawProg = [
          { offset: 0, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 8, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 5, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 7, third: 3, fifth: 7, seventh: 10, suffix: 'min7' }
        ];
        break;
    }
  } else {
    switch (progChoice) {
      case 0: // I - V - vi - IV
        rawProg = [
          { offset: 0, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 7, third: 4, fifth: 7, seventh: 10, suffix: '7' },
          { offset: 9, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 5, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' }
        ];
        break;
      case 1: // vi - IV - I - V
        rawProg = [
          { offset: 9, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 5, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 0, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 7, third: 4, fifth: 7, seventh: 10, suffix: '7' }
        ];
        break;
      case 2: // I - IV - vi - V
        rawProg = [
          { offset: 0, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 5, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 9, third: 3, fifth: 7, seventh: 10, suffix: 'min7' },
          { offset: 7, third: 4, fifth: 7, seventh: 10, suffix: '7' }
        ];
        break;
      default: // I - V - IV - V
        rawProg = [
          { offset: 0, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 7, third: 4, fifth: 7, seventh: 10, suffix: '7' },
          { offset: 5, third: 4, fifth: 7, seventh: 11, suffix: 'maj7' },
          { offset: 7, third: 4, fifth: 7, seventh: 10, suffix: '7' }
        ];
        break;
    }
  }

  const chordProgression: SongChord[] = rawProg.map(c => {
    const chordRootName = ROOT_NAMES[(rootIndex + c.offset) % 12];
    const bassMidi = rootMidi - 12 + c.offset; // Octave 2
    // Voicing across 4 rows [row0 (N), row1, row2, row3 (S)]:
    const padMidis: [number, number, number, number] = [
      rootMidi + c.offset + c.seventh,
      rootMidi + c.offset + c.fifth,
      rootMidi + c.offset + c.third,
      rootMidi + c.offset
    ];

    return {
      name: `${chordRootName} ${c.suffix}`,
      bassMidi,
      padMidis
    };
  });

  // 5. Title
  const adj = ADJECTIVES[(seed >> 2) % ADJECTIVES.length];
  const noun = NOUNS[(seed >> 6) % NOUNS.length];
  const title = `${adj} ${noun}`;

  // 6. Base BPM: 72 to 104 BPM
  const baseBpm = 72 + ((seed >> 10) % 33);

  return {
    title,
    keyName: `${rootName} ${isMinor ? 'Minor' : 'Major'}`,
    rootMidi,
    scaleName: modeName,
    scaleNotes,
    chordProgression,
    baseBpm
  };
}
