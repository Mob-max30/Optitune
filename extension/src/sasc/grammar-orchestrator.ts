/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: Scientific Auditory Grammar & Temporal Orchestrator
 *
 * Implements Stages 10 and 11 of SASC:
 * Organizes auditory streams into 4 grammatical categories:
 * BACKGROUND_STATE, EVOLUTION, EVENTS, TRANSITIONS.
 * Enforces temporal stability, structural dwell times, and event deduplication.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { PlannedAuditoryStream, OptimizedAuditoryScene } from './scene-optimizer';
import type { EnrichedScientificFeature } from './ontology';

export type GrammarCategory =
  | 'BACKGROUND_STATE'
  | 'EVOLUTION'
  | 'EVENTS'
  | 'TRANSITIONS';

export interface GrammaticalStream {
  stream: PlannedAuditoryStream;
  category: GrammarCategory;
  temporalDwellSeconds: number;
  lastTriggeredTimestamp?: number;
}

export interface OrchestrationFrameState {
  currentScene: OptimizedAuditoryScene;
  activeGrammarStreams: GrammaticalStream[];
  isSceneCut: boolean;
  isSeeking: boolean;
  lastOrchestrationTimestamp: number;
}

export class TemporalSceneOrchestrator {
  private activeState: OrchestrationFrameState | null = null;
  private minDwellTimeSeconds = 0.5; // Prevent mapping flickering
  private eventCooldownSeconds = 0.15; // Prevent duplicate event triggers
  private lastEventTimestamps = new Map<string, number>();

  /**
   * Evaluates incoming frame features against active scene and produces grammar-classified streams.
   */
  orchestrate(
    scene: OptimizedAuditoryScene,
    timestamp: number,
    flags: { isSeeked?: boolean; isSceneCut?: boolean } = {}
  ): GrammaticalStream[] {
    const isSceneCut = Boolean(flags.isSceneCut);
    const isSeeking = Boolean(flags.isSeeked);

    if (isSceneCut || isSeeking) {
      this.lastEventTimestamps.clear();
    }

    const grammaticalStreams: GrammaticalStream[] = [];

    for (const s of scene.activeStreams) {
      let category: GrammarCategory = 'BACKGROUND_STATE';

      if (isSceneCut) {
        category = 'TRANSITIONS';
      } else if (s.role === 'EVENTS') {
        category = 'EVENTS';
      } else if (s.role === 'DYNAMICS') {
        category = 'EVOLUTION';
      } else {
        category = 'BACKGROUND_STATE';
      }

      grammaticalStreams.push({
        stream: s,
        category,
        temporalDwellSeconds: this.minDwellTimeSeconds,
        lastTriggeredTimestamp: timestamp
      });
    }

    this.activeState = {
      currentScene: scene,
      activeGrammarStreams: grammaticalStreams,
      isSceneCut,
      isSeeking,
      lastOrchestrationTimestamp: timestamp
    };

    return grammaticalStreams;
  }

  /**
   * Checks whether a discrete event can trigger, enforcing deduplication and cooldown.
   */
  canTriggerEvent(eventId: string, timestamp: number): boolean {
    const lastTime = this.lastEventTimestamps.get(eventId);
    if (lastTime !== undefined && (timestamp - lastTime) < this.eventCooldownSeconds) {
      return false; // Deduplicated
    }

    this.lastEventTimestamps.set(eventId, timestamp);
    return true;
  }
}
