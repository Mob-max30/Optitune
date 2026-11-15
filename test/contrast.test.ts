/**
 * Earth Jukebox (EJB) — WCAG 2.1 AA Contrast Verification Suite
 * Specification: Amendment B, Section 10 & 12
 *
 * Verifies that all token color pairs in every phenomenon tint strictly meet
 * or exceed WCAG AA contrast guidelines:
 * - Normal text >= 4.5:1
 * - Large text, UI components, and focus rings >= 3.0:1
 */

import { describe, it, expect } from 'vitest';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(val => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Design Tokens — WCAG 2.1 AA Contrast Ratios', () => {
  const NIGHT = '#0B1020';
  const DUSK = '#151C36';
  const TEXT = '#F1ECE4';
  const MUTED = '#AEB6CC';
  const LIMB = '#8FD3E8';
  const HORIZON = '#F2C9A0';

  const PHENOMENON_TINTS = {
    fire: '#FF6A3D',
    ocean: '#3CC8C0',
    air_quality: '#B6A6FF',
    ice: '#BFE8FF',
    canopy: '#8BD66B',
    night_lights: '#FFC857',
    carbon: '#C9A66B',
    generic_earth: '#8FD3E8'
  };

  it('verifies body text on Night background meets 4.5:1', () => {
    const ratio = contrastRatio(TEXT, NIGHT);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeGreaterThan(12.0); // Night is ~14.5:1
  });

  it('verifies body text on Dusk background meets 4.5:1', () => {
    const ratio = contrastRatio(TEXT, DUSK);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeGreaterThan(11.0); // Dusk is ~12.8:1
  });

  it('verifies muted secondary text on Night background meets 4.5:1', () => {
    const ratio = contrastRatio(MUTED, NIGHT);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeGreaterThan(7.0);
  });

  it('verifies muted secondary text on Dusk background meets 4.5:1', () => {
    const ratio = contrastRatio(MUTED, DUSK);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeGreaterThan(6.0);
  });

  it('verifies Limb focus indicator and border meets 3.0:1 on Night and Dusk', () => {
    expect(contrastRatio(LIMB, NIGHT)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(LIMB, DUSK)).toBeGreaterThanOrEqual(3.0);
  });

  it('verifies Horizon accent meets 3.0:1 on Night and Dusk', () => {
    expect(contrastRatio(HORIZON, NIGHT)).toBeGreaterThanOrEqual(3.0);
    expect(contrastRatio(HORIZON, DUSK)).toBeGreaterThanOrEqual(3.0);
  });

  it('verifies all phenomenon tints meet at least 3.0:1 UI component contrast on Night', () => {
    for (const [name, tintHex] of Object.entries(PHENOMENON_TINTS)) {
      const ratio = contrastRatio(tintHex, NIGHT);
      expect(ratio, `Phenomenon tint ${name} (${tintHex}) failed on Night`).toBeGreaterThanOrEqual(3.0);
    }
  });

  it('verifies all phenomenon tints meet at least 3.0:1 UI component contrast on Dusk', () => {
    for (const [name, tintHex] of Object.entries(PHENOMENON_TINTS)) {
      const ratio = contrastRatio(tintHex, DUSK);
      expect(ratio, `Phenomenon tint ${name} (${tintHex}) failed on Dusk`).toBeGreaterThanOrEqual(3.0);
    }
  });
});
