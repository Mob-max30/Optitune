/**
 * Earth Jukebox (EJB) — Perceptual Semantic Mapping Knowledge Base
 *
 * An evidence-labelled catalogue of candidate scientific-to-auditory mappings,
 * documenting perceptual correspondences, scaling functions, conflict rules,
 * and audio voice allocations.
 *
 * Authored by Pranav K & Ujwal A.
 */

export type AuditoryDimension =
  | 'pitch_frequency'
  | 'amplitude_gain'
  | 'lowpass_cutoff'
  | 'stereo_pan'
  | 'pulse_rate_tempo'
  | 'transient_percussion'
  | 'noise_density'
  | 'harmonic_mode'
  | 'latitudinal_voicing';

export type TargetVoiceId =
  | 'lead_voice'
  | 'pad_voice'
  | 'percussion_voice'
  | 'noise_voice'
  | 'scanner_voice';

export type EvidenceLevel =
  | 'strong_empirical'       // Proven crossmodal correspondence in perceptual literature
  | 'moderate_literature'    // Established sonification practice in ICAD/NASA literature
  | 'design_hypothesis';     // Coherent project design prior requiring listener validation

export interface SemanticMappingEntry {
  mappingId: string;
  scientificDimension: string;
  matchingFeaturePatterns: string[]; // Glob-like strings or exact names
  targetAuditoryDimension: AuditoryDimension;
  targetVoice: TargetVoiceId;
  scalingFunction: 'linear' | 'logarithmic' | 'exponential' | 'quantized_scale' | 'threshold_trigger';
  evidenceLevel: EvidenceLevel;
  scientificRationale: string;
  literatureCitation: string;
  conflictsWith: AuditoryDimension[];
  verbalDescription: string;
}

