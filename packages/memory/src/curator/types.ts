
export type ArtifactType = "DECISION" | "FACT" | "PREFERENCE" | "STATE_SUMMARY";

export interface KnowledgeArtifact {
  id: string;
  type: ArtifactType;
  content: string;
  entities: string[];
  timestamp: string; // ISO8601
  source_event_ids: string[];
  confidence: number;
  version: number;
}

export interface CuratedState {
  last_curated_sequence: number;
  artifact_count: number;
}
