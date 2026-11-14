/**
 * Earth Jukebox (EJB) — Indian Classical Raagas & Taalas Engine
 *
 * Implements authentic Indian Classical music theory for scientific sonification:
 * - 12-Swara microtonal modal framework
 * - Raagas matched to NASA planetary phenomena by Rasa (mood), Prakriti, and Time
 * - Classical Taalas (Keharwa, Rupak, Teentaal, Dadra, Jhaptal) with authentic bols
 * - Continuous Meend (glide) and Gamaka ornamentation driven by scientific data
 *
 * Authored by Pranav K & Ujwal A for NASA Space Apps Challenge 2026.
 */

import { midiToFrequency } from './scales';

export type SwaraName =
  | 'S'   // Shadj (Tonic)
  | 'r'   // Komal Rishabh (Minor 2nd)
  | 'R'   // Shuddha Rishabh (Major 2nd)
  | 'g'   // Komal Gandhar (Minor 3rd)
  | 'G'   // Shuddha Gandhar (Major 3rd)
  | 'm'   // Shuddha Madhyam (Perfect 4th)
  | 'M'   // Teevra Madhyam (Augmented 4th / Tritone)
  | 'P'   // Pancham (Perfect 5th)
  | 'd'   // Komal Dhaivat (Minor 6th)
  | 'D'   // Shuddha Dhaivat (Major 6th)
  | 'n'   // Komal Nishad (Minor 7th)
  | 'N';  // Shuddha Nishad (Major 7th)

export interface SwaraDefinition {
  name: SwaraName;
  fullIndianName: string;
  semitoneOffset: number; // Offset from tonic Sa (0 to 11)
}

export const SWARAS: Record<SwaraName, SwaraDefinition> = {
  S: { name: 'S', fullIndianName: 'Shadj', semitoneOffset: 0 },
  r: { name: 'r', fullIndianName: 'Komal Rishabh', semitoneOffset: 1 },
  R: { name: 'R', fullIndianName: 'Shuddha Rishabh', semitoneOffset: 2 },
  g: { name: 'g', fullIndianName: 'Komal Gandhar', semitoneOffset: 3 },
  G: { name: 'G', fullIndianName: 'Shuddha Gandhar', semitoneOffset: 4 },
  m: { name: 'm', fullIndianName: 'Shuddha Madhyam', semitoneOffset: 5 },
  M: { name: 'M', fullIndianName: 'Teevra Madhyam', semitoneOffset: 6 },
  P: { name: 'P', fullIndianName: 'Pancham', semitoneOffset: 7 },
  d: { name: 'd', fullIndianName: 'Komal Dhaivat', semitoneOffset: 8 },
  D: { name: 'D', fullIndianName: 'Shuddha Dhaivat', semitoneOffset: 9 },
  n: { name: 'n', fullIndianName: 'Komal Nishad', semitoneOffset: 10 },
  N: { name: 'N', fullIndianName: 'Shuddha Nishad', semitoneOffset: 11 }
};

export type IndianInstrumentTimbre = 'bansuri' | 'sitar' | 'sarod' | 'veena' | 'esraj';

export interface RaagaProfile {
  id: string;
  name: string;
  carnaticEquivalent?: string;
  thaath: string;
  swaras: SwaraName[]; // Arohana / scale swaras
  vadi: SwaraName;     // Primary emphasized swara
  samvadi: SwaraName;  // Secondary harmonizing swara
  rasa: string;        // Emotional flavor / mood
  timbre: IndianInstrumentTimbre;
  preferredTaala: string;
  phenomenonDescription: string;
}

export interface TaalaBol {
  beat: number;        // 1-indexed beat number
  bol: string;         // Indian stroke syllable: Dha, Dhin, Ge, Na, Tin, Ta, Dhi, Ke
  type: 'sam' | 'tali' | 'khali'; // Sam (1st beat), Tali (clap), Khali (wave/no bass)
  hasBayan: boolean;   // Left-hand bass stroke (Ge/Ghe)
  hasDayan: boolean;   // Right-hand treble stroke (Na/Tin/Ta)
  bayanPitch?: number; // Relative pitch bend for Bayan [0.0, 1.0]
  dayanStroke?: 'rim' | 'ring' | 'muted';
}

