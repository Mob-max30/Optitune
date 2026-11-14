# SASC — Auditory Grammar & Temporal Orchestration Specification

**Subsystem:** Earth Jukebox Autonomous Scientific Sonification  
**Component:** `extension/src/sasc/grammar-orchestrator.ts`  
**Purpose:** Temporal dynamics, grammatical layer categorization, event cooldown, and auditory fatigue prevention.

---

## 1. The Four Grammatical Categories

A musical composition is not an uncoordinated collection of sounds; it follows structured temporal grammar. SASC categorizes active acoustic streams into four grammatical tiers:

```
┌────────────────────────────────────────────────────────┐
│                   [EVENTS]                             │
│   Discrete transient bursts (lightning, threshold hits)│
├────────────────────────────────────────────────────────┤
│                 [TRANSITIONS]                          │
│   Filter sweeps, octave shifts, scene-cut resets       │
├────────────────────────────────────────────────────────┤
│                  [EVOLUTION]                           │
│   Melodic trajectory, rate-of-change pulse, dynamics   │
├────────────────────────────────────────────────────────┤
│              [BACKGROUND_STATE]                        │
│   Sub-bass anchor, ambient harmonic pad, spatial field │
└────────────────────────────────────────────────────────┘
```

1. **`BACKGROUND_STATE`:** Low-frequency sub-bass anchor (35–150 Hz) and 4-voice spatial chord drone. Provides stability, orientation, and context.
2. **`EVOLUTION`:** Continuous melodic contour tracking the focal scientific measurement. Articulates notes on scale degree intervals with dynamic rhythmic tempo.
3. **`TRANSITIONS`:** Resonant filter opening/closing, musical key transposition with color temperature, and smooth cross-fading across scene changes.
4. **`EVENTS`:** High-priority, snappy transient hits that punctuate anomalies, threshold crossings, or lightning discharges.

---

## 2. Temporal Safeguards & Fatigue Prevention

To prevent acoustic clutter and user fatigue:

### 2.1 Event Cooldown
- **Cooldown Window:** 200 milliseconds minimum between consecutive event triggers for the same event type.
- **Deduplication:** Prevents identical visual artifacts or multi-frame video compression ripples from machine-gunning percussive clicks.

### 2.2 Scene Cut & Seek Detection
- When a video seeks or cuts between distinct scenes (`isSceneCut: true` or `isSeeked: true`), temporal derivates ($\Delta v / \Delta t$) are reset to zero.
- Parameter smoothers are bypassed for 1 frame to prevent audible glide artifacts across unrelated visualizations.

### 2.3 Minimum Dwell Time & Hysteresis
- Active auditory mappings maintain a minimum dwell time (300 ms) before role reassignment.
- Prevents acoustic chatter when scientific metrics oscillate around decision boundaries.