export const MAPPING_KNOWLEDGE_BASE: SemanticMappingEntry[] = [
  // 1. Vertical Magnitude -> Pitch (Strong empirical crossmodal correspondence)
  {
    mappingId: 'map.magnitude.altitude_to_pitch',
    scientificDimension: 'magnitude',
    matchingFeaturePatterns: ['canopy_height', 'altitude', 'elevation', 'plume_height'],
    targetAuditoryDimension: 'pitch_frequency',
    targetVoice: 'lead_voice',
    scalingFunction: 'logarithmic',
    evidenceLevel: 'strong_empirical',
    scientificRationale: 'Physical elevation and vertical magnitude naturally map to acoustic pitch due to universal crossmodal perceptual elevation bias.',
    literatureCitation: 'Spence, C. (2011). Crossmodal correspondences: A tutorial review. Attention, Perception, & Psychophysics, 73(4), 971-995.',
    conflictsWith: ['pitch_frequency'],
    verbalDescription: 'Taller canopy height and higher elevation sound higher in pitch.'
  },

  // 2. Thermal Magnitude -> Harmonic Mode / Pitch
  {
    mappingId: 'map.magnitude.temperature_to_harmonic_mode',
    scientificDimension: 'magnitude',
    matchingFeaturePatterns: ['sea_surface_temperature', 'temperature', 'thermal_anomaly'],
    targetAuditoryDimension: 'harmonic_mode',
    targetVoice: 'lead_voice',
    scalingFunction: 'quantized_scale',
    evidenceLevel: 'moderate_literature',
    scientificRationale: 'Sub-zero temperatures map to dissonant minor/Locrian modes, transitioning through Dorian to warm, resonant major keys at tropical temperatures.',
    literatureCitation: 'Walker, B. N. (2002). Magnitude estimation of conceptual associations for sonification. Human Factors, 44(3), 388-400.',
    conflictsWith: ['harmonic_mode'],
    verbalDescription: 'Colder waters sound in solemn minor modes; warmer waters transition into warm, bright major chords.'
  },

  // 3. Chemical / Greenhouse Concentration -> Harmonic Density & Pitch
  {
    mappingId: 'map.magnitude.concentration_to_pitch_tension',
    scientificDimension: 'magnitude',
    matchingFeaturePatterns: ['co2_concentration', 'methane_ppm', 'ozone_dobson'],
    targetAuditoryDimension: 'pitch_frequency',
    targetVoice: 'lead_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'moderate_literature',
    scientificRationale: 'Accumulation of atmospheric greenhouse gases builds harmonic acoustic tension and ascending pitch center.',
    literatureCitation: 'Barrass, S. (1997). Auditory Information Design. PhD Thesis, Australian National University.',
    conflictsWith: ['pitch_frequency'],
    verbalDescription: 'Higher greenhouse gas concentration builds acoustic pitch and overtone tension.'
  },

  // 4. Perceptual Luminance -> Amplitude Gain (Loudness)
  {
    mappingId: 'map.magnitude.luma_to_amplitude',
    scientificDimension: 'magnitude',
    matchingFeaturePatterns: ['perceptual_luminance', 'brightness', 'surface_radiance'],
    targetAuditoryDimension: 'amplitude_gain',
    targetVoice: 'lead_voice',
    scalingFunction: 'exponential',
    evidenceLevel: 'strong_empirical',
    scientificRationale: 'Optical illumination intensity correlates directly with perceived acoustic energy and amplitude presence.',
    literatureCitation: 'Stevens, S. S. (1975). Psychophysics: Introduction to its perceptual, neural, and social prospects. John Wiley & Sons.',
    conflictsWith: ['amplitude_gain'],
    verbalDescription: 'Brighter illumination sounds louder and more acoustically present.'
  },

  // 5. Inter-frame Motion Velocity -> Lowpass Filter Cutoff
  {
    mappingId: 'map.velocity.motion_to_filter_cutoff',
    scientificDimension: 'velocity',
    matchingFeaturePatterns: ['interframe_motion_delta', 'optical_flow', 'fluid_speed'],
    targetAuditoryDimension: 'lowpass_cutoff',
    targetVoice: 'lead_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'strong_empirical',
    scientificRationale: 'Rapid fluid movement and atmospheric dynamics naturally correspond to brighter spectral high frequencies (unclamping acoustic damping).',
    literatureCitation: 'Bregman, A. S. (1990). Auditory Scene Analysis: The Perceptual Organization of Sound. MIT Press.',
    conflictsWith: ['lowpass_cutoff'],
    verbalDescription: 'Faster motion and rushing currents open the acoustic filter, making the sound brighter and crisper.'
  },

  // 6. Fluid Velocity -> Noise Wash Intensity
  {
    mappingId: 'map.velocity.current_to_noise_wash',
    scientificDimension: 'velocity',
    matchingFeaturePatterns: ['current_streak_velocity', 'wave_energy', 'wind_speed'],
    targetAuditoryDimension: 'noise_density',
    targetVoice: 'noise_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'moderate_literature',
    scientificRationale: 'Mesoscale ocean eddies and atmospheric winds are naturally communicated through filtered pink noise wash.',
    literatureCitation: 'Gaver, W. W. (1993). What in the world do we hear? An ecological approach to auditory event perception. Ecological Psychology, 5(1), 1-29.',
    conflictsWith: ['noise_density'],
    verbalDescription: 'Turbulent currents and ocean eddies create a gentle modulated oceanic wave wash.'
  },

  // 7. Horizontal Position -> Stereo Panning
  {
    mappingId: 'map.position.longitude_to_stereo_pan',
    scientificDimension: 'position',
    matchingFeaturePatterns: ['longitude', 'x_coord', 'spatial_regional_matrix'],
    targetAuditoryDimension: 'stereo_pan',
    targetVoice: 'lead_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'strong_empirical',
    scientificRationale: 'Geographic and visual horizontal coordinate maps 1:1 to interaural time and level difference (binaural stereo field).',
    literatureCitation: 'Blauert, J. (1997). Spatial Hearing: The Psychophysics of Human Sound Localization. MIT Press.',
    conflictsWith: ['stereo_pan'],
    verbalDescription: 'Events in the western hemisphere sound to your left; eastern hemisphere sounds to your right.'
  },

  // 8. Latitudinal Geographic Bands -> 4-Row Polyphonic Chord
  {
    mappingId: 'map.position.latitude_to_row_voicing',
    scientificDimension: 'structure_distribution',
    matchingFeaturePatterns: ['spatial_regional_matrix', 'latitude_bands'],
    targetAuditoryDimension: 'latitudinal_voicing',
    targetVoice: 'pad_voice',
    scalingFunction: 'quantized_scale',
    evidenceLevel: 'design_hypothesis',
    scientificRationale: 'Splitting the 4 rows of the spatial grid from North to South into Soprano, Alto, Tenor, and Bass registers enables spatial chord harmony.',
    literatureCitation: 'Earth Jukebox Master Architecture (2026). NASA Space Apps Challenge.',
    conflictsWith: ['latitudinal_voicing'],
    verbalDescription: 'Northern hemisphere events sound in higher registers; equatorial and southern regions anchor the deep fundamental.'
  },

  // 9. Discrete Lightning Discharges -> Transient Percussion
  {
    mappingId: 'map.event.lightning_to_percussion',
    scientificDimension: 'events_anomalies',
    matchingFeaturePatterns: ['optical_lightning_flash', 'lightning_event', 'flash'],
    targetAuditoryDimension: 'transient_percussion',
    targetVoice: 'percussion_voice',
    scalingFunction: 'threshold_trigger',
    evidenceLevel: 'strong_empirical',
    scientificRationale: 'Instantaneous optical bursts match ecological sound perception of discrete physical impacts (sharp attack, fast exponential decay).',
    literatureCitation: 'Gaver, W. W. (1993). Synthesizing auditory icons. Proceedings of INTERCHI 1993, 228-235.',
    conflictsWith: ['transient_percussion'],
    verbalDescription: 'Lightning strikes and electrical discharges produce crisp percussive clicks positioned where the strike occurred.'
  },

  // 10. Aerosol Smoke Plumes -> Analog Sawtooth Texture
  {
    mappingId: 'map.category.smoke_to_analog_saw',
    scientificDimension: 'structure_distribution',
    matchingFeaturePatterns: ['aerosol_smoke_coverage', 'wildfire_smoke'],
    targetAuditoryDimension: 'noise_density',
    targetVoice: 'noise_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'design_hypothesis',
    scientificRationale: 'Warm, particulate-dense wildfire smoke maps to warm analog sawtooth timbre with 950 Hz bandpass filtering.',
    literatureCitation: 'Earth Jukebox Master Architecture (2026). NASA Space Apps Challenge.',
    conflictsWith: ['noise_density'],
    verbalDescription: 'Smoke plumes add a warm, textured analog resonance to the soundscape.'
  },

  // 11. Aerosol Dust Plumes -> Filtered Pink Grain Noise
  {
    mappingId: 'map.category.dust_to_pink_grain',
    scientificDimension: 'structure_distribution',
    matchingFeaturePatterns: ['aerosol_dust_coverage', 'mineral_dust'],
    targetAuditoryDimension: 'noise_density',
    targetVoice: 'noise_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'design_hypothesis',
    scientificRationale: 'Dry mineral dust transport maps to resonant filtered pink noise centered at 650 Hz.',
    literatureCitation: 'Earth Jukebox Master Architecture (2026). NASA Space Apps Challenge.',
    conflictsWith: ['noise_density'],
    verbalDescription: 'Desert dust storms sound like a soft, granular atmospheric whisper.'
  },

  // 12. Aerosol Sea Salt -> Crystalline High-Register Sines
  {
    mappingId: 'map.category.seasalt_to_crystalline_sines',
    scientificDimension: 'structure_distribution',
    matchingFeaturePatterns: ['aerosol_seasalt_coverage', 'marine_sea_salt'],
    targetAuditoryDimension: 'pitch_frequency',
    targetVoice: 'pad_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'design_hypothesis',
    scientificRationale: 'Marine sea salt spray maps to high-frequency glassy overtones (2200 Hz).',
    literatureCitation: 'Earth Jukebox Master Architecture (2026). NASA Space Apps Challenge.',
    conflictsWith: [],
    verbalDescription: 'Marine sea spray introduces crystalline, high-register acoustic sparkle.'
  },

  // 13. Particulate Air Quality -> Acoustic Distortion / Resonance
  {
    mappingId: 'map.magnitude.air_quality_to_distortion',
    scientificDimension: 'magnitude',
    matchingFeaturePatterns: ['air_quality_index', 'pm25_density', 'smog_plume'],
    targetAuditoryDimension: 'lowpass_cutoff',
    targetVoice: 'lead_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'moderate_literature',
    scientificRationale: 'Worsening air pollution increases acoustic roughness, resonance Q, and high-frequency distortion.',
    literatureCitation: 'Vickers, P. (2016). Sonification and aesthetics: Counterpoint, dissonance, and musicality. The Oxford Handbook of Approach to Sound.',
    conflictsWith: ['lowpass_cutoff'],
    verbalDescription: 'Heavy particulate pollution creates an edgy, distorted acoustic resonance.'
  },

  // 14. Water Vapor Plume Width -> Stereo Acoustic Width
  {
    mappingId: 'map.structure.atmospheric_river_to_stereo_width',
    scientificDimension: 'structure_distribution',
    matchingFeaturePatterns: ['vapor_plume_width', 'atmospheric_river_corridor'],
    targetAuditoryDimension: 'stereo_pan',
    targetVoice: 'pad_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'moderate_literature',
    scientificRationale: 'Wider geographic water vapor transport corridors naturally expand the binaural acoustic stereo field.',
    literatureCitation: 'Blauert, J. (1997). Spatial Hearing: The Psychophysics of Human Sound Localization. MIT Press.',
    conflictsWith: [],
    verbalDescription: 'Wider atmospheric river plumes broaden the stereo acoustic field across your headphones.'
  },

  // 15. Caldwell-73 Horizontal Scanner Sweep
  {
    mappingId: 'map.scanner.column_time_sweep',
    scientificDimension: 'temporal_behaviour',
    matchingFeaturePatterns: ['spatial_profiles_cols', 'astronomical_flux', 'caldwell_scanner'],
    targetAuditoryDimension: 'pulse_rate_tempo',
    targetVoice: 'scanner_voice',
    scalingFunction: 'linear',
    evidenceLevel: 'strong_empirical',
    scientificRationale: 'NASA Chandra & SYSTEM Sounds standard: x-axis converts directly to time, y-axis converts directly to pitch.',
    literatureCitation: 'NASA / Chandra X-ray Center / SYSTEM Sounds (2020). Data Sonification: Caldwell 73 (SVS 13786).',
    conflictsWith: ['pulse_rate_tempo'],
    verbalDescription: 'Time scans horizontally from left to right; vertical position maps to pitch.'
  }
];

export function getMappingById(mappingId: string): SemanticMappingEntry | undefined {
  return MAPPING_KNOWLEDGE_BASE.find(m => m.mappingId === mappingId);
}

export function findCandidateMappings(featureName: string, scientificDimension?: string): SemanticMappingEntry[] {
  const normName = featureName.toLowerCase();
  return MAPPING_KNOWLEDGE_BASE.filter(entry => {
    if (scientificDimension && entry.scientificDimension !== scientificDimension) {
      return false;
    }
    return entry.matchingFeaturePatterns.some(pattern => normName.includes(pattern.toLowerCase()));
  });
}
