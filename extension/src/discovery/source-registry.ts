/**
 * Earth Jukebox (EJB) — NASA Source Discovery & Metadata Registry
 *
 * Official metadata registry for NASA Scientific Visualization Studio (SVS)
 * and Earth Information Center (EIC) datasets.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

export interface NasaSourceRecord {
  sourceId: string;
  svsId: number;
  canonicalUrl: string;
  title: string;
  missionOrInstrument: string;
  scientificVariable: string;
  physicalUnit: string;
  validRange: [number, number];
  hasDirectDataset: boolean;
  directDataUrl?: string;
  hasCalibratedLegend: boolean;
  legendStops?: Array<{ stop: number; color: { r: number; g: number; b: number } }>;
  credits: string;
  description: string;
}

export const NASA_SOURCE_REGISTRY: Record<string, NasaSourceRecord> = {
  'gedi-forest-height': {
    sourceId: 'gedi-forest-height',
    svsId: 4950,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/4950/',
    title: 'GEDI Global Forest Canopy Height',
    missionOrInstrument: 'Global Ecosystem Dynamics Investigation (GEDI) L2A Lidar',
    scientificVariable: 'Canopy Top Height (RH100)',
    physicalUnit: 'm',
    validRange: [0, 60],
    hasDirectDataset: true,
    directDataUrl: 'https://daac.ornl.gov/cgi-bin/dsviewer.pl?ds_id=2017',
    hasCalibratedLegend: true,
    credits: 'NASA GSFC / University of Maryland / Laura Duncanson et al.',
    description: 'High-resolution lidar canopy height measurements across global temperate and tropical forests.'
  },
  'night-lights-change': {
    sourceId: 'night-lights-change',
    svsId: 5313,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/5313/',
    title: 'Earth at Night: Change in Night Lights (2012-2020)',
    missionOrInstrument: 'Suomi NPP / VIIRS Day-Night Band',
    scientificVariable: 'Nighttime Surface Radiance',
    physicalUnit: 'nW/(cm^2*sr)',
    validRange: [0, 150],
    hasDirectDataset: true,
    hasCalibratedLegend: true,
    credits: 'NASA Earth Observatory / NOAA NGDC / Miguel Román',
    description: 'Decadal changes in human settlements, electrification, and urban illumination.'
  },
  'iss-lightning': {
    sourceId: 'iss-lightning',
    svsId: 5011,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/5011/',
    title: 'Lightning Events Observed from ISS',
    missionOrInstrument: 'ISS Lightning Imaging Sensor (ISS-LIS)',
    scientificVariable: 'Optical Lightning Radiance',
    physicalUnit: 'microJ/(m^2*sr)',
    validRange: [0, 1000],
    hasDirectDataset: true,
    hasCalibratedLegend: false,
    credits: 'NASA MSFC / GHRC DAAC / ISS-LIS Science Team',
    description: 'Global thunderstorm electrical activity and discrete transient optical pulses.'
  },
  'ocean-sst': {
    sourceId: 'ocean-sst',
    svsId: 3912,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/3912/',
    title: 'Sea Surface Currents and Temperature',
    missionOrInstrument: 'ECCO2 Model / MODIS Infrared',
    scientificVariable: 'Sea Surface Temperature',
    physicalUnit: '°C',
    validRange: [-2, 35],
    hasDirectDataset: true,
    hasCalibratedLegend: true,
    credits: 'NASA JPL / ECCO2 Project',
    description: 'Mesoscale ocean circulation, thermohaline eddies, and sea surface temperature gradients.'
  },
  'geos-fp-aerosols': {
    sourceId: 'geos-fp-aerosols',
    svsId: 5669,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/5669/',
    title: 'GEOS Forward Processing Multi-component Aerosols',
    missionOrInstrument: 'GEOS-FP Atmospheric Chemistry Model',
    scientificVariable: 'Aerosol Optical Thickness (AOD)',
    physicalUnit: 'dimensionless_aod',
    validRange: [0, 3.5],
    hasDirectDataset: true,
    hasCalibratedLegend: true,
    credits: 'NASA GMAO (Global Modeling and Assimilation Office)',
    description: 'Global transport of wildfire smoke plumes, Saharan mineral dust, and marine sea salt spray.'
  },
  'dyamond-co2': {
    sourceId: 'dyamond-co2',
    svsId: 5196,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/5196/',
    title: 'DYAMOND Ultra-High Resolution Global Carbon Dioxide',
    missionOrInstrument: 'GEOS Constituent Model / OCO-2',
    scientificVariable: 'Atmospheric CO2 Concentration',
    physicalUnit: 'ppm',
    validRange: [385, 425],
    hasDirectDataset: true,
    hasCalibratedLegend: true,
    credits: 'NASA GMAO / SVS / Lesley Ott',
    description: 'Global atmospheric carbon dioxide plumes and seasonal terrestrial biosphere respiration.'
  },
  'perpetual-ocean': {
    sourceId: 'perpetual-ocean',
    svsId: 5425,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/5425/',
    title: 'Perpetual Ocean: Surface Currents',
    missionOrInstrument: 'ECCO-2 High-Resolution Global Simulation',
    scientificVariable: 'Current Velocity',
    physicalUnit: 'm/s',
    validRange: [0, 2.5],
    hasDirectDataset: true,
    hasCalibratedLegend: false,
    credits: 'NASA SVS / Horace Mitchell / ECCO2 Group',
    description: 'Streakline visualization of global ocean surface current velocities and turbulence.'
  },
  'air-quality-aqi': {
    sourceId: 'air-quality-aqi',
    svsId: 5533,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/5533/',
    title: 'Air Quality: Surface PM2.5 and Nitrogen Dioxide',
    missionOrInstrument: 'GEOS-CF Model / Sentinel-5P TROPOMI',
    scientificVariable: 'PM2.5 Concentration',
    physicalUnit: 'microg/m^3',
    validRange: [0, 150],
    hasDirectDataset: true,
    hasCalibratedLegend: true,
    credits: 'NASA GMAO / Christoph Keller',
    description: 'Urban air quality, anthropogenic particulate emissions, and atmospheric chemistry.'
  },
  'atmospheric-river': {
    sourceId: 'atmospheric-river',
    svsId: 4960,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/4960/',
    title: '3D Atmospheric River Water Vapor Transport',
    missionOrInstrument: 'GPM Core Observatory / GEOS FP',
    scientificVariable: 'Total Precipitable Water Vapor',
    physicalUnit: 'mm',
    validRange: [0, 75],
    hasDirectDataset: true,
    hasCalibratedLegend: true,
    credits: 'NASA GSFC / SVS',
    description: 'Filamentary corridors of intense horizontal water vapor transport across the Pacific.'
  },
  'caldwell-scanner': {
    sourceId: 'caldwell-scanner',
    svsId: 13786,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/13786/',
    title: 'Data Sonification: Caldwell 73 (NGC 3132)',
    missionOrInstrument: 'Hubble Space Telescope / Chandra X-ray Observatory',
    scientificVariable: 'Multiwavelength Optical/X-ray Flux',
    physicalUnit: 'relative_flux',
    validRange: [0, 1],
    hasDirectDataset: true,
    hasCalibratedLegend: false,
    credits: 'NASA CXC / STScI / SYSTEM Sounds (Matt Russo & Andrew Santaguida)',
    description: 'Horizontal time sweep of the Southern Ring Planetary Nebula where y-axis maps to pitch.'
  },
  'grace-groundwater': {
    sourceId: 'grace-groundwater',
    svsId: 4890,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/4890/',
    title: 'GRACE-FO Terrestrial Water Storage Anomaly',
    missionOrInstrument: 'Gravity Recovery and Climate Experiment (GRACE-FO)',
    scientificVariable: 'Liquid Water Equivalent Anomaly',
    physicalUnit: 'cm',
    validRange: [-30, 30],
    hasDirectDataset: true,
    hasCalibratedLegend: true,
    credits: 'NASA JPL / GFZ Potsdam',
    description: 'Monthly sub-surface groundwater depletion and aquifer storage variations.'
  },
  'modis-fire-aerosols': {
    sourceId: 'modis-fire-aerosols',
    svsId: 4721,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/4721/',
    title: 'MODIS Global Thermal Anomalies & Wildfire Aerosols',
    missionOrInstrument: 'Terra & Aqua / MODIS Fire Products',
    scientificVariable: 'Fire Radiative Power (FRP)',
    physicalUnit: 'MW',
    validRange: [0, 1500],
    hasDirectDataset: true,
    hasCalibratedLegend: true,
    credits: 'NASA FIRMS / LANCE / GSFC',
    description: 'Global thermal active fire detections and smoke emissions.'
  }
};

/**
 * Retrieves documented NASA metadata for a known source ID or SVS ID.
 */
export function getNasaSourceRecord(sourceOrSvsId: string | number): NasaSourceRecord | undefined {
  if (typeof sourceOrSvsId === 'number') {
    return Object.values(NASA_SOURCE_REGISTRY).find(r => r.svsId === sourceOrSvsId);
  }
  return NASA_SOURCE_REGISTRY[sourceOrSvsId];
}

/**
 * Returns safe fallback metadata for an unknown or uncatalogued visual source,
 * explicitly marking it as an uncalibrated visual proxy.
 */
export function getGenericFallbackRecord(sourceId = 'unknown-source'): NasaSourceRecord {
  return {
    sourceId,
    svsId: 0,
    canonicalUrl: 'https://svs.gsfc.nasa.gov/',
    title: `NASA Visual Feed (${sourceId})`,
    missionOrInstrument: 'Unspecified NASA Earth Science Source',
    scientificVariable: 'Perceptual Visual Proxy (Luminance & Optical Motion)',
    physicalUnit: 'ratio',
    validRange: [0, 1],
    hasDirectDataset: false,
    hasCalibratedLegend: false,
    credits: 'NASA Scientific Visualization Studio',
    description: 'Generic visual proxy fallback. No calibration established; scientific values are not inferred.'
  };
}
