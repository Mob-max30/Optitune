# SASC — Scientific Relationship Model (SRG)

**Subsystem:** Earth Jukebox Autonomous Scientific Sonification  
**Component:** `extension/src/sasc/relationship-graph.ts`  
**Purpose:** Directed Typed Graph of scientific phenomenon, features, derivations, and dependencies.

---

## 1. Graph Architecture

The Scientific Relationship Graph ($G = (V, E)$) represents the scientific context of an auditory scene:

- **Vertices ($V$):**
  - **Phenomenon Nodes:** Represent the planetary system under observation (e.g. `gedi-forest-height`, `sst-currents`, `iss-lightning`).
  - **Feature Nodes:** Individual calibrated or proxy variables (`canopy_height`, `spatial_gradient`, `rate_of_change`).
  - **Event Nodes:** Discrete observations (`lightning_flash`, `threshold_crossing`).

- **Edges ($E$):**
  Typed directed edges with confidence weights $w \in [0.0, 1.0]$ and documentation flags.

---

## 2. Supported Relationship Types

| Relationship Type | Semantic Definition | Auditory Implication |
| :--- | :--- | :--- |
| `PART_OF` | Feature belongs to phenomenon root | Inherits global musical scale |
| `DERIVED_FROM` | Mathematical transformation of source feature | Subordinated in auditory hierarchy |
| `SPATIALLY_RELATED_TO` | Co-located or adjacent in physical space | Shared panning or harmonic coupling |
| `TEMPORALLY_COINCIDENT` | Occurs simultaneously | Synchronized rhythmic attack |
| `CORRELATED_WITH` | Empirical statistical co-variance | Harmonic interval consonance |
| `CAUSES` | Physical causal linkage | Sequential acoustic trigger |
| `MEASURES` | Sensor observation of phenomenon | Audio clarity / timbre brightness |
| `CONSTRAINS` | Physical boundary or ceiling | Dynamic compression threshold |
| `MODULATES` | Secondary variable influencing primary | LFO or filter cutoff sweep |
| `ANOMALY_OF` | Deviation from nominal baseline | Detuning / acoustic tension |

---

## 3. Derivation DAG Enforcement & Cycle Prevention

Mathematical derivations must form a Directed Acyclic Graph (DAG). Circular derivations (e.g. $A \to B \to A$) are physically nonsensical and could cause infinite acoustic feedback loops.

### Cycle Detection Algorithm
Before adding any edge of type `DERIVED_FROM` from `sourceId` to `targetId`:
1. Check if `sourceId === targetId` (trivial self-loop; rejected).
2. Run Breadth-First Search (BFS) starting from `targetId` along existing `DERIVED_FROM` edges.
3. If `sourceId` is reachable from `targetId`, the new edge would complete a cycle.
4. The graph rejects the edge, logs a warning (`[SRG] Rejected cyclic derivation dependency`), and returns `false`.
