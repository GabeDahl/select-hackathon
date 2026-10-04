import "server-only";

import { createHash } from "node:crypto";
import type { DatabaseSnapshot } from "./catalog-types.ts";
import type { AnalysisInput, PreparedAnalysis } from "./analysis-types.ts";
import { catalogOriginHint, hasSupabasePlatform } from "./catalog-origin.ts";
import { selectAnalysisEvidence } from "./analysis-evidence.ts";
import { projectAnalysisSource } from "./analysis-payload.ts";

export class AnalysisInputError extends Error {}

export function validateAnalysisInput(value: unknown): AnalysisInput {
  const fail = () => { throw new AnalysisInputError("Check the analysis settings and import a current schema snapshot."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const input = value as Partial<AnalysisInput>;
  if (typeof input.snapshotRevision !== "string" || !/^[a-f0-9]{64}$/.test(input.snapshotRevision)) return fail();
  if (!input.database || typeof input.database !== "object" || Array.isArray(input.database) ||
      (input.database.connectionString !== undefined && typeof input.database.connectionString !== "string")) return fail();
  if (!input.ai || typeof input.ai !== "object" || Array.isArray(input.ai)) return fail();
  if (typeof input.supportingContext !== "string" || input.supportingContext.length > 40_000) return fail();
  if (!input.scopeOverrides || typeof input.scopeOverrides !== "object" || Array.isArray(input.scopeOverrides)) return fail();
  const entries = Object.entries(input.scopeOverrides);
  if (entries.length > 10_000 || entries.some(([id, included]) => id.length > 2_048 || typeof included !== "boolean")) return fail();
  return {
    database: { connectionString: input.database.connectionString },
    ai: input.ai,
    snapshotRevision: input.snapshotRevision,
    supportingContext: input.supportingContext.trim(),
    scopeOverrides: Object.fromEntries(entries),
  };
}

// Metadata and context only. Credentials never enter this function or the prompt.
export function prepareAnalysis(snapshot: DatabaseSnapshot, scopeOverrides: Record<string, boolean>, supportingContext: string): PreparedAnalysis {
  const byId = new Map(snapshot.objects.map((object) => [object.id, object]));
  if (Object.keys(scopeOverrides).some((id) => !byId.has(id))) {
    throw new AnalysisInputError("The selected scope no longer matches the snapshot. Refresh the schema and try again.");
  }
  const { includedIds, retained } = selectAnalysisEvidence(snapshot, scopeOverrides);
  if (!includedIds.some((id) => byId.get(id)?.kind === "relation")) {
    throw new AnalysisInputError("Include at least one application relation in the schema scope before analyzing.");
  }
  const included = new Set(includedIds);
  const externalIds = [...retained].filter((id) => !included.has(id)).sort();
  const exclusions = snapshot.objects.filter((object) => !retained.has(object.id))
    .map((object) => ({ sourceId: object.id, reason: object.id in scopeOverrides ? "Excluded by application scope selection." : object.scopeReason }))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const context = supportingContext.trim();
  const contextRevision = createHash("sha256").update(JSON.stringify({ evidenceSelectionVersion: 3, includedIds, externalIds, exclusions, context })).digest("hex");
  const modelId = `model:${createHash("sha256").update(snapshot.revision + contextRevision).digest("hex").slice(0, 24)}`;
  const evidenceRegistry: Record<string, unknown> = {};
  const supabase = hasSupabasePlatform(snapshot);
  for (const object of snapshot.objects) {
    if (!retained.has(object.id)) continue;
    const { id, kind, schema, name, identity, comment, definition, details, extension } = object;
    evidenceRegistry[id] = { id, kind, schema, name, identity, comment, definition, details, extension,
      originHint: catalogOriginHint(object, supabase), scopeReason: object.scopeReason };
  }
  const contextSourceIds = context ? ["context:application"] : [];
  if (context) evidenceRegistry["context:application"] = { text: context, kind: "user_supplied_context" };
  const omittedBySchema: Record<string, number> = {};
  for (const object of snapshot.objects) if (!retained.has(object.id)) {
    const schema = object.schema ?? "(global)";
    omittedBySchema[schema] = (omittedBySchema[schema] ?? 0) + 1;
  }
  const sourceAliases = Object.fromEntries(Object.keys(evidenceRegistry).sort().map((id, index) => [`s${index + 1}`, id]));
  const payload = JSON.stringify({
    evidence: Object.fromEntries(Object.entries(sourceAliases).map(([alias, id]) => [alias, projectAnalysisSource(evidenceRegistry[id] as Parameters<typeof projectAnalysisSource>[0], included.has(id))])),
    omitted: omittedBySchema,
    boundary: "Schema and supplied context only. No rows or live access tests. Referenced platform objects are dependencies, not business resources. Unqualified/dynamic SQL references may be unresolved.",
  });
  if (Buffer.byteLength(payload) > 40_000) {
    throw new AnalysisInputError("The selected evidence is too large for one analysis request. Narrow the application scope and try again.");
  }
  return { snapshotRevision: snapshot.revision, contextRevision, modelId, includedIds, externalIds, exclusions, evidenceRegistry, sourceAliases, contextSourceIds, payload };
}
