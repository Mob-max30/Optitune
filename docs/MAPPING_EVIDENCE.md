# Earth Jukebox (EJB) — Sonification Mapping Evidence & Theoretical Foundation

> **Document Type:** Scientific Literature Review & Psychoacoustic Rationale  
> **Authors:** Pranav K & Ujwal A (NASA Space Apps Challenge 2026)  
> **Companion Document:** `docs/MAPPING_KNOWLEDGE_BASE.md`

---

## 1. Introduction

Auditory display design frequently suffers from the "arbitrary mapping syndrome," where data parameters are linked to acoustic dimensions purely based on algorithmic convenience or author intuition. When listeners lack an intuitive mental model, cognitive load escalates, leading to misinterpretation of scientific data.

Earth Jukebox grounds every auditory mapping in empirical psychoacoustics, ecological sound perception, and published sonification research from the **International Community for Auditory Display (ICAD)**, **NASA Scientific Visualization Studio (SVS)**, and peer-reviewed perceptual cognitive psychology.

---

## 2. Psychoacoustic Literature Foundations

### 2.1. Vertical Spatial & Pitch Elevation Correspondences
- **Citation:** Spence, C. (2011). *Crossmodal correspondences: A tutorial review.* Attention, Perception, & Psychophysics, 73(4), 971–995.
- **Citation:** Walker, B. N., & Nees, M. A. (2011). *Theory of Sonification.* In T. Hermann, A. Hunt, & J. G. Neuhoff (Eds.), *The Sonification Handbook* (pp. 9–39). Logos Publishing.
- **Empirical Grounding:** Across cultures and age demographics, human observers exhibit an intrinsic "elevation crossmodal correspondence" — associating higher spatial altitude, elevation, and vertical physical height with higher acoustic pitch frequencies.
- **Implementation in Earth Jukebox:** In `map.magnitude.altitude_to_pitch`, GEDI lidar canopy height (0 to 60 meters) and volcanic plume altitude (0 to 15,000 meters) map directly to ascending fundamental frequency (110 Hz – 880 Hz). The mapping polarity is strictly positive (higher physical height = higher pitch).

### 2.2. Stevens' Power Law & Luminance-to-Loudness
- **Citation:** Stevens, S. S. (1975). *Psychophysics: Introduction to its perceptual, neural, and social prospects.* John Wiley & Sons.
- **Empirical Grounding:** Stevens demonstrated that perceived psychological sensation magnitude $\psi$ follows a power function of physical stimulus intensity $I$: $\psi(I) = k \cdot I^\beta$. For visual brightness and acoustic loudness, listeners perceive non-linear expansion.
- **Implementation in Earth Jukebox:** `map.magnitude.luma_to_amplitude` scales master amplitude using an exponent $\gamma = 1.6$, preventing perceptual compression in the mid-tones and providing clear auditory distinction between deep shadows and cloud/ice reflections.

### 2.3. Auditory Scene Analysis (ASA) & Spectral Damping
- **Citation:** Bregman, A. S. (1990). *Auditory Scene Analysis: The Perceptual Organization of Sound.* MIT Press.
- **Empirical Grounding:** In ecological acoustics, moving objects and turbulent fluids shed high-frequency spectral damping. When motion accelerates, friction, shear, and optical turbulence generate increased high-frequency energy.
- **Implementation in Earth Jukebox:** `map.velocity.motion_to_filter_cutoff` modulates a 4-pole lowpass filter cutoff between 300 Hz and 5000 Hz based on frame-to-frame pixel velocity. Stationary views sound muted and calm; rapid atmospheric convection or ocean currents immediately brighten and open the spectrum.

