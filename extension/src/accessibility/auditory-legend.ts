/**
 * Earth Jukebox (EJB) — Auditory Legend & Accessibility Generator
 *
 * Translates MappingProfile structures into descriptive, screen-reader-friendly
 * auditory legends and ARIA announcements for visually impaired listeners.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { MappingProfile, LegendItem } from '../semantic/types';

export interface LegendDisplayData {
  title: string;
  summary: string;
  items: LegendItem[];
  ariaText: string;
  htmlMarkup: string;
}

/**
 * Generates a concise verbal text explanation of the current sonification mapping,
 * designed for screen readers and auditory menus.
 */
export function generateVerbalLegend(profile: MappingProfile): string {
  if (profile.isSilent || profile.activeMappings.length === 0) {
    return 'Earth Jukebox is currently silent or in an idle state. No active scientific data streams detected.';
  }

  const parts: string[] = [
    `Earth Jukebox Auditory Legend for ${profile.name}. ${profile.activeMappings.length} data streams are sonified across ${profile.totalActiveVoices} synthesizer voices.`
  ];

  for (let idx = 0; idx < profile.auditoryLegend.length; idx++) {
    const item = profile.auditoryLegend[idx];
    const voiceClean = item.targetVoice.replace('_', ' ');
    const dimClean = item.targetAuditoryDimension.replace('_', ' ');

    parts.push(
      `Stream ${idx + 1}: ${item.featureName} (${item.scientificUnit}) maps to ${dimClean} on the ${voiceClean}. ${item.verbalDescription}`
    );
  }

  return parts.join(' ');
}

/**
 * Generates an ARIA-live announcement string for real-time mode changes.
 */
export function generateAriaAnnouncement(profile: MappingProfile): string {
  if (profile.isSilent) {
    return 'Sonification muted: idle state.';
  }

  const voiceSummary = profile.activeMappings
    .map(m => `${m.featureName} on ${m.targetVoice.replace('_', ' ')}`)
    .join(', ');

  return `Active sonification profile loaded: ${profile.name}. Active channels: ${voiceSummary}.`;
}

/**
 * Generates accessible HTML markup suitable for side panels or accessibility modals.
 */
export function generateStructuredLegendHtml(profile: MappingProfile): string {
  if (profile.isSilent || profile.auditoryLegend.length === 0) {
    return `
      <div class="ejb-legend ejb-legend-silent" role="region" aria-label="Auditory Legend">
        <h3>Auditory Legend</h3>
        <p>No active data stream currently mapped.</p>
      </div>
    `.trim();
  }

  const itemsHtml = profile.auditoryLegend
    .map(
      item => `
        <li class="ejb-legend-item">
          <div class="ejb-legend-header">
            <span class="ejb-feature-name"><strong>${escapeHtml(item.featureName)}</strong> (${escapeHtml(item.scientificUnit)})</span>
            <span class="ejb-badge ejb-badge-${escapeHtml(item.targetVoice)}">${escapeHtml(item.targetVoice.replace('_', ' '))}</span>
          </div>
          <p class="ejb-legend-desc">${escapeHtml(item.verbalDescription)}</p>
          <small class="ejb-legend-citation"><em>Ref: ${escapeHtml(item.evidenceCitation)}</em></small>
        </li>
      `
    )
    .join('');

  return `
    <div class="ejb-legend" role="region" aria-label="Auditory Legend for ${escapeHtml(profile.name)}">
      <h3 class="ejb-legend-title">Auditory Legend: ${escapeHtml(profile.name)}</h3>
      <p class="ejb-legend-intro">${profile.activeMappings.length} scientific channels mapped to Web Audio synthesis:</p>
      <ul class="ejb-legend-list" role="list">
        ${itemsHtml}
      </ul>
    </div>
  `.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convenience function returning all accessibility artifacts in a single bundle.
 */
export function getLegendDisplayData(profile: MappingProfile): LegendDisplayData {
  return {
    title: profile.name,
    summary: `${profile.activeMappings.length} channels active (${profile.totalActiveVoices} voices)`,
    items: profile.auditoryLegend,
    ariaText: generateAriaAnnouncement(profile),
    htmlMarkup: generateStructuredLegendHtml(profile)
  };
}
