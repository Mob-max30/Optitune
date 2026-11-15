/**
 * Earth Jukebox (EJB) — Sound Postcard Generator (Hidden Gem 5)
 * Specification: Amendment B, Section 9
 *
 * Generates an offline PNG poster snapshot combining:
 * - Current Disc visual render
 * - Source title & Provenance Chip
 * - Scientific caption
 * - Phenomenon tint accent
 * - Official NASA credit and timestamp
 *
 * Runs 100% client-side with 0 external requests.
 */

import type { UiViewModel } from './view-model';

export async function generateSoundPostcard(
  vm: UiViewModel,
  discCanvas: HTMLCanvasElement
): Promise<string> {
  const width = 800;
  const height = 960;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Orbital Night Background
  ctx.fillStyle = '#0B1020';
  ctx.fillRect(0, 0, width, height);

  // Subtle Dusk inner panel
  ctx.fillStyle = '#151C36';
  ctx.strokeStyle = 'rgba(143, 211, 232, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(32, 32, width - 64, height - 64, 16);
  ctx.fill();
  ctx.stroke();

  // 2. Header Brand
  ctx.fillStyle = '#8FD3E8'; // Limb
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('EARTH JUKEBOX', 56, 76);

  ctx.fillStyle = '#AEB6CC';
  ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('NASA Space Apps Challenge 2026 — Algorithmic Sonification', 56, 96);

  // 3. Source Title & Provenance
  ctx.fillStyle = '#F1ECE4';
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(vm.source.title, 56, 140);

  // Provenance Chip box
  ctx.fillStyle = 'rgba(143, 211, 232, 0.12)';
  ctx.strokeStyle = 'rgba(143, 211, 232, 0.3)';
  ctx.beginPath();
  ctx.roundRect(56, 156, 220, 26, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = vm.source.tint || '#8FD3E8';
  ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`●  ${vm.provenance.label}`, 68, 173);

  // 4. Central Disc Snapshot
  const discSize = 440;
  const discX = (width - discSize) / 2;
  const discY = 220;
  ctx.drawImage(discCanvas, discX, discY, discSize, discSize);

  // 5. Scientific Caption
  ctx.fillStyle = '#F1ECE4';
  ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';

  // Word wrap caption
  const words = vm.caption.split(' ');
  let line = '';
  let lineY = 700;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > 640 && i > 0) {
      ctx.fillText(line, width / 2, lineY);
      line = words[i] + ' ';
      lineY += 22;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, width / 2, lineY);

  // 6. Sound Identity & Scale
  ctx.fillStyle = '#AEB6CC';
  ctx.font = '400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const scaleInfo = `Scale: ${vm.identity.scaleName || 'Bhoopali'}  •  Tonic: ${vm.identity.tonic || 'C3'}  •  Mode: ${vm.mode.label}`;
  ctx.fillText(scaleInfo, width / 2, lineY + 36);

  // 7. Footer Credits
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(143, 211, 232, 0.15)';
  ctx.beginPath();
  ctx.moveTo(56, height - 80);
  ctx.lineTo(width - 56, height - 80);
  ctx.stroke();

  ctx.fillStyle = '#AEB6CC';
  ctx.font = '400 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('NASA Earth Information Center & Scientific Visualization Studio Data', 56, height - 56);
  ctx.fillText('Autonomous Distinct-by-Construction Sonification • 0 Cloud Data Egress', 56, height - 42);

  return canvas.toDataURL('image/png');
}

export function downloadPostcard(dataUrl: string, filename = 'earth-jukebox-postcard.png'): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
