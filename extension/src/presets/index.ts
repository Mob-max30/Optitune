/**
 * Earth Jukebox (EJB) — Presets Loader & Type-Safe Validator
 *
 * Validates the raw visualizations.json dictionary and guarantees that
 * all ROI and grid definitions conform to strictly typed fixed-length tuples.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { PresetConfig } from '../contract/types';
import rawPresetsData from './visualizations.json';

function isFourTuple(val: unknown): val is [number, number, number, number] {
  return Array.isArray(val) && val.length === 4 && val.every(item => typeof item === 'number' && Number.isFinite(item));
}

function isTwoTuple(val: unknown): val is [number, number] {
  return Array.isArray(val) && val.length === 2 && val.every(item => typeof item === 'number' && Number.isFinite(item));
}

export function parsePresets(raw: Record<string, unknown>): Record<string, PresetConfig> {
  const result: Record<string, PresetConfig> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;

    if (
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.description !== 'string'
    ) {
      continue;
    }

    if (!isFourTuple(entry.roi)) {
      throw new Error(`[Preset Loader] Invalid ROI format in preset "${key}": expected [number, number, number, number]`);
    }

    const grid: [number, number] = isTwoTuple(entry.grid) ? entry.grid : [4, 8];

    result[key] = {
      id: entry.id,
      name: entry.name,
      svsId: typeof entry.svsId === 'number' ? entry.svsId : undefined,
      match: typeof entry.match === 'string' ? entry.match : undefined,
      roi: entry.roi,
      legend: entry.legend as PresetConfig['legend'],
      tickHz: typeof entry.tickHz === 'number' ? entry.tickHz : 12,
      grid,
      description: entry.description,
      soundHint: typeof entry.soundHint === 'string' ? entry.soundHint : undefined,
      ignoreDark: typeof entry.ignoreDark === 'number' ? entry.ignoreDark : undefined,
      events: entry.events as PresetConfig['events'],
      layers: Array.isArray(entry.layers) ? entry.layers.filter((l): l is string => typeof l === 'string') : undefined
    };
  }

  return result;
}

export const PRESETS: Record<string, PresetConfig> = parsePresets(rawPresetsData as Record<string, unknown>);
