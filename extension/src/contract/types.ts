/**
 * Earth Jukebox (EJB) — Core Contract Types (v1)
 *
 * Shared data contract between the visual analysis pipeline (Ujwal)
 * and the sonification audio engine (Pranav).
 *
 * All numeric values are strictly normalized floats in [0.0, 1.0] (clamped, 3 decimal places)
 * unless otherwise noted (such as timestamps in seconds, integers for dimensions/indices).
 */

export interface NormalizedRGB {
  r: number; // [0.0, 1.0]
  g: number; // [0.0, 1.0]
  b: number; // [0.0, 1.0]
}

export interface RegionGridMetrics {
  rows: number;
  cols: number;
  /** Row-major array of length rows*cols, normalized brightness [0.0, 1.0] */
  brightness: number[];
  /** Row-major array of length rows*cols, legend-calibrated values [0.0, 1.0] or null */
  dataValue: (number | null)[];
}

export interface DetectedEvent {
  type: 'flash' | 'bright-spot';
  x: number; // [0.0, 1.0] normalized horizontal position in ROI
  y: number; // [0.0, 1.0] normalized vertical position in ROI
  intensity: number; // [0.0, 1.0] relative intensity above baseline
}

export interface SpatialProfile {
  /** Mean normalized brightness per column (e.g. 32 bins) for Caldwell-73 style scanner */
  cols: number[];
  /** Mean normalized brightness per row (e.g. 32 bins) */
  rows: number[];
}

export interface FrameMetrics {
  /** Rec. 601 perceived luminance, normalized [0.0, 1.0] */
  brightness: number;
  /** Normalized dominant RGB color */
  dominantColor: NormalizedRGB;
  /** Normalized HSV hue [0.0, 1.0] derived from 12-bin histogram peak */
  hue: number;
  /** Normalized HSV saturation [0.0, 1.0] */
  saturation: number;
  /**
   * Legend-calibrated physical measurement normalized [0.0, 1.0] against fixed scale.
   * Null if no legend preset exists or pixel is outside data range.
   */
  dataValue: number | null;
  /** Inter-frame pixel motion delta [0.0, 1.0] */
  motion: number;
  /** Coarse N×M spatial grid metrics for stereo panning and regional voice distribution */
  regions: RegionGridMetrics;
}

export interface FrameFlags {
  /** True when user scrubbed/seeked media, signals synth engine to reset gliding/filters */
  seeked: boolean;
  /** True when motion threshold indicates abrupt scene cut or visual transition */
  scene_cut: boolean;
}

export interface EjbFramePayload {
  v: 1;
  /** Video media currentTime in seconds (synchronization anchor) */
  t: number;
  /** Sequential frame index since analysis started */
  frameIndex: number;
  /** Unique ID or preset key for active visualization */
  vizId: string;
  /** Core normalized extracted metrics */
  metrics: FrameMetrics;
  /** Flow and jump control flags */
  flags: FrameFlags;
  /** Discrete bright-spot or lightning detections (optional) */
  events?: DetectedEvent[];
  /** Categorical coverage fractions (e.g. aerosols: dust, smoke, seaSalt) (optional) */
  layers?: Record<string, number>;
  /** Column and row brightness profiles for horizontal scanner mode (optional) */
  profile?: SpatialProfile;
}

export interface PresetLegendConfig {
  file?: string;
  min?: number;
  max?: number;
  unit?: string;
  /** Color stops in RGB format and corresponding value */
  stops?: Array<{ color: [number, number, number]; value: number }>;
}

export interface PresetConfig {
  id: string;
  name: string;
  svsId?: number;
  match?: string;
  /** Normalized ROI rectangle: [x, y, width, height] within video frame */
  roi: [number, number, number, number];
  legend?: PresetLegendConfig;
  tickHz: number;
  grid: [number, number]; // [rows, cols]
  description: string;
  soundHint?: string;
  ignoreDark?: number;
  events?: {
    detect: 'flash' | 'bright-spot';
    baselineAlpha?: number;
    threshold?: number;
  };
  layers?: string[];
}

export interface EjbReadyPayload {
  v: 1;
  vizId: string;
  title: string;
  duration: number;
  width: number;
  height: number;
  preset: PresetConfig | null;
}

export type PlaybackState = 'playing' | 'paused' | 'seeked' | 'ended' | 'lost-media';

export interface EjbStatePayload {
  state: PlaybackState;
  t: number;
}

export interface EjbErrorPayload {
  code: 'TAINTED_CANVAS' | 'NO_MEDIA_FOUND' | 'CAPTURE_STREAM_FAILED' | 'WORKER_ERROR' | 'UNKNOWN';
  message: string;
}

export interface EjbControlPayload {
  tickHz?: number;
  grid?: [number, number];
  roi?: [number, number, number, number];
  mode?: 'scientific' | 'artistic' | 'scanner';
}

/** CustomEvent map for window event listeners */
export interface EjbEventMap {
  'ejb:ready': CustomEvent<EjbReadyPayload>;
  'ejb:frame': CustomEvent<EjbFramePayload>;
  'ejb:state': CustomEvent<EjbStatePayload>;
  'ejb:error': CustomEvent<EjbErrorPayload>;
  'ejb:control': CustomEvent<EjbControlPayload>;
}
