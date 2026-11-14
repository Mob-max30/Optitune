/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: Scientific Relationship Graph (SRG)
 *
 * Implements Stage 3 of SASC: Typed Directed Graph representing dependencies,
 * spatial/temporal associations, and physical relationships among scientific features.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { EnrichedScientificFeature } from './ontology';

export type RelationshipType =
  | 'DERIVED_FROM'
  | 'SPATIALLY_RELATED_TO'
  | 'TEMPORALLY_RELATED_TO'
  | 'CORRELATED_WITH'
  | 'CONTRASTS_WITH'
  | 'CONTRIBUTES_TO'
  | 'INDICATES'
  | 'AGGREGATES'
  | 'PART_OF'
  | 'CO_OCCURS_WITH';

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  confidence: number;
  evidenceSource: string;
  isDocumented: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: 'feature' | 'phenomenon' | 'region' | 'event';
  featureRef?: EnrichedScientificFeature;
}

export class ScientificRelationshipGraph {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  addEdge(edge: GraphEdge): boolean {
    if (!this.nodes.has(edge.sourceId) || !this.nodes.has(edge.targetId)) {
      return false; // Cannot connect non-existent nodes
    }

    // Cycle detection for derivation dependencies (DERIVED_FROM must be a DAG)
    if (edge.type === 'DERIVED_FROM') {
      if (this.createsDerivationCycle(edge.sourceId, edge.targetId)) {
        console.warn(`[SRG] Rejected cyclic derivation dependency: ${edge.sourceId} -> ${edge.targetId}`);
        return false;
      }
    }

    this.edges.push(edge);
    return true;
  }

  getEdges(): GraphEdge[] {
    return [...this.edges];
  }

  private createsDerivationCycle(sourceId: string, targetId: string): boolean {
    if (sourceId === targetId) return true;

    const visited = new Set<string>();
    const queue = [targetId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === sourceId) return true;
      visited.add(current);

      for (const e of this.edges) {
        if (e.type === 'DERIVED_FROM' && e.sourceId === current && !visited.has(e.targetId)) {
          queue.push(e.targetId);
        }
      }
    }

    return false;
  }

  getOutgoingEdges(nodeId: string, type?: RelationshipType): GraphEdge[] {
    return this.edges.filter(e => e.sourceId === nodeId && (!type || e.type === type));
  }

  getIncomingEdges(nodeId: string, type?: RelationshipType): GraphEdge[] {
    return this.edges.filter(e => e.targetId === nodeId && (!type || e.type === type));
  }

  getDependencies(featureId: string): string[] {
    return this.getOutgoingEdges(featureId, 'DERIVED_FROM').map(e => e.targetId);
  }

  getRelatedFeatures(featureId: string, type?: RelationshipType): string[] {
    const related = new Set<string>();
    for (const e of this.edges) {
      if (!type || e.type === type) {
        if (e.sourceId === featureId) related.add(e.targetId);
        if (e.targetId === featureId) related.add(e.sourceId);
      }
    }
    related.delete(featureId);
    return Array.from(related);
  }

  /**
   * Returns features that are not derived from any other features in the graph.
   */
  getIndependentFeatures(): string[] {
    const derivedTargets = new Set(this.edges.filter(e => e.type === 'DERIVED_FROM').map(e => e.sourceId));
    return Array.from(this.nodes.keys()).filter(id => {
      const node = this.nodes.get(id);
      return node?.kind === 'feature' && !derivedTargets.has(id);
    });
  }
}

/**
 * Builds a ScientificRelationshipGraph from a collection of enriched features.
 */
export function buildScientificRelationshipGraph(
  features: EnrichedScientificFeature[],
  phenomenonId = 'earth-phenomenon'
): ScientificRelationshipGraph {
  const graph = new ScientificRelationshipGraph();

  // 1. Add phenomenon root node
  graph.addNode({
    id: phenomenonId,
    label: phenomenonId,
    kind: 'phenomenon'
  });

  // 2. Add feature nodes
  for (const f of features) {
    graph.addNode({
      id: f.stableFeatureId,
      label: f.featureName,
      kind: f.dataType === 'event' ? 'event' : 'feature',
      featureRef: f
    });

    // Connect feature to root phenomenon (PART_OF)
    graph.addEdge({
      sourceId: f.stableFeatureId,
      targetId: phenomenonId,
      type: 'PART_OF',
      confidence: 1.0,
      evidenceSource: 'source_metadata',
      isDocumented: true
    });
  }

  // 3. Connect spatial and temporal relationships
  const featureList = Array.from(features);
  for (let i = 0; i < featureList.length; i++) {
    for (let j = i + 1; j < featureList.length; j++) {
      const f1 = featureList[i];
      const f2 = featureList[j];

      // Spatial relationship
      if (f1.dataType === 'spatial_grid' && f2.dataType === 'spatial_grid') {
        graph.addEdge({
          sourceId: f1.stableFeatureId,
          targetId: f2.stableFeatureId,
          type: 'SPATIALLY_RELATED_TO',
          confidence: 0.9,
          evidenceSource: 'spatial_grid_coincidence',
          isDocumented: false
        });
      }

      // Derivation dependency (e.g. rate or anomaly derived from base measurement)
      if (f1.derivationHistory.includes(f2.stableFeatureId)) {
        graph.addEdge({
          sourceId: f1.stableFeatureId,
          targetId: f2.stableFeatureId,
          type: 'DERIVED_FROM',
          confidence: 1.0,
          evidenceSource: 'derivation_lineage',
          isDocumented: true
        });
      } else if (f2.derivationHistory.includes(f1.stableFeatureId)) {
        graph.addEdge({
          sourceId: f2.stableFeatureId,
          targetId: f1.stableFeatureId,
          type: 'DERIVED_FROM',
          confidence: 1.0,
          evidenceSource: 'derivation_lineage',
          isDocumented: true
        });
      }
    }
  }

  return graph;
}