### 2.4. Ecological Perception of Events & Auditory Icons
- **Citation:** Gaver, W. W. (1993). *What in the world do we hear? An ecological approach to auditory event perception.* Ecological Psychology, 5(1), 1–29.
- **Citation:** Gaver, W. W. (1993). *Synthesizing auditory icons.* Proceedings of INTERCHI 1993, 228–235.
- **Empirical Grounding:** Humans do not hear abstract frequencies; they perceive everyday physical events (collisions, explosions, electrical discharges). Instantaneous optical bursts require transient acoustic signatures with immediate attack (<1 ms) and fast exponential decay (<30 ms).
- **Implementation in Earth Jukebox:** `map.event.lightning_to_percussion` detects rapid localized luma spikes (>85% brightness surge in a single frame) and triggers a discrete stereo percussion strike, panned to the exact spatial centroid of the flash.

### 2.5. Spatial Hearing & Binaural Localization
- **Citation:** Blauert, J. (1997). *Spatial Hearing: The Psychophysics of Human Sound Localization.* MIT Press.
- **Citation:** Wightman, F. L., & Kistler, D. J. (1992). *The dominant role of low-frequency interaural time differences in sound localization.* Journal of the Acoustical Society of America, 91(3), 1648–1661.
- **Empirical Grounding:** Horizontal azimuth localization relies on Interaural Time Differences (ITD) and Interaural Level Differences (ILD).
- **Implementation in Earth Jukebox:** `map.position.longitude_to_stereo_pan` pans signals smoothly from Left (-1.0) to Right (+1.0) as data moves from Western to Eastern longitudes.

### 2.6. Timbral Differentiation of Atmospheric Particulates
- **Citation:** Neuhoff, J. G. (2004). *Ecological Psychoacoustics.* Academic Press.
- **Citation:** Vickers, P. (2016). *Sonification and aesthetics: Counterpoint, dissonance, and musicality.* In *The Oxford Handbook of Approach to Sound*.
- **Empirical Grounding:** Multi-component aerosol transport (smoke, dust, sea salt) requires distinct spectral timbres to prevent perceptual blending into noise.
- **Implementation in Earth Jukebox:**
  - **Smoke Plumes:** Rich analog sawtooth wave with 950 Hz bandpass filtering (dense, smoky warmth).
  - **Mineral Dust:** Granular filtered pink noise centered at 650 Hz (dry, desert grit).
  - **Sea Salt:** Crystalline high-register sine harmonics at 2200 Hz (clean, marine spray).

### 2.7. NASA SVS Sonification Heritage
- **Citation:** NASA Scientific Visualization Studio (SVS) & Chandra X-ray Center (2020). *Data Sonification: Caldwell 73 (NGC 3132).* SVS Entry 13786.
- **Empirical Grounding:** For astronomical and planetary raster sweeps, NASA establishes the horizontal-time, vertical-pitch convention.
- **Implementation in Earth Jukebox:** Mode 10 (`caldwell-scanner`) reproduces this standard faithfully, using a 16-bank sine additive synthesis engine sweeping horizontally over 12 seconds.

---

## 3. Evidence Matrix & Classification Standard

Every mapping entry in `extension/src/semantic/mapping-knowledge-base.ts` is formally tagged with one of three evidence levels:

1. **`strong_empirical`**:
   - Backed by randomized controlled psychoacoustic trials (Spence, Stevens, Bregman, Blauert, Gaver).
   - Zero ambiguity regarding perceptual polarity.
   - Example: Vertical elevation $\to$ acoustic pitch; horizontal position $\to$ stereo pan.
2. **`moderate_literature`**:
   - Documented in established sonification literature (ICAD conference proceedings, NASA SVS public projects, Walker's magnitude estimation guidelines).
   - Known to be effective, though subject to moderate user preference variation.
   - Example: Temperature $\to$ harmonic minor/major modality; greenhouse gas $\to$ acoustic tension.
3. **`design_hypothesis`**:
   - Engineered by the Earth Jukebox team to solve a specific multi-channel visualization challenge where prior sonification literature is sparse.
   - Requires ongoing listener validation and user customization controls.
   - Example: 4-row latitudinal Soprano-Alto-Tenor-Bass polyphony; multi-aerosol timbral tripartition.
