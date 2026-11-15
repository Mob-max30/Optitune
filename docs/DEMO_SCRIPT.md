# Earth Jukebox (EJB) — Demonstration & Judging Protocol ("The Listening Room")
**Specification Reference:** Amendment B, Section 2 & 13  
**Authors:** Pranav K & Ujwal A (NASA Space Apps Challenge 2026)  
**Live Listening Room:** `demo-page/dist/index.html` (or `npm run build` then open `demo-page/dist/index.html`)

---

## 1. The 5-Second Test Walkthrough (Judging Rapid Evaluation)

In a 2-minute hackathon evaluation, any judge can answer three foundational questions within 5 seconds of cold opening:
1. **What is playing?**  
   The source header immediately states the exact NASA dataset (e.g., *"GEDI Forest Canopy Height"*), accompanied by the prominent **Provenance Chip**: `[Estimated from the legend (i)]`.
2. **Where does the sound come from?**  
   **The Listening Disc** visually displays 4 concentric orbital rings (top band = soprano to bottom band = sub-bass foundation) across 8 spatial columns.
3. **Does the picture actually drive it?**  
   As colors and clouds move in the video, the matching sectors in the Disc illuminate, and the thin outer rim vibrates in real-time with the audio engine's frequency output.

---

## 2. Step-by-Step Demonstration Script

### Act 1: The Listening Disc & Calibrated Canopy Height (GEDI SVS 4950)
1. Select **`GEDI Forest Canopy Height`** in the top dataset picker.
2. Observe the Provenance Chip: displays `[Estimated from the legend]`.
3. Click **`▶ Start listening`**.
4. **The Tune-in Moment:** The Disc rings smoothly draw outward from the center over 1.2 seconds, synchronized with the first acoustic onset of the synthesizer bed.
5. **Listen & Observe:**
   - As forest canopy height rises to 45–60 meters, the lead frequency ascends resonant in pitch.
   - The caption dynamically updates: *"Tall, dense forest across the middle of the view, so the tone is deep and full."*
6. **Data View Toggle:** Click `⊞ Data View` to inspect the full 32-cell spatial table, or press <kbd>D</kbd>.

### Act 2: Multi-Mode Synthesis (Exact vs. Musical vs. Sweep)
1. In the **How it sounds** segmented control:
   - Click **`Exact`**: Pitch follows the exact unquantized physical measurement continuously.
   - Click **`Musical`**: Audio quantizes to authentic Indian Classical Raagas & Taalas (e.g. Bhoopali / Keharwa) with Tanpura drone and Tabla pulse.
   - Click **`Sweep`**: A radial white playhead line sweeps across the Disc columns left-to-right, reading the image like an acoustic telescope (Caldwell-73).

### Act 3: Sound Layer Soloing ("What You're Hearing")
1. Look at the **What you're hearing** legend list.
2. Hover or focus the **Canopy height** layer: observe that the top two rings of the Disc glow to indicate the active driven band.
3. Click the **`[Solo]`** button on **Spatial Position**:
   - All other synthesizer layers mute immediately.
   - Only the spatial stereo panner is heard, demonstrating unambiguous parameter mapping.
4. Click `[Solo]` again to restore the full orchestral mix.

### Act 4: Discrete Lightning Bursts (ISS Lightning SVS 5011)
1. Switch preset to **`Lightning Events Observed from ISS`**.
2. Notice the phenomenon tint transitions gracefully across 600ms to atmospheric blue.
3. As lightning flashes pulse, transient blooms glow in the matching sector of the Disc while percussive strikes click in stereo.

### Act 5: Provenance Abstention & Honest Visual Proxy
1. Switch feed to an uncalibrated custom video or generic Earth view.
2. The Provenance Chip immediately shifts to `[Based on the picture only]`.
3. The caption shifts to visual-only wording: *"High overall visual brightness, producing an elevated acoustic field."*
4. **Key Scientific Integrity Proof:** Earth Jukebox strictly abstains from inventing physical meters, Kelvin, or parts-per-million when only visual proxies are present.

### Act 6: Presentation Mode & Sound Postcard Export
1. Press <kbd>P</kbd> or click **Presentation**: the layout expands into a clean cinematic display suitable for screen recording.
2. Press <kbd>?</kbd> to inspect the accessible keyboard shortcuts sheet.
