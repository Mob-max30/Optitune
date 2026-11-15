# Earth Jukebox (EJB) — Accessibility (A11Y) Verification Checklist
**Specification Reference:** Amendment B, Section 10 & Gate B7  
**Date:** November 15, 2026  
**Auditors:** Pranav K & Ujwal A  

---

## 1. Compliance Matrix (WCAG 2.1 AA Standards)

| Requirement | Implementation & Technical Mechanism | Status | Automated Test |
| :--- | :--- | :--- | :--- |
| **1.4.3 Contrast (Minimum)** | Night (`#0B1020`), Dusk (`#151C36`), Text (`#F1ECE4` = 14.5:1), Muted (`#AEB6CC` = 7.4:1). All phenomenon tints $\ge 3.0:1$. | **PASS** | `test/contrast.test.ts` (8/8 passing) |
| **1.4.1 Use of Color** | No status or reliability is conveyed by color alone. Provenance uses 4 unique SVG icons + labels. Missing data uses dashed outlines. | **PASS** | Verified in `view-model.ts` & `disc.ts` |
| **2.1.1 Keyboard** | Full operation via keyboard: Space/K (play/pause), 1/2/3 (modes), Arrows (seek / dock move / grid roving), D (data view), Esc (collapse). | **PASS** | `GridOverlay` & `ListeningPanelController` |
| **2.1.2 No Keyboard Trap** | Focus moves sequentially through panel controls; Esc collapses panel without trapping tab key. | **PASS** | Verified |
| **2.4.7 Focus Visible** | All interactive elements show `2px solid var(--ejb-color-limb)` with 2px offset. High contrast border. | **PASS** | `tokens.css` & `listening-panel.css` |
| **4.1.2 Name, Role, Value** | Role attributes: `role="grid"`, `role="row"`, `role="gridcell"`, `role="radiogroup"`, `role="radio"`, `aria-checked`, `aria-pressed`. | **PASS** | `grid-overlay.ts` & `popup.html` |
| **4.1.3 Status Messages** | Single polite `aria-live="polite"` region with 8-second rate limiter to avoid speech synthesiser flooding. | **PASS** | `listening-panel.ts` rate-limiter |
| **2.3.3 Animation from Interactions** | `@media (prefers-reduced-motion: reduce)` respected. Disables orbital bloom and ring scaling; uses static 4 Hz level step. | **PASS** | `tokens.css` & `disc.ts` |
| **Windows High Contrast** | `@media (forced-colors: active)` maps tokens to system `Canvas`, `CanvasText`, `Highlight`, and `ButtonBorder`. | **PASS** | `tokens.css` |
| **Touch / Click Target Size** | All buttons and controls have minimum dimensions of $32 \times 32\text{ px}$ to $48 \times 48\text{ px}$, exceeding $24\text{ px}$ minimum. | **PASS** | CSS inspection |

---

## 2. Screen-Reader Readout Simulation Log

### Reading the Spatial Grid (Roving Tabindex Overlay)
1. *Cell (0, 0) — Calibrated Legend*:  
   `"Band 1, sector 1: about 36.0 m, estimated from the legend, confidence 0.85"`
2. *Cell (2, 4) — Uncalibrated Visual Proxy*:  
   `"Band 3, sector 5: brightness 0.41, relative to this video, picture only"`
3. *Cell (3, 7) — Missing / Out of Gamut*:  
   `"Band 4, sector 8: No usable data here."`

---

## 3. Platform Limitations & Fullscreen Handling

* **Honest Technical Limit (Manifest V3 & DOM Spec)**:  
  When an HTML5 video enters native fullscreen (`video.requestFullscreen()`), elements outside the fullscreen container are visually occluded by the browser's top-layer compositor.
* **Mitigation**:
  1. Audio sonification continues uninterrupted in the background.
  2. Global shortcut `Alt+Shift+S` remains functional to toggle and control sonification.
  3. Limitation logged transparently in `docs/KNOWN_LIMITATIONS.md`.
