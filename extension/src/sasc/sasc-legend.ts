/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: SASC Auditory Legend & Scientific Explanation Generator
 *
 * Implements Stage 14 of SASC:
 * Translates AuditorySceneProfile objects into descriptive, accessible explanations,
 * generating structured HTML markup and screen-reader ARIA announcements.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { AuditorySceneProfile } from './scene-profile';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates screen-reader-friendly verbal text for the active SASC auditory scene.
 */
export function generateSascVerbalLegend(profile: AuditorySceneProfile): string {
  if (profile.isSilent || profile.activeStreams.length === 0) {
    return 'Earth Jukebox is currently idle or silent. No active scientific data streams detected.';
  }

  const parts: string[] = [
    `Earth Jukebox Scientific Auditory Scene for ${profile.sourceId}. Compiled by SASC with ${profile.activeStreams.length} active streams across ${profile.totalActiveVoices} synthesis voices.`
  ];

  for (let i = 0; i < profile.activeStreams.length; i++) {
    const s = profile.activeStreams[i];
    parts.push(
      `Channel ${i + 1} (${s.role}): ${s.featureName} maps to ${s.targetAuditoryDimension.replace(/_/g, ' ')} on the ${s.targetVoice.replace(/_/g, ' ')}. ${s.verbalDescription}`
    );
  }

  return parts.join(' ');
}

/**
 * Generates accessible HTML markup for side panels, popup legends, or inspector views.
 */
export function generateSascStructuredLegendHtml(profile: AuditorySceneProfile): string {
  if (profile.isSilent || profile.activeStreams.length === 0) {
    return `
      <div class="ejb-legend ejb-legend-silent" role="region" aria-label="Auditory Scene">
        <h3 class="ejb-legend-title">Auditory Scene: Idle</h3>
        <p class="ejb-legend-intro">No active scientific stream currently mapped.</p>
      </div>
    `.trim();
  }

  const streamItemsHtml = profile.activeStreams
    .map(s => `
      <li class="ejb-legend-item">
        <div class="ejb-legend-header">
          <span class="ejb-feature-name"><strong>${escapeHtml(s.featureName)}</strong></span>
          <span class="ejb-badge ejb-badge-role">${escapeHtml(s.role)}</span>
        </div>
        <p class="ejb-legend-desc">
          Mapped to <em>${escapeHtml(s.targetAuditoryDimension.replace(/_/g, ' '))}</em> on the <strong>${escapeHtml(s.targetVoice.replace(/_/g, ' '))}</strong>. ${escapeHtml(s.verbalDescription)}
        </p>
      </li>
    `)
    .join('');

  return `
    <div class="ejb-legend" role="region" aria-label="Auditory Scene for ${escapeHtml(profile.sourceId)}">
      <h3 class="ejb-legend-title">SASC Scene: ${escapeHtml(profile.sourceId)}</h3>
      <p class="ejb-legend-intro">${profile.activeStreams.length} scientific channels actively orchestrated:</p>
      <ul class="ejb-legend-list" role="list">
        ${streamItemsHtml}
      </ul>
    </div>
  `.trim();
}
