import type { AiConnectionInput } from "./ai-connection-types.ts";
import type { AuthorizationModel } from "./authorization-model-types.ts";
import type { IntrospectionInput } from "./introspection-types.ts";

export type AnalysisInput = {
  database: IntrospectionInput;
  ai: AiConnectionInput;
  snapshotRevision: string;
  scopeOverrides: Record<string, boolean>;
  supportingContext: string;
};

export const ANALYSIS_PHASES = ["starting", "checking_schema", "preparing_evidence", "generating_model", "receiving_model", "validating_model"] as const;
export type AnalysisPhase = typeof ANALYSIS_PHASES[number];

export type AnalysisRequestOptions = {
  signal: AbortSignal;
  onProgress: (phase: AnalysisPhase) => void;
};

export type AnalysisEvent =
  | { type: "progress"; phase: AnalysisPhase }
  | { type: "result"; result: AnalysisResult };

export type AnalysisResult =
  | { ok: true; model: AuthorizationModel; completedAt: string }
  | {
      ok: false;
      code: "input" | "database" | "stale_snapshot" | "provider" | "invalid_output" | "timeout" | "cancelled";
      message: string;
      issues?: string[];
    };

export type PreparedAnalysis = {
  snapshotRevision: string;
  contextRevision: string;
  modelId: string;
  includedIds: string[];
  externalIds: string[];
  exclusions: { sourceId: string; reason: string }[];
  evidenceRegistry: Record<string, unknown>;
  sourceAliases: Record<string, string>;
  contextSourceIds: string[];
  payload: string;
};
