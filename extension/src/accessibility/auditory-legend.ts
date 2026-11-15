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
  if (profile.isSilent || (profile.auditoryLegend.length === 0 && !profile.palette)) {
    return `
      <div class="ejb-legend ejb-legend-silent" role="region" aria-label="Auditory Legend">
        <h3>Auditory Legend</h3>
        <p>No active data stream currently mapped.</p>
      </div>
    `.trim();
  }

  // Identity banner (Amendment A Step 13)
  let identityHtml = '';
  if (profile.identity) {
    const tonic = escapeHtml(profile.identity.tonic || 'C3');
    const scale = escapeHtml(profile.identity.scaleId || 'dorian');
    const tempo = profile.identity.tempoBase || 80;
    const groove = escapeHtml((profile.identity.grooveTemplate || '').replace('groove.', ''));
    const motif = escapeHtml((profile.identity.motifId || '').replace('motif.', ''));

    identityHtml = `
      <div class="ejb-legend-identity" style="margin-bottom: 6px; padding: 4px 6px; background: rgba(30, 41, 59, 0.7); border-radius: 4px; font-size: 11px;">
        <span class="ejb-badge ejb-badge-identity" style="background: #8b5cf6; color: white; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 9px; margin-right: 4px;">[IDENTITY]</span>
        <strong>Signature:</strong> ${tonic} ${scale} · ${tempo} BPM · ${groove} · ${motif}
      </div>
    `;
  }

  // Context sound palette (Amendment A Step 13)
  let paletteHtml = '';
  if (profile.palette) {
    paletteHtml = `
      <div class="ejb-legend-palette" style="margin-bottom: 6px; padding: 4px 6px; background: rgba(30, 41, 59, 0.7); border-radius: 4px; font-size: 11px;">
        <span class="ejb-badge ejb-badge-context" style="background: #0ea5e9; color: white; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 9px; margin-right: 4px;">[CONTEXT]</span>
        <strong>Sound Bed:</strong> ${escapeHtml(profile.palette.id)} (v${profile.palette.variant}) — ${escapeHtml(profile.palette.description)}
      </div>
    `;
  }

  const itemsHtml = profile.auditoryLegend
    .map(
      item => {
        const mClass = (item.meaningClass || 'data').toUpperCase();
        const badgeColor = mClass === 'CONTEXT' ? '#0ea5e9' : mClass === 'IDENTITY' ? '#8b5cf6' : '#10b981';

        return `
        <li class="ejb-legend-item" style="margin-bottom: 6px;">
          <div class="ejb-legend-header">
            <span class="ejb-badge" style="background: ${badgeColor}; color: white; padding: 1px 4px; border-radius: 3px; font-weight: bold; font-size: 9px; margin-right: 4px;">[${mClass}]</span>
            <span class="ejb-feature-name"><strong>${escapeHtml(item.featureName)}</strong> (${escapeHtml(item.scientificUnit)})</span>
            <span class="ejb-badge ejb-badge-${escapeHtml(item.targetVoice)}">${escapeHtml(item.targetVoice.replace('_', ' '))}</span>
          </div>
          <p class="ejb-legend-desc" style="margin: 2px 0 1px 0;">${escapeHtml(item.verbalDescription)}</p>
          <small class="ejb-legend-citation"><em>Ref: ${escapeHtml(item.evidenceCitation)}</em></small>
        </li>
      `;
      }
    )
    .join('');

  return `
    <div class="ejb-legend" role="region" aria-label="Auditory Legend for ${escapeHtml(profile.name)}">
      <h3 class="ejb-legend-title" style="margin-top: 0; margin-bottom: 4px;">Auditory Legend: ${escapeHtml(profile.name)}</h3>
      ${identityHtml}
      ${paletteHtml}
      <p class="ejb-legend-intro" style="margin-top: 4px; margin-bottom: 4px;">${profile.activeMappings.length} scientific data channels:</p>
      <ul class="ejb-legend-list" role="list" style="padding-left: 14px; margin: 0;">
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