export interface TaalaProfile {
  id: string;
  name: string;
  matras: number;      // Total beats in cycle
  vibhaags: number[];  // Beat divisions (e.g. [4, 4] or [3, 2, 2])
  bols: TaalaBol[];    // Theka structure
  defaultBpm: number;
}

/**
 * Authentic Classical Indian Raagas matched to NASA Earth Phenomena.
 */
export const RAAGA_PROFILES: Record<string, RaagaProfile> = {
  // GEDI Forest Canopy Height -> Raaga Bhoopali (Expansive, serene, ancient trees)
  'gedi-forest-height': {
    id: 'gedi-forest-height',
    name: 'Raaga Bhoopali',
    carnaticEquivalent: 'Mohanam',
    thaath: 'Kalyan',
    swaras: ['S', 'R', 'G', 'P', 'D'],
    vadi: 'G',
    samvadi: 'D',
    rasa: 'Shanta (Serenity) & Adbhuta (Majestic Wonder)',
    timbre: 'bansuri',
    preferredTaala: 'keharwa',
    phenomenonDescription: 'Tall forest canopies resonate through the serene pentatonic swaras of Bhoopali on bamboo bansuri, with deep roots in Mandra Sa and high crowns in Taar Ga.'
  },

  // Sea Surface Temperature & Ocean Currents -> Raaga Megh Malhar (Monsoon & Ocean)
  'sst-currents': {
    id: 'sst-currents',
    name: 'Raaga Megh Malhar',
    carnaticEquivalent: 'Madhyamavati',
    thaath: 'Kafi',
    swaras: ['S', 'R', 'm', 'P', 'n'],
    vadi: 'S',
    samvadi: 'P',
    rasa: 'Gambhir (Profound Depth) & Karuna (Oceanic Longing)',
    timbre: 'sitar',
    preferredTaala: 'rupak',
    phenomenonDescription: 'Undulating ocean currents and thermal gradients flow across the monsoon swaras of Megh Malhar on sitar with fluid meend glides over 7-beat Rupak waves.'
  },

  // Earth at Night & Night Lights -> Raaga Yaman (Celestial evening illumination)
  'night-lights': {
    id: 'night-lights',
    name: 'Raaga Yaman',
    carnaticEquivalent: 'Kalyani',
    thaath: 'Kalyan',
    swaras: ['N', 'R', 'G', 'M', 'D', 'N'],
    vadi: 'G',
    samvadi: 'N',
    rasa: 'Shringara (Radiance) & Kanti (Luminous Beauty)',
    timbre: 'sitar',
    preferredTaala: 'jhaptal',
    phenomenonDescription: 'Electrified metropolitan corridors sparkle with the luminous Teevra Madhyam and expansive evening glow of Raaga Yaman.'
  },

  // ISS Lightning Strike Discharges -> Raaga Bhairavi (Dramatic, electric storm)
  'iss-lightning': {
    id: 'iss-lightning',
    name: 'Raaga Bhairavi',
    carnaticEquivalent: 'Sindhu Bhairavi',
    thaath: 'Bhairavi',
    swaras: ['S', 'r', 'g', 'm', 'P', 'd', 'n'],
    vadi: 'm',
    samvadi: 'S',
    rasa: 'Raudra (Storm Fury) & Chamatkar (Awe of Lightning)',
    timbre: 'sitar',
    preferredTaala: 'teentaal',
    phenomenonDescription: 'Sudden electrical discharges strike like explosive Tabla Dha bols across the dramatic, sovereign landscape of Raaga Bhairavi.'
  },

  // Atmospheric Aerosols & Smoke -> Raaga Ahir Bhairav (Misty morning atmosphere)
  'geos-aerosols': {
    id: 'geos-aerosols',
    name: 'Raaga Ahir Bhairav',
    carnaticEquivalent: 'Chakravakam',
    thaath: 'Bhairav',
    swaras: ['S', 'r', 'G', 'm', 'P', 'D', 'n'],
    vadi: 'm',
    samvadi: 'S',
    rasa: 'Bhakti (Contemplative) & Karuna (Mourning Mist)',
    timbre: 'esraj',
    preferredTaala: 'dadra',
    phenomenonDescription: 'Suspended smoke and sea-salt plumes breathe through the contemplative morning swaras of Ahir Bhairav on bowed strings.'
  },

  // General Earth & Terrestrial Imagery -> Raaga Desh (The melody of Earth and Rain)
  'general-earth': {
    id: 'general-earth',
    name: 'Raaga Desh',
    carnaticEquivalent: 'Kedaram',
    thaath: 'Khamaj',
    swaras: ['S', 'R', 'm', 'P', 'N', 'D', 'G'],
    vadi: 'P',
    samvadi: 'R',
    rasa: 'Ananda (Earth Connection) & Harsha (Joyous Rain)',
    timbre: 'bansuri',
    preferredTaala: 'keharwa',
    phenomenonDescription: 'The living biosphere sings the timeless, welcoming melody of Raaga Desh, celebrating the rivers, forests, and clouds of Mother Earth.'
  }
};

/**
 * Classical Indian Taalas with authentic bols and drum strokes.
 */
export const TAALA_PROFILES: Record<string, TaalaProfile> = {
  // Keharwa (8 Beats: 4 + 4) — "Dha Ge Na Tin | Na Ke Dhin Na"
  keharwa: {
    id: 'keharwa',
    name: 'Keharwa Taal',
    matras: 8,
    vibhaags: [4, 4],
    defaultBpm: 84,
    bols: [
      { beat: 1, bol: 'Dha', type: 'sam', hasBayan: true, hasDayan: true, bayanPitch: 0.3, dayanStroke: 'ring' },
      { beat: 2, bol: 'Ge', type: 'tali', hasBayan: true, hasDayan: false, bayanPitch: 0.6 },
      { beat: 3, bol: 'Na', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 4, bol: 'Tin', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'muted' },
      { beat: 5, bol: 'Na', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 6, bol: 'Ke', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'muted' },
      { beat: 7, bol: 'Dhin', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 8, bol: 'Na', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' }
    ]
  },

  // Rupak (7 Beats: 3 + 2 + 2) — "Tin Tin Na | Dhi Na | Dhi Na" (Undulating wave)
  rupak: {
    id: 'rupak',
    name: 'Rupak Taal',
    matras: 7,
    vibhaags: [3, 2, 2],
    defaultBpm: 76,
    bols: [
      { beat: 1, bol: 'Tin', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'muted' },
      { beat: 2, bol: 'Tin', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'muted' },
      { beat: 3, bol: 'Na', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 4, bol: 'Dhi', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.5, dayanStroke: 'ring' },
      { beat: 5, bol: 'Na', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 6, bol: 'Dhi', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.5, dayanStroke: 'ring' },
      { beat: 7, bol: 'Na', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' }
    ]
  },

  // Teentaal (16 Beats: 4 + 4 + 4 + 4) — King of Taalas
  teentaal: {
    id: 'teentaal',
    name: 'Teentaal',
    matras: 16,
    vibhaags: [4, 4, 4, 4],
    defaultBpm: 92,
    bols: [
      { beat: 1, bol: 'Dha', type: 'sam', hasBayan: true, hasDayan: true, bayanPitch: 0.3, dayanStroke: 'ring' },
      { beat: 2, bol: 'Dhin', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 3, bol: 'Dhin', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 4, bol: 'Dha', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.3, dayanStroke: 'ring' },
      { beat: 5, bol: 'Dha', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.3, dayanStroke: 'ring' },
      { beat: 6, bol: 'Dhin', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 7, bol: 'Dhin', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 8, bol: 'Dha', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.3, dayanStroke: 'ring' },
      { beat: 9, bol: 'Dha', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 10, bol: 'Tin', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'muted' },
      { beat: 11, bol: 'Tin', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'muted' },
      { beat: 12, bol: 'Ta', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 13, bol: 'Ta', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 14, bol: 'Dhin', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.5, dayanStroke: 'ring' },
      { beat: 15, bol: 'Dhin', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.5, dayanStroke: 'ring' },
      { beat: 16, bol: 'Dha', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.3, dayanStroke: 'ring' }
    ]
  },

  // Dadra (6 Beats: 3 + 3) — "Dha Dhi Na | Dha Ti Na"
  dadra: {
    id: 'dadra',
    name: 'Dadra Taal',
    matras: 6,
    vibhaags: [3, 3],
    defaultBpm: 90,
    bols: [
      { beat: 1, bol: 'Dha', type: 'sam', hasBayan: true, hasDayan: true, bayanPitch: 0.3, dayanStroke: 'ring' },
      { beat: 2, bol: 'Dhi', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.5, dayanStroke: 'ring' },
      { beat: 3, bol: 'Na', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 4, bol: 'Dha', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 5, bol: 'Ti', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'muted' },
      { beat: 6, bol: 'Na', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' }
    ]
  },

  // Jhaptal (10 Beats: 2 + 3 + 2 + 3) — "Dhi Na | Dhi Dhi Na | Ti Na | Dhi Dhi Na"
  jhaptal: {
    id: 'jhaptal',
    name: 'Jhaptal',
    matras: 10,
    vibhaags: [2, 3, 2, 3],
    defaultBpm: 80,
    bols: [
      { beat: 1, bol: 'Dhi', type: 'sam', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 2, bol: 'Na', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 3, bol: 'Dhi', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 4, bol: 'Dhi', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 5, bol: 'Na', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 6, bol: 'Ti', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'muted' },
      { beat: 7, bol: 'Na', type: 'khali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' },
      { beat: 8, bol: 'Dhi', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 9, bol: 'Dhi', type: 'tali', hasBayan: true, hasDayan: true, bayanPitch: 0.4, dayanStroke: 'ring' },
      { beat: 10, bol: 'Na', type: 'tali', hasBayan: false, hasDayan: true, dayanStroke: 'rim' }
    ]
  }
};

/**
 * Returns the matching Raaga Profile for a NASA dataset ID.
 */
export function getRaagaForDataset(vizId: string): RaagaProfile {
  return RAAGA_PROFILES[vizId] || RAAGA_PROFILES['general-earth'];
}

/**
 * Returns the matching Taala Profile for a NASA dataset ID or Taala name.
 */
export function getTaalaForDataset(vizId: string): TaalaProfile {
  const raaga = getRaagaForDataset(vizId);
  return TAALA_PROFILES[raaga.preferredTaala] || TAALA_PROFILES.keharwa;
}

/**
 * Quantizes a normalized scientific value [0.0, 1.0] to a specific Swara in the active Raaga,
 * returning the exact frequency in Hertz, the Swara symbol, and octave register.
 */
export function quantizeToRaagaSwara(
  normalizedValue: number,
  raaga: RaagaProfile,
  rootMidiNote = 48, // C3 (Sa)
  octaves = 2.5
): { frequency: number; swara: SwaraName; octave: number; midiNote: number } {
  const clamped = Math.max(0, Math.min(1.0, normalizedValue));
  const swaraPool = raaga.swaras;
  const numSteps = Math.floor(octaves * swaraPool.length);
  const targetIndex = Math.min(numSteps - 1, Math.floor(clamped * numSteps));

  const octaveOffset = Math.floor(targetIndex / swaraPool.length);
  const swaraIndex = targetIndex % swaraPool.length;
  const swaraName = swaraPool[swaraIndex];
  const semitones = SWARAS[swaraName].semitoneOffset;

  const midiNote = rootMidiNote + (octaveOffset * 12) + semitones;
  const frequency = midiToFrequency(midiNote);

  return {
    frequency,
    swara: swaraName,
    octave: octaveOffset,
    midiNote
  };
}
